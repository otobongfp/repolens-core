"""Shared application state to avoid circular imports"""
import asyncio
from app.adapters import initialize_adapters
from app.services.batcher import EmbedBatcher

adapters = initialize_adapters()
batcher = EmbedBatcher(adapters)
asyncio.create_task(batcher.run())

