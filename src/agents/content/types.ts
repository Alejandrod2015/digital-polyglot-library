import type { AgentRunEnvelope } from "@/agents/types";

export type ContentAgentInput = {
  briefId: string;
  language: string;
  variant: string;
  level: string;
  journeyTopic: string;
  storySlot: number;
  journeyFocus: string;
  title: string;
  briefDescription: string;
};

export type ContentAgentOutput = {
  status: "generated" | "failed";
  draftId: string | null;
  title: string;
  slug: string;
  synopsis: string;
  textPreview: string; // first 200 chars
  wordCount: number;
  vocabItemCount: number;
  summary: string;
};

export type ContentAgentRun = AgentRunEnvelope<ContentAgentInput, ContentAgentOutput>;
