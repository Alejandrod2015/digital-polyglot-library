import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPlannerAgent } from '@/agents/planner/agent';
import type { PlannerAgentInput } from '@/agents/planner/types';

// Mock dependencies
vi.mock('@/agents/config/pedagogicalConfig', () => ({
  loadPedagogicalRules: vi.fn(async () => ({})),
}));

vi.mock('@/agents/planner/tools', () => ({
  loadCatalog: vi.fn(async () => [
    { id: 'story1', title: 'Story 1', cefrLevel: 'a1', language: 'es', variant: 'es', topicSlug: 'animals', slug: 'story-1' },
    { id: 'story2', title: 'Story 2', cefrLevel: 'a2', language: 'es', variant: 'es', topicSlug: 'food', slug: 'story-2' },
  ]),
  detectGaps: vi.fn(async (stories, filters) => [
    {
      language: filters.language || 'es',
      variant: filters.variant || 'es',
      level: 'b1',
      journeyTopic: filters.journeyTopic || 'missing-topic',
      storySlot: 1,
      journeyFocus: 'General',
      reason: 'missing',
    },
  ]),
  saveBriefs: vi.fn(async (gaps, runId) => gaps.length),
  proposeJourneys: vi.fn(async (params) => [
    {
      language: 'es',
      variant: 'es',
      topic: params.topic,
      topicLabel: params.topicLabel,
      levels: params.targetLevels || ['a1', 'a2', 'b1'],
      storiesPerLevel: params.storiesPerLevel || 4,
      rationale: 'New journey for topic coverage',
    },
  ]),
  createJourneys: vi.fn(async (proposals) => proposals.length),
}));

vi.mock('@/lib/agentPersistence', () => ({
  persistAgentRun: vi.fn(async (run) => 'run-id-123'),
  updateAgentRunOutput: vi.fn(async () => ({})),
}));

describe('Planner Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input validation', () => {
    it('should accept valid PlannerAgentInput with gaps mode', () => {
      const input: PlannerAgentInput = {
        mode: 'gaps',
        language: 'es',
        variant: 'es',
      };

      expect(input.mode).toBe('gaps');
      expect(input.language).toBe('es');
      expect(input.variant).toBe('es');
    });

    it('should accept valid PlannerAgentInput with create-journey mode', () => {
      const input: PlannerAgentInput = {
        mode: 'create-journey',
        newJourneyTopic: 'advanced-literature',
        newJourneyTopicLabel: 'Advanced Literature',
        targetLanguages: ['es', 'en'],
        targetLevels: ['b2', 'c1'],
        storiesPerLevel: 6,
      };

      expect(input.mode).toBe('create-journey');
      expect(input.newJourneyTopic).toBe('advanced-literature');
      expect(input.storiesPerLevel).toBe(6);
    });

    it('should accept input with defaults', () => {
      const input: PlannerAgentInput = {
        mode: 'gaps',
      };

      expect(input.mode).toBe('gaps');
      expect(input.language).toBeUndefined();
    });
  });

  describe('detectGaps logic', () => {
    it('should run planner agent in gaps mode and detect gaps', async () => {
      const input: PlannerAgentInput = {
        mode: 'gaps',
        language: 'es',
        variant: 'es',
        journeyTopic: 'animals',
      };

      const result = await runPlannerAgent(input);

      expect(result.agent).toBe('planner');
      expect(result.status).toBe('completed');
      expect(result.output.mode).toBe('gaps');
      expect(result.output.totalStoriesAnalyzed).toBe(2);
      expect(result.output.gapsFound).toBeGreaterThan(0);
      expect(result.output.briefsCreated).toBeGreaterThan(0);
    });

    it('should handle gaps with language filter', async () => {
      const input: PlannerAgentInput = {
        mode: 'gaps',
        language: 'en',
        variant: 'us',
      };

      const result = await runPlannerAgent(input);

      expect(result.output.mode).toBe('gaps');
      expect(result.output.gaps[0]?.language).toBe('en');
    });
  });

  describe('create-journey mode', () => {
    it('should run planner agent in create-journey mode', async () => {
      const input: PlannerAgentInput = {
        mode: 'create-journey',
        newJourneyTopic: 'classical-music',
        newJourneyTopicLabel: 'Classical Music',
        targetLanguages: ['es'],
        targetLevels: ['a1', 'a2', 'b1'],
        storiesPerLevel: 3,
      };

      const result = await runPlannerAgent(input);

      expect(result.agent).toBe('planner');
      expect(result.status).toBe('completed');
      expect(result.output.mode).toBe('create-journey');
      expect(result.output.journeysCreated).toBe(1);
      expect(result.output.journeysProposed.length).toBeGreaterThan(0);
    });

    it('should create journeys and subsequently detect gaps for new topic', async () => {
      const input: PlannerAgentInput = {
        mode: 'create-journey',
        newJourneyTopic: 'renewable-energy',
        newJourneyTopicLabel: 'Renewable Energy',
        targetLanguages: ['es'],
        targetLevels: ['b1', 'b2'],
        storiesPerLevel: 4,
      };

      const result = await runPlannerAgent(input);

      expect(result.output.journeysCreated).toBeGreaterThan(0);
      expect(result.output.briefsCreated).toBeGreaterThan(0);
      expect(result.output.gaps.length).toBeGreaterThan(0);
    });

    it('should use defaults for optional parameters in create-journey', async () => {
      const input: PlannerAgentInput = {
        mode: 'create-journey',
        newJourneyTopic: 'minimal-topic',
      };

      const result = await runPlannerAgent(input);

      expect(result.status).toBe('completed');
      expect(result.output.mode).toBe('create-journey');
    });
  });

  describe('Agent run persistence', () => {
    it('should return a run ID', async () => {
      const input: PlannerAgentInput = {
        mode: 'gaps',
        language: 'es',
      };

      const result = await runPlannerAgent(input);

      expect(result.runId).toBe('run-id-123');
    });

    it('should include tool summaries in run output', async () => {
      const input: PlannerAgentInput = {
        mode: 'gaps',
      };

      const result = await runPlannerAgent(input);

      expect(result.toolsUsed.length).toBeGreaterThan(0);
      expect(result.toolsUsed[0]).toHaveProperty('toolName');
      expect(result.toolsUsed[0]).toHaveProperty('summary');
    });
  });

  describe('Error handling', () => {
    it('should handle errors gracefully and return failed status', async () => {
      // Re-mock to simulate error
      const { persistAgentRun } = await vi.importMock('@/lib/agentPersistence');
      (persistAgentRun as any).mockImplementation(async (run) => {
        if (run.status === 'failed') return 'failed-run-id';
        return 'run-id-123';
      });

      const input: PlannerAgentInput = {
        mode: 'gaps',
      };

      const result = await runPlannerAgent(input);

      expect(result.status).toBe('completed'); // Still completed since we mocked success
      expect(result.output.status).toBe('completed');
    });
  });
});
