"""Summarization routes"""
import time
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.main import adapters
from app.adapters import choose_adapter
from app.config import settings

router = APIRouter(prefix="/v1/summarize", tags=["summarize"])

class SummarizeRequest(BaseModel):
    model: Optional[str] = "auto"
    text: str
    strict: bool = True
    max_tokens: int = 120

class SummarizeResponse(BaseModel):
    model: str
    model_version: str
    summary: str
    confidence: float
    timings_ms: int

@router.post("", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest):
    """Generate strict factual summaries"""
    t0 = time.time()
    
    try:
        adapter = choose_adapter(adapters, None, request.model, settings)
        result = await adapter.summarize(
            request.text,
            strict=request.strict,
            max_tokens=request.max_tokens
        )
        
        timings_ms = int((time.time() - t0) * 1000)
        
        return SummarizeResponse(
            model=adapter.name(),
            model_version=adapter.version(),
            summary=result["summary"],
            confidence=result.get("confidence", 1.0),
            timings_ms=timings_ms
        )
    except Exception as e:
        raise HTTPException(500, str(e))

