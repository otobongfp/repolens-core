"""Local adapter using sentence-transformers"""
import asyncio
from typing import List, Dict

try:
    from sentence_transformers import SentenceTransformer
    LOCAL_AVAILABLE = True
except ImportError:
    LOCAL_AVAILABLE = False

from app.adapters.base import BaseAdapter

class LocalAdapter(BaseAdapter):
    """Local adapter using sentence-transformers for embeddings"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        if not LOCAL_AVAILABLE:
            raise RuntimeError("sentence-transformers not installed")
        self.model = SentenceTransformer(model_name)
        self._name = f"local/{model_name}"
    
    def name(self) -> str:
        return self._name
    
    def version(self) -> str:
        return "local-v1"
    
    async def embed_batch(self, inputs: List[str]) -> List[List[float]]:
        """Generate embeddings using local model"""
        loop = asyncio.get_event_loop()
        
        def _call():
            embeddings = self.model.encode(
                inputs,
                show_progress_bar=False,
                convert_to_numpy=True
            )
            return embeddings.tolist()
        
        return await loop.run_in_executor(None, _call)
    
    async def summarize(self, text: str, strict: bool = True, max_tokens: int = 120) -> Dict:
        """Simple local summarization (naive truncation)"""
        text_clean = text.strip().replace("\n", " ")
        
        if len(text_clean) > max_tokens * 10:
            text_clean = text_clean[:max_tokens * 10]
        
        summary = text_clean.split(".")[0][:max_tokens].strip()
        
        if strict and len(summary) < 10:
            return {"summary": "INSUFFICIENT CONTEXT", "confidence": 0.0}
        
        return {"summary": summary, "confidence": 0.5}
    
    async def chat(self, messages: List[Dict[str, str]], max_tokens: int = None) -> Dict:
        """Local models don't support chat completion"""
        raise NotImplementedError("Chat not supported with local adapter")

