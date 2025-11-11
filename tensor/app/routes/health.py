"""Health check routes"""
from fastapi import APIRouter
from app.main import app

router = APIRouter(prefix="/v1", tags=["health"])

@router.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "version": app.version,
        "uptime_s": 0,
    }

