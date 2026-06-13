-- AlterEnum
-- Adds 'deprecated' to AgentArtifactStatus for marking stories that should not
-- be generated or shown in active flows (e.g. stories with eliminated cast).
ALTER TYPE "AgentArtifactStatus" ADD VALUE IF NOT EXISTS 'deprecated';
