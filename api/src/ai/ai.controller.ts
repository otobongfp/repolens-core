import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AIService } from './ai.service';
import { HallucinationDetectionService } from '../common/hallucination/hallucination-detection.service';

@ApiTags('ai')
@Controller('ai')
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly hallucinationDetection: HallucinationDetectionService
  ) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze codebase with AI' })
  async analyzeCodebase(@Body() body: { graphData: any }) {
    return this.aiService.analyzeCodebase(body.graphData);
  }

  @Post('analyze/function')
  @ApiOperation({ summary: 'Analyze function' })
  async analyzeFunction(@Body() body: { functionNode: any; graphData: any }) {
    return this.aiService.analyzeFunction(body.functionNode, body.graphData);
  }

  @Post('ask')
  @Throttle({ strict: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Ask codebase question' })
  async ask(@Body() body: { graphData: any; question: string; repoId?: string }) {
    const answer = await this.aiService.answerQuestion(body.graphData, body.question);
    
    // Validate response for hallucinations if repoId provided
    if (body.repoId && answer.answer) {
      const validation = await this.hallucinationDetection.detectHallucination(
        answer.answer,
        body.repoId,
        body.question
      );
      
      return {
        ...answer,
        validation,
      };
    }
    
    return answer;
  }

  @Get('status')
  @ApiOperation({ summary: 'Get AI service status' })
  async getStatus() {
    return this.aiService.getStatus();
  }
}

