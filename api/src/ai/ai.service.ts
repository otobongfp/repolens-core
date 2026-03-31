import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../common/config/config.service';
import { TensorService } from '../common/tensor/tensor.service';
import { SearchService } from '../search/search.service';
import { PrismaService } from '../common/database/prisma.service';
import {
  CODEBASE_ANALYSIS_SYSTEM_PROMPT,
  getCodebaseAnalysisPrompt,
  FUNCTION_ANALYSIS_SYSTEM_PROMPT,
  getFunctionAnalysisPrompt,
  QUESTION_ANSWERING_SYSTEM_PROMPT,
  getQuestionAnsweringPrompt,
} from '../common/prompts';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly tensor: TensorService,
    private readonly search: SearchService,
    private readonly prisma: PrismaService
  ) {}

  async analyzeCodebase(graphData: any) {
    this.logger.log('Analyzing codebase');

    try {
      const summary = this.extractGraphSummary(graphData);

      const analysisPrompt = getCodebaseAnalysisPrompt(summary);

      const response = await this.tensor.chat([
        {
          role: 'system',
          content: CODEBASE_ANALYSIS_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ]);

      return {
        analysis: response.content || response.reply,
        summary,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Codebase analysis failed:', error);
      return {
        message: 'Analysis failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async analyzeFunction(functionNode: any, graphData: any) {
    this.logger.log(`Analyzing function: ${functionNode.name || 'unknown'}`);

    try {
      const functionCode = functionNode.text || functionNode.code || '';
      const context = this.getFunctionContext(functionNode, graphData);

      const analysisPrompt = getFunctionAnalysisPrompt(functionCode, context);

      const response = await this.tensor.chat([
        {
          role: 'system',
          content: FUNCTION_ANALYSIS_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ]);

      return {
        functionName: functionNode.name || 'unknown',
        analysis: response.content || response.reply,
        context,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Function analysis failed:', error);
      return {
        message: 'Function analysis failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async answerQuestion(graphData: any, question: string, repoId?: string) {
    this.logger.log(`Answering question: ${question.substring(0, 50)}...`);

    try {
      let context = '';
      if (repoId) {
        try {
          const ragPrompt = await this.search.searchWithRAG(question, repoId, true);
          context = ragPrompt;
        } catch (error) {
          this.logger.warn('RAG search failed, using graph data only:', error);
          context = this.extractGraphSummary(graphData);
        }
      } else {
        context = this.extractGraphSummary(graphData);
      }

      const response = await this.tensor.chat([
        {
          role: 'system',
          content: QUESTION_ANSWERING_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: getQuestionAnsweringPrompt(question, context),
        },
      ]);

      return {
        answer: response.content || response.reply,
        question,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Question answering failed:', error);
      return {
        message: 'Question answering failed',
        answer: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getStatus() {
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    return {
      available: hasApiKey,
      serviceUrl: 'OpenAI API',
      model: hasApiKey ? 'gpt-4o-mini' : 'not configured',
    };
  }

  private extractGraphSummary(graphData: any): string {
    if (!graphData) return 'No graph data provided';

    try {
      const nodes = graphData.nodes || [];
      const edges = graphData.edges || [];
      const functions = nodes.filter((n: any) => n.type === 'function' || n.type === 'method');
      const classes = nodes.filter((n: any) => n.type === 'class');

      return `Codebase Summary:
- Total nodes: ${nodes.length}
- Functions/Methods: ${functions.length}
- Classes: ${classes.length}
- Relationships: ${edges.length}
- Languages: ${this.extractLanguages(nodes)}`;
    } catch (error) {
      return 'Graph data structure unknown';
    }
  }

  private extractLanguages(nodes: any[]): string {
    const languages = new Set<string>();
    nodes.forEach((node: any) => {
      if (node.filePath) {
        const ext = node.filePath.split('.').pop()?.toLowerCase();
        if (ext) {
          const langMap: Record<string, string> = {
            js: 'JavaScript',
            ts: 'TypeScript',
            py: 'Python',
            java: 'Java',
            go: 'Go',
            rs: 'Rust',
            cpp: 'C++',
            c: 'C',
          };
          if (langMap[ext]) {
            languages.add(langMap[ext]);
          }
        }
      }
    });
    return Array.from(languages).join(', ') || 'Unknown';
  }

  private getFunctionContext(functionNode: any, graphData: any): string {
    if (!graphData || !graphData.edges) return 'No context available';

    try {
      const relatedEdges = graphData.edges.filter(
        (e: any) => e.from === functionNode.id || e.to === functionNode.id
      );
      const relatedNodes = relatedEdges
        .map((e: any) => {
          const nodeId = e.from === functionNode.id ? e.to : e.from;
          return graphData.nodes?.find((n: any) => n.id === nodeId);
        })
        .filter(Boolean);

      return `Related components: ${relatedNodes.length}\nDependencies: ${relatedEdges.length}`;
    } catch (error) {
      return 'Context extraction failed';
    }
  }
}
