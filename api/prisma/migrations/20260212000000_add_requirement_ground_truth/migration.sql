-- CreateTable
CREATE TABLE "RequirementGroundTruth" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementGroundTruth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequirementGroundTruth_requirementId_nodeId_key" ON "RequirementGroundTruth"("requirementId", "nodeId");

-- CreateIndex
CREATE INDEX "RequirementGroundTruth_projectId_idx" ON "RequirementGroundTruth"("projectId");

-- CreateIndex
CREATE INDEX "RequirementGroundTruth_requirementId_idx" ON "RequirementGroundTruth"("requirementId");

-- AddForeignKey
ALTER TABLE "RequirementGroundTruth" ADD CONSTRAINT "RequirementGroundTruth_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementGroundTruth" ADD CONSTRAINT "RequirementGroundTruth_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementGroundTruth" ADD CONSTRAINT "RequirementGroundTruth_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
