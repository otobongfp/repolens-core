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
    
    if settings.openai_api_key:
        adapters["openai"] = OpenAIAdapter(settings.openai_api_key)
    
    if settings.anthropic_api_key:
        adapters["anthropic"] = AnthropicAdapter(settings.anthropic_api_key)
    
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
        if provider in adapters:
            return adapters[provider]
        return adapters.get("local", list(adapters.values())[0])
    
    if settings and settings.prefer_local:
        if "local" in adapters:
            return adapters["local"]
    
    for preferred in ["openai", "anthropic", "local"]:
        if preferred in adapters:
            return adapters[preferred]
    
    return list(adapters.values())[0] if adapters else None
