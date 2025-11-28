"""Embedding routes"""
import time
from typing import List, Optional, Dict
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.state import adapters, batcher
from app.adapters import choose_adapter

router = APIRouter(prefix="/v1/embed", tags=["embeddings"])

class EmbedRequest(BaseModel):
    model: Optional[str] = "auto"
    provider: Optional[str] = None
    inputs: List[str]
    job_id: Optional[str] = None
    meta: Optional[Dict] = None

class EmbedResponse(BaseModel):
    model: str
    model_version: str
    vectors: List[List[float]]
    vector_ids: Optional[List[str]] = None
    cached: List[bool]
    timings_ms: int

@router.post("", response_model=EmbedResponse)
async def embed(request: EmbedRequest, req: Request):
    """Generate embeddings with automatic batching"""
    t0 = time.time()
    
    auth_header = req.headers.get("Authorization", "")
    if not auth_header.startswith(f"Bearer {batcher.settings.tensor_api_key}"):
        raise HTTPException(401, "Unauthorized")
    
    try:
        adapter = choose_adapter(adapters, request.provider, request.model, batcher.settings)
        result = await batcher.process_embed_request(adapter, request.inputs)
        
        timings_ms = int((time.time() - t0) * 1000)
        
        return EmbedResponse(
            model=result["adapter_name"],
            model_version=result["adapter_version"],
            vectors=result["vectors"],
            cached=result["cached"],
            timings_ms=timings_ms
        )
    except Exception as e:
        raise HTTPException(500, str(e))

