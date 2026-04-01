import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import OpenAI from 'openai';
import { getSummarizationSystemPrompt, getSummarizationPrompt } from '../prompts';

interface EmbedResponse {
  model: string;
  model_version: string;
  vectors: number[][];
  vector_ids?: string[];
  cached: boolean[];
  timings_ms: number;
}

@Injectable()
export class TensorService {
  private readonly logger = new Logger(TensorService.name);
  private readonly openai: OpenAI | null = null;
  private readonly embeddingModel = 'text-embedding-3-small';
  /** Must match DB column vector(1536). Do not change without migrating the Embedding.vector column. */
  private readonly embeddingDimensions = 1536;
  private readonly chatModel = 'gpt-4o-mini';

  constructor(private readonly config: ConfigService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('OpenAI client initialized');
    } else {
      this.logger.warn('OPENAI_API_KEY not set - AI features will be limited');
    }
  }

  async embed(
    inputs: string[],
    options?: { model?: string; provider?: string }
  ): Promise<EmbedResponse> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();

    try {
      const model = options?.model || this.embeddingModel;
      const response = await this.openai.embeddings.create({
        model,
        input: inputs,
        dimensions: this.embeddingDimensions,
      });

      const vectors = response.data.map((item) => item.embedding);
      const timings_ms = Date.now() - startTime;

      return {
        model: response.model,
        model_version: '1.0',
        vectors,
        cached: new Array(inputs.length).fill(false),
        timings_ms,
      };
    } catch (error) {
      this.logger.error('Failed to generate embeddings:', error);
      throw new Error(
        `Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async sleepMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async summarize(text: string, strict = true, maxTokens = 120): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const maxRetries = 3;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const prompt = getSummarizationPrompt(text, strict, maxTokens);

        const response = await this.openai.chat.completions.create({
          model: this.chatModel,
          messages: [
            {
              role: 'system',
              content: getSummarizationSystemPrompt(strict),
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.3,
        });

        const summary = response.choices[0]?.message?.content || '';
        const confidence = summary.length > 20 ? 0.9 : 0.5;

        return {
          summary,
          content: summary,
          confidence,
          model: response.model,
        };
      } catch (error: any) {
        lastError = error;
        const isRateLimit =
          error?.status === 429 ||
          error?.code === 'rate_limit_exceeded' ||
          (typeof error?.message === 'string' && error.message.includes('429'));
        if (isRateLimit && attempt < maxRetries) {
          const rawMs = error?.headers?.get?.('retry-after-ms') ?? error?.headers?.['retry-after-ms'];
          const rawSec = error?.headers?.get?.('retry-after') ?? error?.headers?.['retry-after'];
          const retryAfterMs =
            (rawMs && parseInt(String(rawMs), 10)) ||
            (rawSec && parseInt(String(rawSec), 10) * 1000) ||
            Math.min(10000 * Math.pow(2, attempt), 60000);
          this.logger.warn(
            `Rate limited (429), retrying in ${Math.round(retryAfterMs / 1000)}s (attempt ${attempt + 1}/${maxRetries + 1})`
          );
          await this.sleepMs(retryAfterMs);
          continue;
        }
        this.logger.error('Failed to summarize:', error);
        throw new Error(
          `Summarization failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    throw new Error(
      `Summarization failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
  }

  async chat(messages: Array<{ role: string; content: string }>, maxTokens?: number): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: this.chatModel,
        messages: messages as any,
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      return {
        content: response.choices[0]?.message?.content || '',
        reply: response.choices[0]?.message?.content || '',
        model: response.model,
      };
    } catch (error) {
      this.logger.error('Chat completion failed:', error);
      throw new Error(`Chat failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
