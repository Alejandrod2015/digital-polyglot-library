import type { AgentRunEnvelope } from "@/agents/types";

// ── Gap detection types (existing, renamed) ──
export type PlannerGap = {
  language: string;
  variant: string;
  level: string;
  journeyTopic: string;
  storySlot: number;
  journeyFocus: string;
  reason: "missing" | "incomplete";
};

// ── Journey proposal types (new) ──
export type JourneyProposal = {
  language: string;
  variant: string;
  topic: string;
  topicLabel: string;
  levels: string[];
  storiesPerLevel: number;
  rationale: string;
};

export type PlannerMode = "gaps" | "create-journey";

export type PlannerAgentInput = {
  mode: PlannerMode;
  // gap-detection scope
  scope?: "full" | "language" | "journey";
  language?: string;
  variant?: string;
  journeyTopic?: string;
  // journey-creation params
  newJourneyTopic?: string;
  newJourneyTopicLabel?: string;
  targetLanguages?: string[];
  targetLevels?: string[];
  storiesPerLevel?: number;
};

export type PlannerAgentOutput = {
  status: "completed" | "failed";
  mode: PlannerMode;
  // gap-detection results
  totalStoriesAnalyzed: number;
  gapsFound: number;
  briefsCreated: number;
  gaps: PlannerGap[];
  // journey-creation results
  journeysProposed: JourneyProposal[];
  journeysCreated: number;
  summary: string;
};

export type PlannerAgentRun = AgentRunEnvelope<PlannerAgentInput, PlannerAgentOutput>;
