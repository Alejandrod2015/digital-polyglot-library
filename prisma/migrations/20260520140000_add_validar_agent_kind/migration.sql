-- Adds the `validar` value to the AgentKind enum so the Studio
-- validator (/studio/validar) can persist each run to AgentRun
-- (input + output) and surface a collapsible execution history
-- the same way QA / Planner / Content do.
ALTER TYPE "AgentKind" ADD VALUE IF NOT EXISTS 'validar';
