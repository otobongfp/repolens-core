import { Injectable } from '@nestjs/common';
import { ConfigService } from '../common/config/config.service';

@Injectable()
export class AIService {
  constructor(private readonly configService: ConfigService) {}

  async analyzeCodebase(graphData: any) {
    const pythonServiceUrl = this.configService.getPythonAiServiceUrl();
    return { message: 'AI analysis not implemented yet' };
  }

  async analyzeFunction(functionNode: any, graphData: any) {
    return { message: 'Function analysis not implemented yet' };
  }

  async answerQuestion(graphData: any, question: string) {
    return { message: 'Question answering not implemented yet', answer: '' };
  }

  async getStatus() {
    return {
      available: true,
      serviceUrl: this.configService.getPythonAiServiceUrl(),
    };
  }
}

