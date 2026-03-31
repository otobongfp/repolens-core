-- Fix: init created UNIQUE INDEX on (requirementId, nodeId). The matcher-type migration
-- used DROP CONSTRAINT which does not remove a unique index in PostgreSQL. Drop the index
-- so the 3-column unique (requirementId, nodeId, matcherType) can allow multiple matchers
-- per (requirement, node) pair.
DROP INDEX IF EXISTS "RequirementMatch_requirementId_nodeId_key";
