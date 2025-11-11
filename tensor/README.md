# Tensor - AI Inference Microservice

A focused Python FastAPI service handling all AI/ML operations for RepoLens:
- Embeddings (with batching & caching)
- Summarization (strict, fact-only)
- Chat/LLM operations
- Model adapter layer (OpenAI, Anthropic, Local)

## Architecture

```
NestJS (Orchestrator)  →  HTTP  →  Tensor (AI Inference)
                                ↓
                          Adapter Layer
                            ↙    ↘    ↖
                        OpenAI  Anthropic  Local
```

## Why Separate?

✅ **Clean separation of concerns**
✅ **Independent scaling** (GPU for tensor, CPU for NestJS)  
✅ **Model flexibility** (switch models without touching NestJS)
✅ **Cost optimization** (batch embeddings, cache results)
✅ **Technology fit** (Python ecosystem for ML)

## API Endpoints

- `POST /v1/embed` - Generate embeddings with batching
- `POST /v1/summarize` - Strict factual summaries  
- `POST /v1/chat` - LLM chat completion
- `GET /v1/health` - Health check

## Getting Started

```bash
cd repolens/tensor
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8080
```

## Configuration

Set environment variables:
- `OPENAI_API_KEY` (optional)
- `ANTHROPIC_API_KEY` (optional)
- `REDIS_URL` (for caching)
- `TENSOR_API_KEY` (auth token)
- `LOCAL_EMBED_MODEL` (e.g., "sentence-transformers/all-MiniLM-L6-v2")

