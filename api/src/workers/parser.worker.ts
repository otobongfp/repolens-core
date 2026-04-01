import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { S3Service } from '../common/s3/s3.service';
import { QueueService } from '../common/queue/queue.service';
import { ParserConfigService, LanguageConfig } from '../common/parser/parser-config.service';

// Try to import tree-sitter, but make it optional
let Parser: any = null;
try {
  Parser = require('tree-sitter').default || require('tree-sitter');
} catch (error) {
  // tree-sitter not available - will use regex fallback
}

@Injectable()
export class ParserWorker {
  private readonly logger = new Logger(ParserWorker.name);
  private parsers: Map<string, any> = new Map();
  private languageConfigs: Map<string, LanguageConfig> = new Map();
  private treeSitterAvailable: boolean = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly queue: QueueService,
    private readonly parserConfig: ParserConfigService
  ) {
    this.treeSitterAvailable = Parser !== null;

    if (!this.treeSitterAvailable) {
      this.logger.warn('tree-sitter not available - will use regex fallback for all languages');
    } else {
      this.initializeParsers();
    }
  }

  private initializeParsers() {
    if (!Parser) {
      this.logger.warn('tree-sitter Parser class not available, skipping parser initialization');
      return;
    }

    const languages = this.parserConfig.getAllLanguages();
    const initialized: string[] = [];
    const failed: string[] = [];

    for (const langConfig of languages) {
      try {
        // Skip CSS - it's an ESM module with top-level await
        if (langConfig.module === 'tree-sitter-css') {
          this.logger.warn(
            `Skipping ${langConfig.name} - ESM module with top-level await not supported`
          );
          failed.push(langConfig.name);
          continue;
        }

        const parserModule = require(langConfig.module);

        let language = null;

        if (
          langConfig.export &&
          langConfig.export !== '' &&
          langConfig.export !== 'default' &&
          langConfig.export !== 'language'
        ) {
          language = parserModule[langConfig.export];
          if (!language) {
            this.logger.warn(
              `Named export '${langConfig.export}' not found in ${langConfig.module}. Available keys: ${Object.keys(parserModule).slice(0, 10).join(', ')}`
            );
          }
        }

        if (
          !language &&
          parserModule &&
          typeof parserModule === 'object' &&
          !Array.isArray(parserModule)
        ) {
          const keys = Object.keys(parserModule);
          if (
            parserModule.nodeTypeInfo ||
            typeof parserModule === 'function' ||
            (keys.length > 0 && keys.length < 100)
          ) {
            language = parserModule;
          }
        }

        if (!language && parserModule.default) {
          language = parserModule.default;
        }

        if (!language && parserModule.language) {
          language = parserModule.language;
        }
        if (
          !language ||
          (typeof language !== 'object' && typeof language !== 'function') ||
          (typeof language === 'object' && language !== null && Array.isArray(language))
        ) {
          this.logger.warn(
            `Parser module ${langConfig.module} does not export a valid language. ` +
              `Tried: ${langConfig.export}, direct export, default, language. ` +
              `Module type: ${typeof parserModule}, Keys: ${Object.keys(parserModule).slice(0, 10).join(', ')}`
          );
          failed.push(langConfig.name);
          continue;
        }

        try {
          const parser = new Parser();
          parser.setLanguage(language);

          for (const alias of langConfig.aliases) {
            this.parsers.set(alias.toLowerCase(), parser);
            this.languageConfigs.set(alias.toLowerCase(), langConfig);
          }

          this.parsers.set(langConfig.name.toLowerCase(), parser);
          this.languageConfigs.set(langConfig.name.toLowerCase(), langConfig);

          initialized.push(langConfig.name);
        } catch (setLangError: any) {
          this.logger.warn(
            `Failed to initialize parser for ${langConfig.name} (${langConfig.module}): ` +
              `Invalid language object - ${setLangError.message || setLangError}`
          );
          failed.push(langConfig.name);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to initialize parser for ${langConfig.name} (${langConfig.module}):`,
          error instanceof Error ? error.message : error
        );
        failed.push(langConfig.name);
      }
    }

    if (initialized.length > 0) {
      this.logger.log(`Tree-sitter parsers initialized: ${initialized.join(', ')}`);
    }

    if (failed.length > 0) {
      this.logger.warn(
        `Failed to initialize parsers: ${failed.join(', ')}. These will use regex fallback.`
      );
    }
  }

  async process(job: any) {
    const { repoId, sha, path, blobSha } = job.data;
    const startTime = Date.now();

    this.logger.log(`Parsing ${path} for repo ${repoId}`);

    try {
      const fileBlob = await this.prisma.withRetry(() =>
        this.prisma.fileBlob.findFirst({
          where: { repoId, sha: blobSha },
        })
      );

      if (!fileBlob) {
        throw new Error(`FileBlob not found: ${blobSha}`);
      }

      const content = await this.s3.getFileContent(fileBlob.s3Key);

      const language = this.detectLanguage(path);
      const ast = await this.parseTree(content, language);

      if (!ast) {
        this.logger.warn(`Failed to parse ${path}`);
        return;
      }

      const astS3Key = await this.s3.storeAST(repoId, sha, path, ast);
      const nodes = this.extractNodes(ast, path, content);

      await this.prisma.withRetry(() =>
        this.prisma.fileBlob.update({
          where: { id: fileBlob.id },
          data: { parsedAt: new Date() },
        })
      );

      // Extract symbol references from AST for call graph
      const symbolRefs = this.extractSymbolReferences(ast, path, content, nodes);

      for (const nodeData of nodes) {
        const node = await this.prisma.withRetry(() =>
          this.prisma.node.upsert({
            where: {
              repoId_filePath_nodePath_blobSha: {
                repoId,
                filePath: path,
                nodePath: nodeData.path,
                blobSha,
              },
            },
            create: {
              repoId,
              filePath: path,
              blobSha,
              nodePath: nodeData.path,
              nodeType: nodeData.type || 'export',
              startLine: nodeData.startLine || 1,
              endLine: nodeData.endLine || 1,
              text: nodeData.text,
              summary: null,
            },
            update: {
              nodeType: nodeData.type || 'export',
              startLine: nodeData.startLine || 1,
              endLine: nodeData.endLine || 1,
              text: nodeData.text,
              updatedAt: new Date(),
            },
          })
        );

        // Create Symbol record for this node (if it's a named symbol)
        if (nodeData.name && nodeData.type && nodeData.type !== 'source_file') {
          try {
            await this.prisma.withRetry(() =>
              this.prisma.symbol.upsert({
                where: {
                  repoId_filePath_name_blobSha: {
                    repoId,
                    filePath: path,
                    name: nodeData.name!,
                    blobSha,
                  },
                },
                create: {
                  repoId,
                  filePath: path,
                  blobSha,
                  name: nodeData.name!,
                  kind: nodeData.type,
                  nodeId: node.id,
                  nodePath: nodeData.path,
                  signature: this.extractSignature(nodeData.text, nodeData.type),
                },
                update: {
                  signature: this.extractSignature(nodeData.text, nodeData.type),
                },
              })
            );
          } catch (error) {
            this.logger.warn(`Failed to create symbol for ${nodeData.name}:`, error);
          }
        }

        // Construct an enriched text for embedding that includes structural context.
        // This reduces "centroid noise" and allows the embedding model to distinguish
        // between similar logic in different files or contexts.
        const enrichedText = `File: ${path}\n` +
          `Symbol: ${nodeData.name || 'anonymous'}\n` +
          `Type: ${nodeData.type || 'unknown'}\n` +
          (nodeData.type === 'function' || nodeData.type === 'method' 
            ? `Signature: ${this.extractSignature(nodeData.text, nodeData.type)}\n` 
            : '') +
          `Code:\n${nodeData.text}`;

        await this.queue.enqueue('embed-chunks', {
          repoId,
          sha,
          path,
          nodePath: nodeData.path,
          nodeText: enrichedText,
          astS3Key,
          nodeId: node.id,
        });
      }

      // Create SymbolRef records for relationships
      await this.createSymbolRefs(repoId, path, blobSha, symbolRefs, nodes);

      const duration = (Date.now() - startTime) / 1000;
      this.logger.debug(`Parsed ${path} in ${duration}s, extracted ${nodes.length} nodes`);
    } catch (error) {
      this.logger.error(`Failed to parse ${path}:`, error);
      throw error;
    }
  }

  private async parseTree(content: string, language: string): Promise<any> {
    const parser = this.getParser(language);

    if (!parser) {
      this.logger.warn(`No parser available for language: ${language}, using fallback`);
      return this.parseTreeFallback(content);
    }

    try {
      const tree = parser.parse(content);
      return {
        rootNode: tree.rootNode,
        tree: tree,
      };
    } catch (error) {
      this.logger.warn(`Failed to parse with tree-sitter for ${language}, using fallback:`, error);
      return this.parseTreeFallback(content);
    }
  }

  private parseTreeFallback(content: string): any {
    return {
      rootNode: {
        type: 'source_file',
        text: content.substring(0, 100),
      },
    };
  }

  private extractNodes(
    ast: any,
    filePath: string,
    content: string
  ): Array<{
    path: string;
    text: string;
    type?: string;
    startLine?: number;
    endLine?: number;
    name?: string;
  }> {
    const nodes: Array<{
      path: string;
      text: string;
      type?: string;
      startLine?: number;
      endLine?: number;
      name?: string;
    }> = [];

    if (ast.rootNode && ast.rootNode.type === 'program') {
      return this.extractNodesFromTreeSitter(ast.rootNode, filePath, content);
    }

    return this.extractNodesFallback(filePath, content);
  }

  private extractNodesFromTreeSitter(
    rootNode: any,
    filePath: string,
    content: string
  ): Array<{
    path: string;
    text: string;
    type?: string;
    startLine?: number;
    endLine?: number;
    name?: string;
  }> {
    const nodes: Array<{
      path: string;
      text: string;
      type?: string;
      startLine?: number;
      endLine?: number;
      name?: string;
    }> = [];

    const traverse = (node: any, parentPath: string = '') => {
      const nodeType = node.type;
      const nodePath = parentPath ? `${parentPath}.${nodeType}` : nodeType;

      // Extract functions, classes, methods
      if (
        nodeType === 'function_declaration' ||
        nodeType === 'function' ||
        nodeType === 'arrow_function' ||
        nodeType === 'method_definition' ||
        nodeType === 'class_declaration' ||
        nodeType === 'class_definition'
      ) {
        const nameNode =
          node.childForFieldName('name') || node.children.find((c: any) => c.type === 'identifier');
        const name = nameNode ? nameNode.text : 'anonymous';

        const startLine = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;
        const nodeText = content.substring(node.startIndex, node.endIndex);

        if (nodeText.length > 0 && nodeText.length < 10000) {
          let type = 'function';
          if (nodeType.includes('class')) type = 'class';
          if (nodeType.includes('method')) type = 'method';

          nodes.push({
            path: `${filePath}/${type}.${name}`,
            text: nodeText,
            type,
            startLine,
            endLine,
            name,
          });
        }
      }

      for (const child of node.children || []) {
        traverse(child, nodePath);
      }
    };

    traverse(rootNode);

    if (nodes.length === 0) {
      nodes.push({
        path: `${filePath}/root`,
        text: content.substring(0, 5000),
        type: 'source_file',
        startLine: 1,
        endLine: content.split('\n').length,
      });
    }

    return nodes;
  }

  private extractNodesFallback(
    filePath: string,
    content: string
  ): Array<{
    path: string;
    text: string;
    type?: string;
    startLine?: number;
    endLine?: number;
    name?: string;
  }> {
    const nodes: Array<{
      path: string;
      text: string;
      type?: string;
      startLine?: number;
      endLine?: number;
      name?: string;
    }> = [];

    const functionPattern =
      /(?:function|const|let|var|export\s+(?:async\s+)?function)\s+(\w+)\s*[=\(]/g;
    let match;
    let functionCount = 0;

    while ((match = functionPattern.exec(content)) !== null && functionCount < 20) {
      const funcName = match[1];
      const startPos = match.index;
      const startLine = content.substring(0, startPos).split('\n').length;

      let braceCount = 0;
      let inFunction = false;
      let endPos = startPos;

      for (let i = startPos; i < Math.min(startPos + 2000, content.length); i++) {
        if (content[i] === '{') {
          braceCount++;
          inFunction = true;
        } else if (content[i] === '}') {
          braceCount--;
          if (inFunction && braceCount === 0) {
            endPos = i + 1;
            break;
          }
        }
      }

      const endLine = content.substring(0, endPos).split('\n').length;
      const funcText = content.substring(startPos, endPos);

      if (funcText.length > 50 && funcText.length < 5000) {
        nodes.push({
          path: `${filePath}/function.${funcName}`,
          text: funcText,
          type: 'function',
          startLine,
          endLine,
          name: funcName,
        });
        functionCount++;
      }
    }

    if (nodes.length === 0) {
      const lines = content.split('\n');
      nodes.push({
        path: `${filePath}/root`,
        text: content.substring(0, 5000),
        type: 'source_file',
        startLine: 1,
        endLine: Math.min(lines.length, 100),
      });
    }

    return nodes;
  }

  private detectLanguage(filePath: string): string {
    const langConfig = this.parserConfig.getLanguageByPath(filePath);
    if (langConfig) {
      return langConfig.name;
    }

    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      cs: 'csharp',
      c: 'c',
      cpp: 'cpp',
      rb: 'ruby',
    };
    return langMap[ext] || 'javascript';
  }

  private getParser(language: string): any | null {
    if (!this.treeSitterAvailable) {
      return null;
    }
    const normalized = language.toLowerCase();
    return this.parsers.get(normalized) || null;
  }

  /**
   * Extract symbol references (calls, imports, inheritance) from AST
   */
  private extractSymbolReferences(
    ast: any,
    filePath: string,
    content: string,
    nodes: Array<{ path: string; name?: string; type?: string; startLine?: number; endLine?: number }>
  ): Array<{
    fromNodePath: string;
    toSymbolName: string;
    kind: 'calls' | 'imports' | 'inherits' | 'references';
    context?: string;
  }> {
    const refs: Array<{
      fromNodePath: string;
      toSymbolName: string;
      kind: 'calls' | 'imports' | 'inherits' | 'references';
      context?: string;
    }> = [];

    if (!ast.rootNode || ast.rootNode.type !== 'program') {
      return refs;
    }

    // Map nodes by path for quick lookup
    const nodeMap = new Map<string, { name?: string; type?: string }>();
    for (const node of nodes) {
      nodeMap.set(node.path, node);
    }

    // Extract imports
    const extractImports = (node: any) => {
      if (node.type === 'import_statement' || node.type === 'import_declaration') {
        const sourceNode = node.childForFieldName('source') || 
          node.children.find((c: any) => c.type === 'string');
        if (sourceNode) {
          const moduleName = sourceNode.text.replace(/['"]/g, '');
          // Find which node this import belongs to (nearest function/class)
          const containingNode = this.findContainingNode(node, nodes);
          if (containingNode) {
            refs.push({
              fromNodePath: containingNode.path,
              toSymbolName: moduleName,
              kind: 'imports',
              context: `import from ${moduleName}`,
            });
          }
        }
      }
    };

    // Extract function calls
    const extractCalls = (node: any, containingNodePath: string) => {
      if (node.type === 'call_expression' || node.type === 'call') {
        const functionNode = node.childForFieldName('function') || node.children[0];
        if (functionNode) {
          const calledName = this.extractIdentifierName(functionNode);
          if (calledName && calledName !== 'anonymous') {
            refs.push({
              fromNodePath: containingNodePath,
              toSymbolName: calledName,
              kind: 'calls',
              context: `calls ${calledName}`,
            });
          }
        }
      }
    };

    // Extract class inheritance
    const extractInheritance = (node: any) => {
      if (node.type === 'class_declaration' || node.type === 'class_definition') {
        const superclassNode = node.childForFieldName('superclass') ||
          node.children.find((c: any) => c.type === 'superclass');
        if (superclassNode) {
          const parentName = this.extractIdentifierName(superclassNode);
          const nameNode = node.childForFieldName('name');
          const className = nameNode ? nameNode.text : 'anonymous';
          const nodePath = `${filePath}/class.${className}`;
          
          if (parentName) {
            refs.push({
              fromNodePath: nodePath,
              toSymbolName: parentName,
              kind: 'inherits',
              context: `extends ${parentName}`,
            });
          }
        }
      }
    };

    // Traverse AST to extract references
    const traverse = (node: any, containingNodePath: string = '') => {
      extractImports(node);
      extractInheritance(node);
      
      if (containingNodePath) {
        extractCalls(node, containingNodePath);
      }

      // Update containing node path if we enter a function/class
      let newContainingPath = containingNodePath;
      if (
        node.type === 'function_declaration' ||
        node.type === 'function' ||
        node.type === 'arrow_function' ||
        node.type === 'method_definition' ||
        node.type === 'class_declaration' ||
        node.type === 'class_definition'
      ) {
        const nameNode = node.childForFieldName('name') || 
          node.children.find((c: any) => c.type === 'identifier');
        const name = nameNode ? nameNode.text : 'anonymous';
        let type = 'function';
        if (node.type.includes('class')) type = 'class';
        if (node.type.includes('method')) type = 'method';
        newContainingPath = `${filePath}/${type}.${name}`;
      }

      for (const child of node.children || []) {
        traverse(child, newContainingPath);
      }
    };

    traverse(ast.rootNode);

    return refs;
  }

  /**
   * Find the containing node (function/class) for a given AST node
   */
  private findContainingNode(
    astNode: any,
    nodes: Array<{ path: string; startLine?: number; endLine?: number }>
  ): { path: string } | null {
    // This is simplified - in practice, you'd traverse up the AST tree
    // For now, return the first matching node
    return nodes.length > 0 ? { path: nodes[0].path } : null;
  }

  /**
   * Extract identifier name from AST node
   */
  private extractIdentifierName(node: any): string | null {
    if (node.type === 'identifier') {
      return node.text;
    }
    if (node.type === 'member_expression' || node.type === 'property_access') {
      const objectNode = node.childForFieldName('object') || node.children[0];
      const propertyNode = node.childForFieldName('property') || node.children[1];
      if (propertyNode) {
        return this.extractIdentifierName(propertyNode);
      }
    }
    if (node.children && node.children.length > 0) {
      return this.extractIdentifierName(node.children[0]);
    }
    return null;
  }

  /**
   * Create SymbolRef records from extracted references.
   * Resolves target symbols REPO-WIDE (cross-file) so that calls,
   * imports, and inheritance links span the entire repository graph.
   */
  private async createSymbolRefs(
    repoId: string,
    filePath: string,
    blobSha: string,
    symbolRefs: Array<{
      fromNodePath: string;
      toSymbolName: string;
      kind: 'calls' | 'imports' | 'inherits' | 'references';
      context?: string;
    }>,
    nodes: Array<{ path: string; name?: string }>
  ): Promise<void> {
    if (symbolRefs.length === 0) {
      return;
    }

    try {
      // Local symbols (current file) — used for fromSymbol resolution
      const localSymbols = await this.prisma.symbol.findMany({
        where: { repoId, filePath, blobSha },
      });
      const localSymbolMap = new Map<string, string>();
      for (const s of localSymbols) {
        localSymbolMap.set(s.name, s.id);
      }

      // Local nodes (current file) — used for fromNode resolution
      const localNodes = await this.prisma.node.findMany({
        where: { repoId, filePath, blobSha },
      });
      const localNodeMap = new Map<string, string>();
      for (const n of localNodes) {
        localNodeMap.set(n.nodePath, n.id);
      }

      // Collect unique target names and resolve them REPO-WIDE
      const targetNames = [...new Set(symbolRefs.map((r) => r.toSymbolName))];
      const repoSymbols = await this.prisma.symbol.findMany({
        where: { repoId, name: { in: targetNames } },
        select: { id: true, name: true, nodeId: true, filePath: true },
      });

      // Map target name → { symbolId, nodeId }. When duplicates exist,
      // prefer symbols outside the current file (cross-file is the gap).
      const repoTargetMap = new Map<string, { symbolId: string; nodeId: string }>();
      for (const s of repoSymbols) {
        if (!repoTargetMap.has(s.name) || s.filePath !== filePath) {
          repoTargetMap.set(s.name, { symbolId: s.id, nodeId: s.nodeId });
        }
      }

      let createdCount = 0;
      for (const ref of symbolRefs) {
        const fromNodeId = localNodeMap.get(ref.fromNodePath);
        if (!fromNodeId) continue;

        const fromNodeData = nodes.find((n) => n.path === ref.fromNodePath);
        const fromSymbolId = fromNodeData?.name ? localSymbolMap.get(fromNodeData.name) : null;
        if (!fromSymbolId) continue;

        const target = repoTargetMap.get(ref.toSymbolName);
        if (!target) continue;

        try {
          await this.prisma.withRetry(() =>
            this.prisma.symbolRef.create({
              data: {
                repoId,
                fromSymbolId,
                toSymbolId: target.symbolId,
                fromNodeId,
                toNodeId: target.nodeId,
                kind: ref.kind,
                context: ref.context,
              },
            })
          );
          createdCount++;
        } catch (error: any) {
          if (error.code !== 'P2002' && !error.message?.includes('Foreign key')) {
            this.logger.warn(
              `Failed to create SymbolRef: ${ref.fromNodePath} -> ${ref.toSymbolName}`,
              error
            );
          }
        }
      }

      this.logger.debug(
        `Created ${createdCount}/${symbolRefs.length} symbol references for ${filePath} (repo-wide resolution)`
      );
    } catch (error) {
      this.logger.warn(`Failed to create symbol references for ${filePath}:`, error);
    }
  }

  /**
   * Deferred cross-file symbol resolution pass.
   *
   * During concurrent parsing, file A may reference a symbol in file B that
   * hasn't been parsed yet. This method re-scans all nodes in the repo and
   * creates SymbolRef records for any cross-file references that were missed.
   *
   * Should be called after all parse jobs for a repo have completed.
   */
  async resolveCrossFileRefs(repoId: string): Promise<number> {
    this.logger.log(`Starting cross-file symbol resolution for repo ${repoId}`);

    const allSymbols = await this.prisma.symbol.findMany({
      where: { repoId },
      select: { id: true, name: true, nodeId: true, filePath: true },
    });

    if (allSymbols.length === 0) return 0;

    // Build a quick lookup: name → Symbol[]
    const symbolsByName = new Map<string, typeof allSymbols>();
    for (const s of allSymbols) {
      const arr = symbolsByName.get(s.name) || [];
      arr.push(s);
      symbolsByName.set(s.name, arr);
    }

    // Collect existing refs to avoid duplicates
    const existingRefs = await this.prisma.symbolRef.findMany({
      where: { repoId },
      select: { fromNodeId: true, toNodeId: true },
    });
    const existingRefSet = new Set(existingRefs.map((r) => `${r.fromNodeId}:${r.toNodeId}`));

    // For each symbol, scan its node text for mentions of other cross-file symbols
    const allNodes = await this.prisma.node.findMany({
      where: { repoId },
      select: { id: true, text: true, filePath: true },
    });
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

    // Build escaped-regex lookup for symbol names that appear in multiple files
    const crossFileNames = [...symbolsByName.keys()];

    let created = 0;
    for (const sourceSymbol of allSymbols) {
      const sourceNode = nodeMap.get(sourceSymbol.nodeId);
      if (!sourceNode) continue;

      for (const targetName of crossFileNames) {
        const targets = symbolsByName.get(targetName)!;

        for (const targetSymbol of targets) {
          // Skip self-references and same-file (already handled during parsing)
          if (targetSymbol.id === sourceSymbol.id) continue;
          if (targetSymbol.filePath === sourceSymbol.filePath) continue;

          const key = `${sourceNode.id}:${targetSymbol.nodeId}`;
          if (existingRefSet.has(key)) continue;

          // Check if the source node text mentions the target symbol name
          const escaped = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escaped}\\b`);
          if (!regex.test(sourceNode.text)) continue;

          try {
            await this.prisma.symbolRef.create({
              data: {
                repoId,
                fromSymbolId: sourceSymbol.id,
                toSymbolId: targetSymbol.id,
                fromNodeId: sourceNode.id,
                toNodeId: targetSymbol.nodeId,
                kind: 'references',
                context: `Cross-file: ${sourceSymbol.name} → ${targetName}`,
              },
            });
            created++;
            existingRefSet.add(key);
          } catch (error: any) {
            if (error.code !== 'P2002') {
              this.logger.warn(
                `Failed to create cross-file ref: ${sourceSymbol.name} -> ${targetName}`,
                error
              );
            }
          }
        }
      }
    }

    this.logger.log(
      `Cross-file resolution complete for repo ${repoId}: ${created} new SymbolRef records created`
    );
    return created;
  }

  /**
   * Extract function/class signature from text
   */
  private extractSignature(text: string, type: string): string | null {
    if (!text) return null;

    // Extract first line for function signature
    const lines = text.split('\n');
    const firstLine = lines[0]?.trim() || '';

    // For functions, extract up to opening brace
    if (type === 'function' || type === 'method') {
      const match = firstLine.match(/^(?:async\s+)?(?:function\s+)?\w*\s*\([^)]*\)/);
      if (match) {
        return match[0];
      }
    }

    // For classes, extract class declaration
    if (type === 'class') {
      const match = firstLine.match(/^class\s+\w+(?:\s+extends\s+\w+)?/);
      if (match) {
        return match[0];
      }
    }

    return firstLine.substring(0, 100); // Fallback: first 100 chars
  }
}
