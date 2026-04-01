export const REQUIREMENTS_SYSTEM_PROMPT = `You are a requirements extraction assistant. Extract requirements ONLY if they are explicitly listed, numbered, or bulleted in the document content provided. Be precise, factual, and maintain a 1:1 mapping with the document's structure. Do NOT generate summaries or extra requirements that are not explicitly in the document. Return a JSON array of requirements.`;

export const getRequirementsExtractionPrompt = (documentContent: string) => {
  const truncatedContent = documentContent.substring(0, 15000) + 
    (documentContent.length > 15000 ? '\n\n[... document continues ...]' : '');

  return `You are a requirements extraction assistant. Extract ALL requirements from the following document. 

IMPORTANT: 
- Extract requirements ONLY from the document content provided below. 
- Stick strictly to the number of requirements explicitly stated or listed in the document. Do NOT generate extra requirements.
- If the document uses a numbering scheme (e.g., 1.1, 1.2 or FR-1, FR-2), preserve those IDs or titles.
- Do NOT generate generic, example, or "implied" requirements that aren't actually there.

For each requirement found in the document, provide:
1. A clear title matching the document's heading or numbering if available.
2. The exact requirement text from the document.
3. Whether it's a feature requirement or a suggestion.
4. Priority level (high, medium, low) - infer only if not explicitly stated.
5. Estimated complexity (simple, moderate, complex).

Document Content:
${truncatedContent}

Format your response as a JSON array with this structure:
[
  {
    "title": "Requirement title from document",
    "text": "Exact requirement text from document",
    "type": "feature" or "suggestion",
    "priority": "high" or "medium" or "low",
    "complexity": "simple" or "moderate" or "complex"
  }
]

If no requirements are found in the document, return an empty array [].`;
};
