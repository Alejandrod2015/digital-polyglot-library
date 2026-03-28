import type { AgentRunEnvelope } from "@/agents/types";

export type QAAgentSeverity = "critical" | "warning" | "info";

export type QAAgentFinding = {
  code: string;
  severity: QAAgentSeverity;
  field: "title" | "slug" | "synopsis" | "text" | "vocab" | "audio" | "cover" | "journey" | "general";
  title: string;
  message: string;
  suggestion?: string;
};

export type QAAgentInput = {
  storyId: string;
};

export type QAAgentOutput = {
  status: "pass" | "fail" | "needs_review";
  score: number;
  summary: string;
  findings: QAAgentFinding[];
  story: {
    id: string;
    title: string;
    slug: string;
    level: string;
    variant: string;
    journeyTopic: string;
    journeyOrder: number | null;
  };
};

export type QAAgentRun = AgentRunEnvelope<QAAgentInput, QAAgentOutput>;
