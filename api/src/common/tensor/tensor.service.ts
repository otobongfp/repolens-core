/**
 * Tensor Service Client
 * HTTP client for communicating with Tensor AI inference service
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

interface EmbedRequest {
  model?: string;
  provider?: string;
  inputs: string[];
  job_id?: string;
  meta?: Record<string, any>;
}

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
  private readonly tensorUrl: string;
  private readonly tensorApiKey: string;

  constructor(private readonly config: ConfigService) {
    this.tensorUrl = process.env.TENSOR_URL || 'http://localhost:8080';
    this.tensorApiKey = process.env.TENSOR_API_KEY || 'dev-key-change-me';
  }

  async embed(
    inputs: string[],
    options?: { model?: string; provider?: string }
  ): Promise<EmbedResponse> {
    const request: EmbedRequest = {
      inputs,
      model: options?.model || 'auto',
      provider: options?.provider,
    };

    const response = await fetch(`${this.tensorUrl}/v1/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.tensorApiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Tensor service error: ${text}`);
    }

    return response.json();
  }

  async summarize(text: string, strict = true, maxTokens = 120): Promise<any> {
    const response = await fetch(`${this.tensorUrl}/v1/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.tensorApiKey}`,
      },
      body: JSON.stringify({ text, strict, max_tokens: maxTokens }),
    });

    if (!response.ok) {
      throw new Error('Summarization failed');
    }

    return response.json();
  }

  async chat(messages: Array<{ role: string; content: string }>, maxTokens?: number): Promise<any> {
    const response = await fetch(`${this.tensorUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.tensorApiKey}`,
      },
      body: JSON.stringify({ messages, max_tokens: maxTokens }),
    });

    if (!response.ok) {
      throw new Error('Chat failed');
    }

    return response.json();
  }
}
