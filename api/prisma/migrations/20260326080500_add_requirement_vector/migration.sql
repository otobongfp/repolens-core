-- Add vector column to Requirement table
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS vector vector(1536);

-- Create index for vector similarity search on requirements
CREATE INDEX IF NOT EXISTS "Requirement_vector_idx" ON "Requirement" USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);
