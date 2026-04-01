import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { TensorService } from '../common/tensor/tensor.service';
import * as crypto from 'crypto';

/** text-embedding-3-small limit is 8191 tokens; ~4 chars/token → truncate to stay under. */
const MAX_EMBED_INPUT_CHARS = 28_000;

/** Must match DB vector(1536) and TensorService.embeddingDimensions. Never store a different size. */
const EXPECTED_VECTOR_DIM = 1536;

@Injectable()
export class EmbeddingWorker {
  private readonly logger = new Logger(EmbeddingWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tensor: TensorService
  ) {}

  async process(job: any) {
    const { repoId, sha, path, nodePath, nodeText, astS3Key, nodeId } = job.data;
    const startTime = Date.now();

    this.logger.log(`Creating embedding for ${path}:${nodePath}`);

    // When SKIP_SUMMARIZATION=true (e.g. over OpenAI rate limit), skip chat API and use local snippet
    const skipSummarization =
      process.env.SKIP_SUMMARIZATION === 'true' || process.env.DISABLE_SUMMARIZATION === 'true';

    try {
      let summary: string;
      let confidence: 'high' | 'medium' | 'low' = 'medium';

      if (skipSummarization) {
        summary = nodeText.substring(0, 200).replace(/\s+/g, ' ').trim() || 'Code snippet';
        confidence = 'low';
      } else {
        try {
          const summaryResponse = await this.tensor.summarize(nodeText, true, 120);
          summary = summaryResponse.summary || summaryResponse.content || '';

          if (summary === 'INSUFFICIENT CONTEXT' || summary.includes('INSUFFICIENT')) {
            this.logger.warn(`Insufficient context for ${nodePath}, marking as low confidence`);
            confidence = 'low';
            summary = summary || 'Insufficient context for summarization';
          } else {
            confidence = summaryResponse.confidence
              ? summaryResponse.confidence > 0.8
                ? 'high'
                : summaryResponse.confidence > 0.5
                  ? 'medium'
                  : 'low'
              : 'medium';
          }
        } catch (error) {
          this.logger.warn(`Failed to summarize, using fallback:`, error);
          summary = nodeText.substring(0, 100);
          confidence = 'low';
        }
      }

      const textToEmbed =
        nodeText.length <= MAX_EMBED_INPUT_CHARS
          ? nodeText
          : nodeText.substring(0, MAX_EMBED_INPUT_CHARS);
      if (textToEmbed.length < nodeText.length) {
        this.logger.warn(
          `Truncated node text for ${nodePath} from ${nodeText.length} to ${MAX_EMBED_INPUT_CHARS} chars (token limit) before embedding`
        );
      }

      let vectorId: string;
      let vector: number[] | null = null;

      try {
        const embedResponse = await this.tensor.embed([textToEmbed]);
        if (embedResponse.vectors && embedResponse.vectors.length > 0) {
          vector = embedResponse.vectors[0];
          vectorId = `vec_${repoId}_${sha}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
          if (vector.length !== EXPECTED_VECTOR_DIM) {
            this.logger.error(
              `Embedding for ${nodePath} has ${vector.length} dimensions; expected ${EXPECTED_VECTOR_DIM}. Refusing to store to avoid dimension mismatch in search.`
            );
            throw new Error(
              `Vector dimensions ${vector.length} do not match expected ${EXPECTED_VECTOR_DIM}`
            );
          }
          this.logger.debug(
            `Generated embedding vector for ${nodePath} (dimensions: ${vector.length})`
          );
        } else {
          this.logger.warn(`No vectors returned from embedding service for ${nodePath}`);
          vectorId = `vec_${repoId}_${sha}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
        }
      } catch (error) {
        this.logger.error(`Failed to generate embedding for ${nodePath}:`, error);
        throw new Error(
          `Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      if (!vector) {
        throw new Error(`No vector generated for ${nodePath}`);
      }

      const embedding = await this.prisma.withRetry(() =>
        this.prisma.embedding.create({
          data: {
            repoId,
            filePath: path,
            nodePath,
            chunkText: nodeText.substring(0, 1000),
            sourceText: nodeText,
            summary,
            vectorId,
            confidence,
            s3AstKey: astS3Key,
            nodeId: nodeId || null,
          },
        })
      );

      if (!embedding.id) {
        throw new Error(`Failed to create embedding record for ${nodePath}`);
      }

      try {
        await this.prisma.storeVector(embedding.id, vector);
        this.logger.debug(`Stored vector in pgvector for ${nodePath}`);

        // Verify vector was stored (do not SELECT vector - Prisma cannot deserialize pgvector type)
        const verifyResult = await this.prisma.withRetry(() =>
          this.prisma.$queryRaw`
            SELECT id FROM "Embedding" WHERE id = ${embedding.id} AND vector IS NOT NULL
          `
        ) as Array<{ id: string }>;
        if (!verifyResult || verifyResult.length === 0) {
          this.logger.error(`Vector verification failed for embedding ${embedding.id}`);
          throw new Error(`Vector was not stored for embedding ${embedding.id}`);
        }
      } catch (error) {
        this.logger.error(`Failed to store vector in pgvector for ${nodePath}:`, error);
        throw error;
      }

      const duration = (Date.now() - startTime) / 1000;
      this.logger.log(`Successfully created embedding for ${path}:${nodePath} in ${duration}s`);
    } catch (error) {
      this.logger.error(`Failed to create embedding for ${path}:${nodePath}:`, error);
      throw error;
    }
  }
}
