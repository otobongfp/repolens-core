-- AlterTable RequirementMatch: add matcherType, new unique and index
ALTER TABLE "RequirementMatch" ADD COLUMN "matcherType" TEXT NOT NULL DEFAULT 'hybrid';

-- Drop existing unique index (PostgreSQL: unique is an index, drop with DROP INDEX)
DROP INDEX IF EXISTS "RequirementMatch_requirementId_nodeId_key";

-- Create new unique constraint (requirementId, nodeId, matcherType)
CREATE UNIQUE INDEX "RequirementMatch_requirementId_nodeId_matcherType_key" ON "RequirementMatch"("requirementId", "nodeId", "matcherType");

-- Create index for filtering by matcherType
CREATE INDEX "RequirementMatch_requirementId_matcherType_idx" ON "RequirementMatch"("requirementId", "matcherType");

-- CreateTable EvaluationRun
CREATE TABLE "EvaluationRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "matcherType" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "tp" INTEGER NOT NULL,
    "fp" INTEGER NOT NULL,
    "fn" INTEGER NOT NULL,
    "precision" DOUBLE PRECISION NOT NULL,
    "recall" DOUBLE PRECISION NOT NULL,
    "f1" DOUBLE PRECISION NOT NULL,
    "coverage" DOUBLE PRECISION NOT NULL,
    "datasetType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvaluationRun_projectId_matcherType_idx" ON "EvaluationRun"("projectId", "matcherType");
