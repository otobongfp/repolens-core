-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column to Embedding table
ALTER TABLE "Embedding" ADD COLUMN IF NOT EXISTS vector vector(1536);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS "Embedding_vector_idx" ON "Embedding" USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);
