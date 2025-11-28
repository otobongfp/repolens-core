import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SearchService } from './search.service';
import { HallucinationDetectionService } from '../common/hallucination/hallucination-detection.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly hallucinationDetection: HallucinationDetectionService
  ) {}

  @Post()
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Search codebase with semantic search' })
  @ApiResponse({ status: 200, description: 'Search results with citations' })
  async search(
    @Body() body: { query: string; repoId?: string; limit?: number }
  ) {
    return this.searchService.searchWithCitations(
      body.query,
      body.repoId,
      body.limit || 10
    );
  }

  @Post('rag')
  @Throttle({ strict: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Generate RAG prompt for AI' })
  @ApiResponse({ status: 200, description: 'RAG prompt with citations' })
  async searchWithRAG(
    @Body() body: { query: string; repoId?: string; useVectorSearch?: boolean }
  ) {
    const prompt = await this.searchService.searchWithRAG(
      body.query,
      body.repoId,
      body.useVectorSearch !== false
    );
    return { prompt };
  }

  @Post('validate')
  @Throttle({ strict: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Validate AI response for hallucinations' })
  @ApiResponse({ status: 200, description: 'Hallucination detection results' })
  async validateResponse(
    @Body() body: { response: string; repoId?: string; query?: string }
  ) {
    return this.hallucinationDetection.detectHallucination(
      body.response,
      body.repoId,
      body.query
    );
  }
}

