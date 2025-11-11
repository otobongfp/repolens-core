"""Main FastAPI application"""
import asyncio
from fastapi import FastAPI
from app.routes import embeddings, summarize, chat, health
from app.config import settings
from app.adapters import initialize_adapters
from app.services.batcher import EmbedBatcher

app = FastAPI(
    title="Tensor",
    version="0.1.0",
    description="RepoLens AI Inference Service"
)

# Initialize adapters
adapters = initialize_adapters()

# Start batcher
batcher = EmbedBatcher(adapters)
asyncio.create_task(batcher.run())

# Register routes
app.include_router(health.router)
app.include_router(embeddings.router)
app.include_router(summarize.router)
app.include_router(chat.router)

@app.on_event("startup")
async def startup():
    await batcher.start_redis()

@app.on_event("shutdown")
async def shutdown():
    await batcher.close_redis()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
