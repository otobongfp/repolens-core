import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { S3Service } from '../s3/s3.service';

export interface Citation {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
  summary: string | null;
  similarity: number;
  nodeId?: string;
  nodeType?: string;
}

@Injectable()
export class CitationService {
  private readonly logger = new Logger(CitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service
  ) {}

  /**
   * Enhance search results with full citations including code snippets
   */
  async enhanceWithCitations(
    results: Array<{
      id: string;
      similarity: number;
      filePath: string;
      summary: string | null;
      chunkText?: string;
      nodeId?: string;
    }>
  ): Promise<Citation[]> {
    const citations: Citation[] = [];

    for (const result of results) {
      try {
        // Get full node information if nodeId exists
        let node = null;
        if (result.nodeId) {
          node = await this.prisma.node.findUnique({
            where: { id: result.nodeId },
          });
        }

        // Get embedding to find associated node
        if (!node) {
          const embedding = await this.prisma.embedding.findUnique({
            where: { id: result.id },
            include: { node: true },
          });
          node = embedding?.node || null;
        }

        // Get full code snippet
        let codeSnippet = result.chunkText || '';
        let startLine = 1;
        let endLine = 1;
        let nodeType = 'unknown';

        if (node) {
          startLine = node.startLine;
          endLine = node.endLine;
          nodeType = node.nodeType;
          
          // Try to get full text from node
          if (node.text && node.text.length > 0) {
            codeSnippet = node.text;
          } else if (node.textS3Key) {
            // Try to load from S3
            try {
              codeSnippet = await this.s3.getFileContent(node.textS3Key);
            } catch (error) {
              this.logger.warn(`Failed to load code from S3: ${node.textS3Key}`, error);
            }
          }
        } else {
          // Fallback: try to get from embedding sourceText
          const embedding = await this.prisma.embedding.findUnique({
            where: { id: result.id },
          });
          
          if (embedding?.sourceText) {
            codeSnippet = embedding.sourceText;
          }
        }

        // Limit code snippet size for display
        const maxSnippetLength = 2000;
        if (codeSnippet.length > maxSnippetLength) {
          codeSnippet = codeSnippet.substring(0, maxSnippetLength) + '\n... (truncated)';
        }

        citations.push({
          id: result.id,
          filePath: result.filePath,
          startLine,
          endLine,
          codeSnippet,
          summary: result.summary,
          similarity: result.similarity,
          nodeId: node?.id,
          nodeType,
        });
      } catch (error) {
        this.logger.warn(`Failed to enhance citation for result ${result.id}:`, error);
        // Add basic citation without full details
        citations.push({
          id: result.id,
          filePath: result.filePath,
          startLine: 1,
          endLine: 1,
          codeSnippet: result.chunkText || '',
          summary: result.summary,
          similarity: result.similarity,
        });
      }
    }

    return citations;
  }

  /**
   * Format citations for RAG prompt
   */
  formatCitationsForRAG(citations: Citation[]): string {
    return citations
      .map(
        (citation, index) =>
          `[@${index}] ${citation.filePath}:${citation.startLine}-${citation.endLine} (similarity: ${citation.similarity.toFixed(3)})\n` +
          `Summary: ${citation.summary || 'N/A'}\n` +
          `Code:\n\`\`\`\n${citation.codeSnippet}\n\`\`\``
      )
      .join('\n\n');
  }

  /**
   * Format citations for API response
   */
  formatCitationsForResponse(citations: Citation[]): Array<{
    id: string;
    filePath: string;
    lines: { start: number; end: number };
    code: string;
    summary: string | null;
    similarity: number;
    nodeType?: string;
  }> {
    return citations.map((citation) => ({
      id: citation.id,
      filePath: citation.filePath,
      lines: {
        start: citation.startLine,
        end: citation.endLine,
      },
      code: citation.codeSnippet,
      summary: citation.summary,
      similarity: citation.similarity,
      nodeType: citation.nodeType,
    }));
  }
}

