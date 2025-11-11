import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { ConfigService } from '../common/config/config.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async search(query: string, repoId?: string): Promise<any[]> {
    this.logger.log(`Searching for: ${query}`);

    return this.prisma.embedding.findMany({
      where: repoId ? { repoId } : {},
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchWithRAG(query: string, repoId?: string): Promise<string> {
    const results = await this.search(query, repoId);

    const context = results
      .map(
        (r, i) =>
          `[@${i}] repo:${repoId} | path:${r.filePath} | summary: "${r.summary}" | snippet: "${r.chunkText}"`
      )
      .join('\n');

    const prompt = `System: You are a code assistant. Use ONLY the CONTEXT blocks (@) provided below to answer. Cite blocks inline like [@1]. If you cannot answer using only the provided contexts, reply: "INSUFFICIENT CONTEXT. Recommend specific files or symbols to inspect: <list>."

User question: ${query}

Context:
${context}

Assistant:`;

    return prompt;
  }
}
