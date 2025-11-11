"""Configuration management"""
import os
from dataclasses import dataclass

@dataclass
class Settings:
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    tensor_api_key: str = os.getenv("TENSOR_API_KEY", "dev-key-change-me")
    max_batch: int = int(os.getenv("TENSOR_MAX_BATCH", "64"))
    max_batch_wait_ms: int = int(os.getenv("TENSOR_BATCH_WAIT_MS", "25"))
    prefer_local: bool = os.getenv("PREFER_LOCAL", "true").lower() == "true"
    
    # Model API keys
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    local_embed_model: str = os.getenv("LOCAL_EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

settings = Settings()

