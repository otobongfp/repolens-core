import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { McpService } from './mcp.service';

@ApiTags('mcp')
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Get('/tools')
  @ApiOperation({ summary: 'List available MCP tools' })
  listTools() {
    return {
      tools: this.mcpService.listTools(),
    };
  }

  @Post('/tools/call')
  @ApiOperation({ summary: 'Call an MCP tool' })
  async callTool(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      arguments: Record<string, any>;
    }
  ) {
    const user = { id: 'core-user', tenantId: null };

    if (!body.name || !body.arguments) {
      throw new Error('name and arguments are required');
    }

    try {
      const result = await this.mcpService.callTool(user, {
        name: body.name,
        arguments: body.arguments,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: error instanceof Error ? error.message : String(error),
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  @Get('/health')
  @ApiOperation({ summary: 'MCP server health check' })
  health() {
    return {
      status: 'ok',
      service: 'repolens-mcp',
      version: '1.0.0',
    };
  }
}
