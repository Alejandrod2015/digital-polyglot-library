import {
  getSegmentIdFromSourcePath as getDomainSegmentIdFromSourcePath,
  getStorySource as getDomainStorySource,
  isStandaloneSourcePath as isDomainStandaloneSourcePath,
} from "@domain/storySource";
import { getConfiguredStandaloneStorySlugs } from "@/lib/standaloneStoryAudioSegments";

export function getStorySource(
  sourcePath?: string | null,
  storySlug?: string | null
): "standalone" | "user" {
  return getDomainStorySource(sourcePath, storySlug, getConfiguredStandaloneStorySlugs());
}

export function isStandaloneSourcePath(sourcePath?: string | null, storySlug?: string | null): boolean {
  return isDomainStandaloneSourcePath(sourcePath, storySlug, getConfiguredStandaloneStorySlugs());
}

export function getSegmentIdFromSourcePath(sourcePath?: string | null): string | null {
  return getDomainSegmentIdFromSourcePath(sourcePath);
}
