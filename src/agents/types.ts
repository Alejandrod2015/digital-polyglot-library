export type AgentKind = "planner" | "content" | "qa";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "needs_review";

export type AgentArtifactStatus =
  | "draft"
  | "generated"
  | "qa_pass"
  | "qa_fail"
  | "needs_review"
  | "approved"
  | "published";

export type AgentToolCall = {
  toolName: string;
  summary: string;
};

export type AgentRunEnvelope<TInput, TOutput> = {
  agent: AgentKind;
  status: AgentRunStatus;
  startedAt: string;
  completedAt: string;
  input: TInput;
  output: TOutput;
  toolsUsed: AgentToolCall[];
};
