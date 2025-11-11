"""Model adapters initialization"""
from typing import Dict
from app.adapters.base import BaseAdapter
from app.adapters.openai_adapter import OpenAIAdapter
from app.adapters.anthropic_adapter import AnthropicAdapter
from app.adapters.local_adapter import LocalAdapter
from app.config import settings

def initialize_adapters() -> Dict[str, BaseAdapter]:
    """Initialize all available model adapters"""
    adapters: Dict[str, BaseAdapter] = {}
    
    # OpenAI adapter
    if settings.openai_api_key:
        adapters["openai"] = OpenAIAdapter(settings.openai_api_key)
    
    # Anthropic adapter
    if settings.anthropic_api_key:
        adapters["anthropic"] = AnthropicAdapter(settings.anthropic_api_key)
    
    # Local adapter (always available)
    adapters["local"] = LocalAdapter()
    
    return adapters

def choose_adapter(
    adapters: Dict[str, BaseAdapter],
    provider: str = None,
    model: str = None,
    settings: any = None
) -> BaseAdapter:
    """Choose appropriate adapter based on provider/model preference"""
    if provider:
        # Explicit provider requested
        if provider in adapters:
            return adapters[provider]
        # Fallback to local if requested provider not available
        return adapters.get("local", list(adapters.values())[0])
    
    if settings and settings.prefer_local:
        # Prefer local if available
        if "local" in adapters:
            return adapters["local"]
    
    # Default: first available (prefer OpenAI > Anthropic > Local)
    for preferred in ["openai", "anthropic", "local"]:
        if preferred in adapters:
            return adapters[preferred]
    
    # Fallback: any available adapter
    return list(adapters.values())[0] if adapters else None
