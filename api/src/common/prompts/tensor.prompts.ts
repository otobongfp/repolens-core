export const getSummarizationSystemPrompt = (strict: boolean) => {
  return strict
    ? 'You are a code summarization assistant. Provide factual, concise summaries of code. Only describe what the code does, not what it might do. Avoid speculation.'
    : 'You are a code summarization assistant. Provide concise summaries of code.';
};

export const getSummarizationPrompt = (text: string, strict: boolean, maxTokens: number) => {
  const truncatedText = text.substring(0, 4000);
  return strict
    ? `Summarize the following code in a factual, concise way (max ${maxTokens} tokens). Focus only on what the code does, not what it might do. Be precise and avoid speculation.

Code:
${truncatedText}`
    : `Summarize the following code (max ${maxTokens} tokens):

${truncatedText}`;
};
