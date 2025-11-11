"""Chat/completion routes"""
import time
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.main import adapters
from app.adapters import choose_adapter
from app.config import settings

router = APIRouter(prefix="/v1/chat", tags=["chat"])

class ChatRequest(BaseModel):
    model: Optional[str] = "auto"
    provider: Optional[str] = None
    messages: List[Dict[str, str]]
    stream: bool = False
    max_tokens: Optional[int] = None

class ChatResponse(BaseModel):
    model: str
    model_version: str
    reply: str
    timings_ms: int

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """LLM chat completion"""
    t0 = time.time()
    
    try:
        adapter = choose_adapter(adapters, request.provider, request.model, settings)
        result = await adapter.chat(request.messages, max_tokens=request.max_tokens)
        
        timings_ms = int((time.time() - t0) * 1000)
        
        return ChatResponse(
            model=adapter.name(),
            model_version=adapter.version(),
            reply=result["reply"],
            timings_ms=timings_ms
        )
    except Exception as e:
        raise HTTPException(500, str(e))

