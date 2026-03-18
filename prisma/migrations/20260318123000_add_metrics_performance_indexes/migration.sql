-- Reduce Neon compute for the most frequent per-user progress and metrics queries.
CREATE INDEX "dp_user_metrics_v1_userId_eventType_createdAt_idx"
ON "dp_user_metrics_v1"("userId", "eventType", "createdAt");

CREATE INDEX "dp_user_metrics_v1_userId_storySlug_createdAt_idx"
ON "dp_user_metrics_v1"("userId", "storySlug", "createdAt");

CREATE INDEX "dp_continue_listening_v1_userId_lastPlayedAt_idx"
ON "dp_continue_listening_v1"("userId", "lastPlayedAt");
