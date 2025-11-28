import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { TensorService } from '../common/tensor/tensor.service';
import * as crypto from 'crypto';

@Injectable()
export class EmbeddingWorker {
  private readonly logger = new Logger(EmbeddingWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tensor: TensorService,
  ) {}

  async process(job: any) {
    const { repoId, sha, path, nodePath, nodeText, astS3Key, nodeId } = job.data;
    const startTime = Date.now();

    this.logger.log(`Creating embedding for ${path}:${nodePath}`);

    try {
      // Create factual summary using Tensor service
      let summary: string;
      let confidence: 'high' | 'medium' | 'low' = 'medium';

      try {
        const summaryResponse = await this.tensor.summarize(nodeText, true, 120);
        summary = summaryResponse.summary || summaryResponse.content || '';
        
        if (summary === 'INSUFFICIENT CONTEXT' || summary.includes('INSUFFICIENT')) {
          this.logger.warn(`Insufficient context for ${nodePath}, marking as low confidence`);
          confidence = 'low';
          summary = summary || 'Insufficient context for summarization';
        } else {
          confidence = summaryResponse.confidence 
            ? (summaryResponse.confidence > 0.8 ? 'high' : summaryResponse.confidence > 0.5 ? 'medium' : 'low')
            : 'medium';
        }
      } catch (error) {
        this.logger.warn(`Failed to summarize, using fallback:`, error);
        summary = nodeText.substring(0, 100);
        confidence = 'low';
      }

      // Create embedding using Tensor service
      let vectorId: string | null = null;
      let vector: number[] | null = null;
      
      try {
        const embedResponse = await this.tensor.embed([nodeText]);
        if (embedResponse.vectors && embedResponse.vectors.length > 0) {
          vector = embedResponse.vectors[0];
          vectorId = `vec_${repoId}_${sha}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
          this.logger.debug(`Generated embedding vector for ${nodePath} (dimensions: ${vector.length})`);
        }
      } catch (error) {
        this.logger.warn(`Failed to generate embedding:`, error);
        // Continue without vector - can be generated later
      }

      // Store in database
      const embedding = await this.prisma.embedding.create({
        data: {
          repoId,
          filePath: path,
          nodePath,
          chunkText: nodeText.substring(0, 1000), // Store truncated version
          sourceText: nodeText,
          summary,
          vectorId,
          confidence,
          s3AstKey: astS3Key,
          nodeId: nodeId || null,
        },
      });

      // Store vector in pgvector if available
      if (vector && embedding.id) {
        try {
          await this.prisma.storeVector(embedding.id, vector);
          this.logger.debug(`Stored vector in pgvector for ${nodePath}`);
        } catch (error) {
          this.logger.warn(`Failed to store vector in pgvector, continuing without:`, error);
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      this.logger.log(`Successfully created embedding for ${path}:${nodePath} in ${duration}s`);
    } catch (error) {
      this.logger.error(`Failed to create embedding for ${path}:${nodePath}:`, error);
      throw error;
    }
  }
}
