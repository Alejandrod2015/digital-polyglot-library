-- Add a distinct 'draft' status to JourneyStatus so an in-progress journey
-- (being built, not yet launched) is no longer conflated with 'archived'
-- (retired/dead). Additive + backward-compatible: existing rows unaffected.
-- Reader/studio/mobile filters were updated to notIn ["archived","draft"], so
-- draft journeys stay hidden exactly like archived ones until launch.
ALTER TYPE "JourneyStatus" ADD VALUE IF NOT EXISTS 'draft';
