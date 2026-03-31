-- CreateTable TraceabilityExperimentResult
CREATE TABLE "TraceabilityExperimentResult" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "matcherType" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "tp" INTEGER NOT NULL,
    "fp" INTEGER NOT NULL,
    "fn" INTEGER NOT NULL,
    "precision" DOUBLE PRECISION NOT NULL,
    "recall" DOUBLE PRECISION NOT NULL,
    "f1" DOUBLE PRECISION NOT NULL,
    "coverage" DOUBLE PRECISION NOT NULL,
    "useGraphProp" BOOLEAN,
    "useSymbolMatch" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraceabilityExperimentResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TraceabilityExperimentResult_projectId_matcherType_idx" ON "TraceabilityExperimentResult"("projectId", "matcherType");
CREATE INDEX "TraceabilityExperimentResult_repositoryId_matcherType_idx" ON "TraceabilityExperimentResult"("repositoryId", "matcherType");
