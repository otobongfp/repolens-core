"""Health check routes"""
from fastapi import APIRouter

router = APIRouter(prefix="/v1", tags=["health"])

SERVICE_VERSION = "0.1.0"

@router.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "version": SERVICE_VERSION,
        "uptime_s": 0,
    }