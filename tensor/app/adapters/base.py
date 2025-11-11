"""Base adapter interface"""
from typing import List, Dict

class BaseAdapter:
    """Base interface for all model adapters"""
    
    def name(self) -> str:
        """Return adapter identifier"""
        return "base"
    
    def version(self) -> str:
        """Return model version"""
        return "0.0"
    
    async def embed_batch(self, inputs: List[str]) -> List[List[float]]:
        """Generate embeddings for batch of texts"""
        raise NotImplementedError()
    
    async def summarize(self, text: str, strict: bool = True, max_tokens: int = 120) -> Dict:
        """Generate factual summary"""
        raise NotImplementedError()
    
    async def chat(self, messages: List[Dict[str, str]], max_tokens: int = None) -> Dict:
        """LLM chat completion"""
        raise NotImplementedError()

