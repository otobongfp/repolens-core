export const CODEBASE_ANALYSIS_SYSTEM_PROMPT = `You are a codebase analysis expert. Analyze code structures and provide actionable insights.`;

export const getCodebaseAnalysisPrompt = (summary: string) => {
  return `Analyze this codebase structure and provide insights:

${summary}

Provide:
1. Overall architecture description
2. Key components and their relationships
3. Potential issues or improvements
4. Technology stack identification`;
};

export const FUNCTION_ANALYSIS_SYSTEM_PROMPT = `You are a code analysis expert. Analyze functions and provide detailed insights.`;

export const getFunctionAnalysisPrompt = (functionCode: string, context: string) => {
  return `Analyze this function and provide insights:

Function Code:
${functionCode.substring(0, 2000)}

Context:
${context}

Provide:
1. What this function does
2. Parameters and return values
3. Dependencies and relationships
4. Potential issues or improvements
5. Test suggestions`;
};

export const QUESTION_ANSWERING_SYSTEM_PROMPT = `You are a code assistant. Answer questions about the codebase using the provided context. Be precise and cite specific code locations when possible.`;

export const getQuestionAnsweringPrompt = (question: string, context: string) => {
  return `Question: ${question}\n\nContext:\n${context}`;
};
