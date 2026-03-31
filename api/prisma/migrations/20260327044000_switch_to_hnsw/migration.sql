-- Create HNSW index for vector similarity search (replaces slower IVFFlat)
-- Note: HNSW is significantly faster for high-dimensional vectors (1536 dims)
-- and does not require a "training" set like IVFFlat.

DROP INDEX IF EXISTS "Embedding_vector_idx";
CREATE INDEX "Embedding_vector_hnsw_idx" ON "Embedding" USING hnsw (vector vector_cosine_ops);

DROP INDEX IF EXISTS "Requirement_vector_idx";
CREATE INDEX "Requirement_vector_hnsw_idx" ON "Requirement" USING hnsw (vector vector_cosine_ops);
