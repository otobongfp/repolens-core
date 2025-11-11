"""Anthropic adapter implementation"""
import asyncio
from typing import List, Dict

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

from app.adapters.base import BaseAdapter

class AnthropicAdapter(BaseAdapter):
    """Anthropic Claude API adapter"""
    
    def __init__(self, api_key: str):
        if not ANTHROPIC_AVAILABLE:
            raise RuntimeError("Anthropic package not installed")
        self.client = anthropic.Anthropic(api_key=api_key)
    
    def name(self) -> str:
        return "anthropic/claude-3-haiku"
    
    def version(self) -> str:
        return "anthropic-v1"
    
    async def embed_batch(self, inputs: List[str]) -> List[List[float]]:
        """Anthropic doesn't provide embeddings API"""
        raise NotImplementedError("Anthropic embeddings not available")
    
    async def summarize(self, text: str, strict: bool = True, max_tokens: int = 120) -> Dict:
        """Generate summary using Claude"""
        loop = asyncio.get_event_loop()
        
        def _call():
            system_prompt = (
                f"You are a strict summarizer. Produce a single-sentence factual summary "
                f"(max {max_tokens} words) that is directly supported by the text. "
                "If insufficient context, respond: 'INSUFFICIENT CONTEXT'."
            )
            
            message = self.client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": text}]
            )
            
            summary = message.content[0].text.strip()
            confidence = 0.85 if "INSUFFICIENT CONTEXT" not in summary else 0.0
            
            return {"summary": summary, "confidence": confidence}
        
        return await loop.run_in_executor(None, _call)
    
    async def chat(self, messages: List[Dict[str, str]], max_tokens: int = None) -> Dict:
        """LLM chat using Claude"""
        loop = asyncio.get_event_loop()
        
        def _call():
            message = self.client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=max_tokens or 4096,
                messages=messages
            )
            return {"reply": message.content[0].text}
        
        return await loop.run_in_executor(None, _call)

