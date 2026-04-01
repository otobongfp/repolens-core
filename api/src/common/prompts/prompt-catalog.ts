export interface PromptCatalogEntry {
  id: string;
  module: 'requirements' | 'tensor' | 'ai' | 'search';
  kind: 'system' | 'user-template';
  source: string;
  usedBy: string[];
  description: string;
}

/**
 * Single inventory of all prompt templates used by the backend.
 * Keep this list updated whenever adding or removing prompts.
 */
export const PROMPT_CATALOG: PromptCatalogEntry[] = [
  {
    id: 'requirements.system.extraction',
    module: 'requirements',
    kind: 'system',
    source: 'common/prompts/requirements.prompts.ts',
    usedBy: ['requirements/requirements.service.ts'],
    description: 'System instructions for extracting requirements from uploaded documents.',
  },
  {
    id: 'requirements.user.extraction',
    module: 'requirements',
    kind: 'user-template',
    source: 'common/prompts/requirements.prompts.ts',
    usedBy: ['requirements/requirements.service.ts'],
    description: 'Main user prompt template containing extraction rules and JSON output schema.',
  },
  {
    id: 'tensor.system.summarization.strict',
    module: 'tensor',
    kind: 'system',
    source: 'common/prompts/tensor.prompts.ts',
    usedBy: ['common/tensor/tensor.service.ts'],
    description: 'Strict factual summarization instructions for code snippets.',
  },
  {
    id: 'tensor.system.summarization.relaxed',
    module: 'tensor',
    kind: 'system',
    source: 'common/prompts/tensor.prompts.ts',
    usedBy: ['common/tensor/tensor.service.ts'],
    description: 'Concise summarization instructions for non-strict mode.',
  },
  {
    id: 'tensor.user.summarization',
    module: 'tensor',
    kind: 'user-template',
    source: 'common/prompts/tensor.prompts.ts',
    usedBy: ['common/tensor/tensor.service.ts'],
    description: 'User prompt template for summarizing code text.',
  },
  {
    id: 'ai.system.codebase-analysis',
    module: 'ai',
    kind: 'system',
    source: 'common/prompts/ai.prompts.ts',
    usedBy: ['ai/ai.service.ts'],
    description: 'System prompt for high-level codebase analysis.',
  },
  {
    id: 'ai.user.codebase-analysis',
    module: 'ai',
    kind: 'user-template',
    source: 'common/prompts/ai.prompts.ts',
    usedBy: ['ai/ai.service.ts'],
    description: 'User template for codebase structure analysis output.',
  },
  {
    id: 'ai.system.function-analysis',
    module: 'ai',
    kind: 'system',
    source: 'common/prompts/ai.prompts.ts',
    usedBy: ['ai/ai.service.ts'],
    description: 'System prompt for function-level analysis.',
  },
  {
    id: 'ai.user.function-analysis',
    module: 'ai',
    kind: 'user-template',
    source: 'common/prompts/ai.prompts.ts',
    usedBy: ['ai/ai.service.ts'],
    description: 'User template for function analysis including context.',
  },
  {
    id: 'ai.system.question-answering',
    module: 'ai',
    kind: 'system',
    source: 'common/prompts/ai.prompts.ts',
    usedBy: ['ai/ai.service.ts'],
    description: 'System prompt for answering repository questions.',
  },
  {
    id: 'ai.user.question-answering',
    module: 'ai',
    kind: 'user-template',
    source: 'common/prompts/ai.prompts.ts',
    usedBy: ['ai/ai.service.ts'],
    description: 'User template for question + context QA flow.',
  },
  {
    id: 'search.user.rag',
    module: 'search',
    kind: 'user-template',
    source: 'common/prompts/search.prompts.ts',
    usedBy: ['search/search.service.ts'],
    description: 'RAG response format prompt with citation constraints.',
  },
];

