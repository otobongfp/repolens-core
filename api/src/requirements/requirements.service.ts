import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { TensorService } from '../common/tensor/tensor.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class RequirementsService {
  private readonly logger = new Logger(RequirementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tensor: TensorService,
    private readonly search: SearchService,
  ) {}

  async extractRequirements(documentContent: string, projectId?: string) {
    this.logger.log(`Extracting requirements for project ${projectId}`);

    try {
      // Use Tensor service to extract requirements from document
      const extractionPrompt = `Extract requirements from the following document. 
For each requirement, provide:
1. A clear title (max 10 words)
2. The requirement text
3. Whether it's a feature requirement or a suggestion

Document:
${documentContent}

Format as JSON array with: {title, text, type: "feature"|"suggestion"}`;

      const chatResponse = await this.tensor.chat([
        {
          role: 'system',
          content:
            'You are a requirements extraction assistant. Extract requirements from documents and format them as JSON.',
        },
        { role: 'user', content: extractionPrompt },
      ]);

      // Parse extracted requirements
      let extractedRequirements: Array<{
        title: string;
        text: string;
        type: 'feature' | 'suggestion';
      }> = [];

      try {
        // Try to parse JSON from response
        const responseText = chatResponse.content || JSON.stringify(chatResponse);
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          extractedRequirements = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: create single requirement
          extractedRequirements = [
            {
              title: 'Extracted Requirement',
              text: documentContent.substring(0, 500),
              type: 'feature' as const,
            },
          ];
        }
      } catch (parseError) {
        this.logger.warn('Failed to parse extracted requirements, using fallback');
        extractedRequirements = [
          {
            title: 'Extracted Requirement',
            text: documentContent.substring(0, 500),
            type: 'feature' as const,
          },
        ];
      }

      // Create requirement records
      const requirements = await Promise.all(
        extractedRequirements.map((req) =>
          this.prisma.requirement.create({
            data: {
              title: req.title,
              text: req.text,
              type: req.type || 'feature',
              status: req.type === 'suggestion' ? 'pending' : 'accepted', // Suggestions need approval
              projectId: projectId || null,
              confidence: 'medium',
            },
          }),
        ),
      );

      // Generate embeddings for requirements
      for (const req of requirements) {
        try {
          const embedResponse = await this.tensor.embed([req.text]);
          if (embedResponse.vectors && embedResponse.vectors.length > 0) {
            // Store vector ID (in production, store in pgvector)
            await this.prisma.requirement.update({
              where: { id: req.id },
              data: {
                vectorId: `req_${req.id}_${Date.now()}`,
              },
            });
          }
        } catch (embedError) {
          this.logger.warn(`Failed to embed requirement ${req.id}:`, embedError);
        }
      }

      return {
        message: `Extracted ${requirements.length} requirement(s)`,
        requirementId: requirements[0]?.id,
        requirements,
      };
    } catch (error) {
      this.logger.error('Failed to extract requirements:', error);
      // Fallback: create single requirement
      const requirement = await this.prisma.requirement.create({
        data: {
          title: 'Extracted Requirement',
          text: documentContent,
          type: 'feature',
          status: 'accepted',
          projectId: projectId || null,
          confidence: 'low',
        },
      });

      return {
        message: 'Requirements extraction completed (fallback mode)',
        requirementId: requirement.id,
        requirements: [requirement],
      };
    }
  }

  async matchRequirements(requirementId: string, projectId?: string) {
    this.logger.log(`Matching requirement ${requirementId} for project ${projectId}`);

    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
    });

    if (!requirement) {
      return { message: 'Requirement not found', matches: [] };
    }

    try {
      // Get project repositories to find matching code
      let repoIds: string[] = [];

      if (projectId) {
        const project = await this.prisma.project.findUnique({
          where: { id: projectId },
          include: { repositories: true },
        });

        if (project) {
          // Get Repo IDs from Repository records (need to map Repository to Repo)
          // For now, search all repos - in production, map Repository.url to Repo.url
          const allRepos = await this.prisma.repo.findMany({
            where: project.repositories.length > 0
              ? {
                  url: {
                    in: project.repositories
                      .map((r) => r.url)
                      .filter((url) => url !== null) as string[],
                  },
                }
              : {},
          });
          repoIds = allRepos.map((r) => r.id);
        }
      } else if (requirement.repoId) {
        repoIds = [requirement.repoId];
      }

      // Get embeddings for the requirement
      const requirementEmbedding = requirement.vectorId
        ? await this.getRequirementEmbedding(requirement.id)
        : null;

      if (!requirementEmbedding) {
        // Generate embedding if not exists
        const embedResponse = await this.tensor.embed([requirement.text]);
        if (embedResponse.vectors && embedResponse.vectors.length > 0) {
          // Store and use for matching
          await this.prisma.requirement.update({
            where: { id: requirement.id },
            data: { vectorId: `req_${requirement.id}_${Date.now()}` },
          });
        }
      }

      // Search for matching code nodes using semantic similarity
      const matchingNodes = await this.findMatchingNodes(
        requirement.text,
        repoIds,
      );

      // Create RequirementMatch records
      const matches = await Promise.all(
        matchingNodes.map(async (node) => {
          const matchScore = node.similarity || 0.5;
          const matchTypes: string[] = [];

          // Determine match types
          if (node.symbolMatch) matchTypes.push('symbol');
          if (matchScore > 0.7) matchTypes.push('semantic');
          if (node.structuralMatch) matchTypes.push('structural');

          const confidence =
            matchScore > 0.8 ? 'high' : matchScore > 0.6 ? 'medium' : 'low';

          return this.prisma.requirementMatch.upsert({
            where: {
              requirementId_nodeId: {
                requirementId: requirement.id,
                nodeId: node.nodeId,
              },
            },
            create: {
              requirementId: requirement.id,
              nodeId: node.nodeId,
              matchScore,
              matchTypes,
              confidence,
            },
            update: {
              matchScore,
              matchTypes,
              confidence,
            },
          });
        }),
      );

      return {
        message: `Found ${matches.length} matching code sections`,
        requirementId,
        matches: matches.map((m) => ({
          id: m.id,
          nodeId: m.nodeId,
          matchScore: m.matchScore,
          matchTypes: m.matchTypes,
          confidence: m.confidence,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to match requirements:', error);
      return {
        message: 'Requirement matching failed',
        requirementId,
        matches: [],
      };
    }
  }

  private async findMatchingNodes(
    requirementText: string,
    repoIds: string[],
  ): Promise<
    Array<{
      nodeId: string;
      similarity: number;
      symbolMatch?: boolean;
      structuralMatch?: boolean;
    }>
  > {
    // Generate embedding for requirement
    const embedResponse = await this.tensor.embed([requirementText]);
    if (!embedResponse.vectors || embedResponse.vectors.length === 0) {
      return [];
    }

    const requirementVector = embedResponse.vectors[0];

    // Get all embeddings for the repos
    const embeddings = await this.prisma.embedding.findMany({
      where: repoIds.length > 0 ? { repoId: { in: repoIds } } : {},
      include: { node: true },
      take: 1000, // Limit for performance
    });

    // Calculate cosine similarity (simplified - in production use pgvector)
    const similarities = embeddings
      .map((emb) => {
        // For now, use text similarity as placeholder
        // In production, calculate cosine similarity between vectors
        const textSimilarity = this.calculateTextSimilarity(
          requirementText,
          emb.summary || emb.chunkText,
        );

        return {
          nodeId: emb.nodeId || '',
          similarity: textSimilarity,
          symbolMatch: this.checkSymbolMatch(requirementText, emb),
          structuralMatch: false,
        };
      })
      .filter((s) => s.similarity > 0.3) // Threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20); // Top 20 matches

    return similarities;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\W+/));
    const words2 = new Set(text2.toLowerCase().split(/\W+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private checkSymbolMatch(requirementText: string, embedding: any): boolean {
    // Check if requirement mentions symbols from the code
    const requirementWords = requirementText.toLowerCase().split(/\W+/);
    const codeText = (embedding.summary || embedding.chunkText || '').toLowerCase();

    // Simple check: if requirement words appear in code
    return requirementWords.some((word) => word.length > 3 && codeText.includes(word));
  }

  private async getRequirementEmbedding(requirementId: string): Promise<number[] | null> {
    // In production, retrieve from vector DB using vectorId
    // For now, return null to trigger regeneration
    return null;
  }

  async verifyMatch(matchId: string, status: string) {
    const match = await this.prisma.requirementMatch.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return { message: 'Match not found', matchId, status };
    }

    // Update match with verification
    const updatedMatch = await this.prisma.requirementMatch.update({
      where: { id: matchId },
      data: {
        matchTypes: match.matchTypes.includes('verified')
          ? match.matchTypes
          : [...match.matchTypes, 'verified'],
        confidence: status === 'verified' ? 'high' : match.confidence,
        verificationTrace: {
          verified: status === 'verified',
          verifiedAt: new Date().toISOString(),
        },
      },
    });

    return {
      message: 'Match verification updated',
      matchId: updatedMatch.id,
      status,
    };
  }

  async getProjectRequirements(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        repositories: true,
      },
    });

    if (!project) {
      return { requirements: [], completionPercentage: 0 };
    }

    // Get requirements linked to project
    const requirements = await this.prisma.requirement.findMany({
      where: {
        projectId: projectId,
      },
      include: {
        requirementMatches: {
          include: {
            node: true,
          },
        },
      },
    });

    // Calculate completion percentage
    const completionPercentage = this.calculateCompletionPercentage(requirements);

    return {
      requirements,
      count: requirements.length,
      completionPercentage,
    };
  }

  async updateRequirementStatus(requirementId: string, status: 'accepted' | 'rejected') {
    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
    });

    if (!requirement) {
      throw new Error('Requirement not found');
    }

    const updated = await this.prisma.requirement.update({
      where: { id: requirementId },
      data: { status },
    });

    return {
      message: `Requirement ${status}`,
      requirement: updated,
    };
  }

  private calculateCompletionPercentage(requirements: any[]): number {
    if (requirements.length === 0) return 0;

    // Only count accepted requirements for completion
    const acceptedRequirements = requirements.filter(
      (r) => r.status === 'accepted' || r.type === 'feature',
    );

    if (acceptedRequirements.length === 0) return 0;

    let totalScore = 0;
    let totalWeight = 0;

    for (const req of acceptedRequirements) {
      const matches = req.requirementMatches || [];
      const weight = 1; // Equal weight for all requirements

      if (matches.length === 0) {
        totalScore += 0;
      } else {
        // Calculate average match score for this requirement
        const avgScore =
          matches.reduce((sum: number, m: any) => sum + m.matchScore, 0) /
          matches.length;
        totalScore += avgScore;
      }

      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
  }
}
