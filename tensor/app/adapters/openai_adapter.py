"""OpenAI adapter implementation"""
import asyncio
from typing import List, Dict

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

from app.adapters.base import BaseAdapter

class OpenAIAdapter(BaseAdapter):
    """OpenAI API adapter for embeddings and chat"""
    
    def __init__(self, api_key: str):
        if not OPENAI_AVAILABLE:
            raise RuntimeError("OpenAI package not installed")
        self.client = openai.OpenAI(api_key=api_key)
    
    def name(self) -> str:
        return "openai/text-embedding-3-small"
    
    def version(self) -> str:
        return "openai-v1"
    
    async def embed_batch(self, inputs: List[str]) -> List[List[float]]:
        """Generate embeddings using OpenAI API"""
        loop = asyncio.get_event_loop()
        
        def _call():
            response = self.client.embeddings.create(
                model="text-embedding-3-small",
                input=inputs
            )
            return [item.embedding for item in response.data]
        
        return await loop.run_in_executor(None, _call)
    
    async def summarize(self, text: str, strict: bool = True, max_tokens: int = 120) -> Dict:
        """Generate summary using GPT-4o-mini"""
        loop = asyncio.get_event_loop()
        
        def _call():
            system_prompt = (
                f"You are a strict summarizer. Produce a single-sentence factual summary "
                f"(max {max_tokens} words) that is directly supported by the text and "
                "contains no new information. If the text does not contain enough "
                "information, respond: 'INSUFFICIENT CONTEXT'."
            )
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                max_tokens=max_tokens,
                temperature=0.0
            )
            
            summary = response.choices[0].message.content.strip()
            confidence = 0.9 if "INSUFFICIENT CONTEXT" not in summary else 0.0
            
            return {"summary": summary, "confidence": confidence}
        
        return await loop.run_in_executor(None, _call)
    
    async def chat(self, messages: List[Dict[str, str]], max_tokens: int = None) -> Dict:
        """LLM chat using OpenAI"""
        loop = asyncio.get_event_loop()
        
        def _call():
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.1
            )
            return {"reply": response.choices[0].message.content}
        
        return await loop.run_in_executor(None, _call)

