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
    // Check if tree-sitter is available
    this.treeSitterAvailable = Parser !== null;

    if (!this.treeSitterAvailable) {
      this.logger.warn('tree-sitter not available - will use regex fallback for all languages');
    } else {
      // Initialize parsers for all configured languages
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

        // Dynamically import the parser module
        const parserModule = require(langConfig.module);

        // Most tree-sitter parsers export the language directly (CommonJS: module.exports = language)
        // Some export named exports (e.g., tree-sitter-typescript exports .typescript and .tsx)
        // Try in this order:
        // 1. Named export (e.g., parserModule.typescript for tree-sitter-typescript)
        // 2. Direct export (parserModule itself - most CommonJS parsers)
        // 3. Default export (parserModule.default)
        // 4. Language property (parserModule.language)

        let language = null;

        // 1. Try named export (for tree-sitter-typescript which exports .typescript and .tsx)
        // Empty string, "default", or "language" means try direct export first
        if (
          langConfig.export &&
          langConfig.export !== '' &&
          langConfig.export !== 'default' &&
          langConfig.export !== 'language'
        ) {
          language = parserModule[langConfig.export];
        }

        // 2. Try direct export (most CommonJS parsers export the language directly)
        // Most tree-sitter parsers: module.exports = language (the language object itself)
        if (
          !language &&
          parserModule &&
          typeof parserModule === 'object' &&
          !Array.isArray(parserModule)
        ) {
          // Language objects typically have nodeTypeInfo property or are functions
          // Some parsers (like php, yaml, markdown) may have more properties
          // Accept it if it has nodeTypeInfo, is a function, or looks like a language object
          const keys = Object.keys(parserModule);
          if (
            parserModule.nodeTypeInfo ||
            typeof parserModule === 'function' ||
            (keys.length > 0 && keys.length < 100) // Increased limit for parsers with more properties
          ) {
            language = parserModule;
          }
        }

        // 3. Try default export
        if (!language && parserModule.default) {
          language = parserModule.default;
        }

        // 4. Try language property
        if (!language && parserModule.language) {
          language = parserModule.language;
        }

        // Verify it's a valid language object
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

          // If setLanguage succeeds, the language is valid

          // Store parser for all aliases
          for (const alias of langConfig.aliases) {
            this.parsers.set(alias.toLowerCase(), parser);
            this.languageConfigs.set(alias.toLowerCase(), langConfig);
          }

          // Also store by name
          this.parsers.set(langConfig.name.toLowerCase(), parser);
          this.languageConfigs.set(langConfig.name.toLowerCase(), langConfig);

          initialized.push(langConfig.name);
        } catch (setLangError: any) {
          // setLanguage failed - the language object is invalid
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
      // Get file content from S3
      const fileBlob = await this.prisma.fileBlob.findFirst({
        where: { repoId, sha: blobSha },
      });

      if (!fileBlob) {
        throw new Error(`FileBlob not found: ${blobSha}`);
      }

      const content = await this.s3.getFileContent(fileBlob.s3Key);

      // Parse with tree-sitter
      const language = this.detectLanguage(path);
      const ast = await this.parseTree(content, language);

      if (!ast) {
        this.logger.warn(`Failed to parse ${path}`);
        return;
      }

      // Store AST in S3
      const astS3Key = await this.s3.storeAST(repoId, sha, path, ast);

      // Extract nodes
      const nodes = this.extractNodes(ast, path, content);

      // Update file blob
      await this.prisma.fileBlob.update({
        where: { id: fileBlob.id },
        data: { parsedAt: new Date() },
      });

      // Create Node records and enqueue embeddings
      for (const nodeData of nodes) {
        // Create or update Node record
        const node = await this.prisma.node.upsert({
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
            summary: null, // Will be generated by embedding worker
          },
          update: {
            text: nodeData.text,
            updatedAt: new Date(),
          },
        });

        // Enqueue embedding job with nodeId
        await this.queue.enqueue('embed-chunks', {
          repoId,
          sha,
          path,
          nodePath: nodeData.path,
          nodeText: nodeData.text,
          astS3Key,
          nodeId: node.id,
        });
      }

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
    // Fallback to simple structure if tree-sitter fails
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
  }> {
    const nodes: Array<{
      path: string;
      text: string;
      type?: string;
      startLine?: number;
      endLine?: number;
    }> = [];

    // If we have a real tree-sitter AST, traverse it properly
    if (ast.rootNode && ast.rootNode.type === 'program') {
      return this.extractNodesFromTreeSitter(ast.rootNode, filePath, content);
    }

    // Fallback to regex-based extraction
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
  }> {
    const nodes: Array<{
      path: string;
      text: string;
      type?: string;
      startLine?: number;
      endLine?: number;
    }> = [];

    // Traverse AST and extract functions, classes, methods, exports
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
          });
        }
      }

      // Recursively traverse children
      for (const child of node.children || []) {
        traverse(child, nodePath);
      }
    };

    traverse(rootNode);

    // If no nodes found, add root node
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
  }> {
    const nodes: Array<{
      path: string;
      text: string;
      type?: string;
      startLine?: number;
      endLine?: number;
    }> = [];

    // Fallback: Extract functions using regex
    const functionPattern =
      /(?:function|const|let|var|export\s+(?:async\s+)?function)\s+(\w+)\s*[=\(]/g;
    let match;
    let functionCount = 0;

    while ((match = functionPattern.exec(content)) !== null && functionCount < 20) {
      const funcName = match[1];
      const startPos = match.index;
      const startLine = content.substring(0, startPos).split('\n').length;

      // Find end of function (simplified - find matching brace)
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
        });
        functionCount++;
      }
    }

    // Add root node if no functions found
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
    // Try to get language from config
    const langConfig = this.parserConfig.getLanguageByPath(filePath);
    if (langConfig) {
      return langConfig.name;
    }

    // Fallback to extension-based detection
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
}
