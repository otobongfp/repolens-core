import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AIService } from './ai.service';

@ApiTags('ai')
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

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
  @ApiOperation({ summary: 'Ask codebase question' })
  async ask(@Body() body: { graphData: any; question: string }) {
    return this.aiService.answerQuestion(body.graphData, body.question);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get AI service status' })
  async getStatus() {
    return this.aiService.getStatus();
  }
}

