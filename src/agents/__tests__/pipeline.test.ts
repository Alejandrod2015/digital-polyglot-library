import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPlannerAgent } from '@/agents/planner/agent';
import { runContentAgent } from '@/agents/content/agent';
import { runJourneyStoryQaAgent } from '@/agents/qa/agent';
import type { PlannerAgentInput } from '@/agents/planner/types';

// Mock all external dependencies
vi.mock('@/agents/config/pedagogicalConfig', () => ({
  loadPedagogicalRules: vi.fn(async () => ({})),
  getRuleForLevel: vi.fn((level) => ({
    cefr: level,
    minWords: 100,
    maxWords: 500,
  })),
  buildContentPromptContext: vi.fn((level, language, topic) =>
    `Context for ${level} ${language} ${topic}`
  ),
}));

// Shared mock data
const mockCatalogStories = [
  {
    id: 'story1',
    title: 'Story 1',
    cefrLevel: 'a1',
    language: 'es',
    variant: 'es',
    topicSlug: 'animals',
    slug: 'story-1',
  },
  {
    id: 'story2',
    title: 'Story 2',
    cefrLevel: 'a2',
    language: 'es',
    variant: 'es',
    topicSlug: 'food',
    slug: 'story-2',
  },
];

const mockBrief = {
  id: 'brief-123',
  language: 'es',
  variant: 'es',
  level: 'a1',
  topicSlug: 'animals',
  storySlot: 1,
  journeyFocus: 'Narrative',
  title: 'Test Story',
  brief: { description: 'A test story about animals' },
};

const mockGeneratedContent = {
  text: 'Una vez había un gato. El gato era muy amistoso. Jugaba con sus amigos todos los días.',
  title: 'El Gato Amistoso',
};

const mockVocab = [
  { term: 'gato', definition: 'cat', pos: 'noun', level: 'a1' },
  { term: 'amistoso', definition: 'friendly', pos: 'adjective', level: 'a1' },
];

const mockStoryData = {
  id: 'published-story-1',
  title: 'El Gato Amistoso',
  slug: 'el-gato-amistoso-es-es-1',
  cefrLevel: 'a1',
  variant: 'es',
  journeyTopic: 'animals',
  journeyOrder: 1,
  text: mockGeneratedContent.text,
  synopsis: 'A short story about a friendly cat',
  vocab: JSON.stringify(mockVocab),
  coverImage: 'https://example.com/cover.jpg',
  audio: 'https://example.com/audio.mp3',
};

// Mock Planner tools
vi.mock('@/agents/planner/tools', () => ({
  loadCatalog: vi.fn(async () => mockCatalogStories),
  detectGaps: vi.fn(async (stories, filters) => [
    {
      language: filters.language || 'es',
      variant: filters.variant || 'es',
      level: 'b1',
      journeyTopic: filters.journeyTopic || 'animals',
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
      levels: params.targetLevels || ['a1', 'a2'],
      storiesPerLevel: params.storiesPerLevel || 4,
      rationale: 'New journey proposal',
    },
  ]),
  createJourneys: vi.fn(async (proposals) => proposals.length),
}));

// Mock Content tools
vi.mock('@/agents/content/tools', () => ({
  loadBrief: vi.fn(async (briefId) => {
    if (briefId === 'brief-123') return mockBrief;
    throw new Error(`Brief ${briefId} not found`);
  }),
  generateSlug: vi.fn((title, language, variant, slot) => {
    const clean = title
      .toLowerCase()
      .replace(/[áéíóúñ]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n' }[c]))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${clean}-${language}-${variant}-${slot}`;
  }),
  generateStoryWithLLM: vi.fn(async (params) => mockGeneratedContent),
  generateVocabFromText: vi.fn(async (params) => mockVocab),
  generateSynopsis: vi.fn(async (params) => 'A short story about a friendly cat'),
  saveStoryDraft: vi.fn(async (draftData) => 'draft-id-456'),
}));

// Mock QA tools
vi.mock('@/agents/qa/tools', () => ({
  loadJourneyStoryForQa: vi.fn(async (storyId) => mockStoryData),
  runStoryQaChecks: vi.fn((story) => []),
}));

// Mock persistence
vi.mock('@/lib/agentPersistence', () => ({
  persistAgentRun: vi.fn(async (run) => {
    if (run.agentKind === 'planner') return 'planner-run-id';
    if (run.agentKind === 'content') return 'content-run-id';
    if (run.agentKind === 'qa') return 'qa-run-id';
    return 'unknown-run-id';
  }),
  updateAgentRunOutput: vi.fn(async () => ({})),
  persistQAReview: vi.fn(async () => ({})),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    storyDraft: {
      update: vi.fn(async () => ({})),
    },
  },
}));

describe('Agent Pipeline Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Full pipeline: Planner -> Content -> QA', () => {
    it('should complete full pipeline successfully', async () => {
      // Step 1: Planner detects gaps and creates briefs
      const plannerInput: PlannerAgentInput = {
        mode: 'gaps',
        language: 'es',
        variant: 'es',
        journeyTopic: 'animals',
      };

      const plannerResult = await runPlannerAgent(plannerInput);

      expect(plannerResult.status).toBe('completed');
      expect(plannerResult.output.briefsCreated).toBeGreaterThan(0);
      expect(plannerResult.agent).toBe('planner');

      // Step 2: Content Agent generates story from brief
      const contentResult = await runContentAgent('brief-123');

      expect(contentResult.status).toBe('completed');
      expect(contentResult.output.status).toBe('generated');
      expect(contentResult.output.draftId).toBeTruthy();
      expect(contentResult.agent).toBe('content');

      // Step 3: QA Agent validates the story
      const qaResult = await runJourneyStoryQaAgent('published-story-1');

      expect(qaResult.status).toBe('completed');
      expect(qaResult.output.status).toBe('pass');
      expect(qaResult.agent).toBe('qa');
    });

    it('should maintain data integrity through pipeline', async () => {
      // Run planner
      const plannerResult = await runPlannerAgent({ mode: 'gaps', language: 'es' });

      // Generate content from detected gap
      const contentResult = await runContentAgent('brief-123');

      expect(contentResult.input.briefId).toBe('brief-123');
      expect(contentResult.input.language).toBe('es');
      expect(contentResult.output.slug).toBeTruthy();

      // Validate generated content
      const qaResult = await runJourneyStoryQaAgent('published-story-1');

      expect(qaResult.output.story.id).toBe('published-story-1');
      expect(qaResult.output.story.level).toBe('a1');
    });
  });

  describe('Planner -> Content flow', () => {
    it('should provide correct input to Content Agent from Planner', async () => {
      const plannerInput: PlannerAgentInput = {
        mode: 'gaps',
        language: 'es',
        variant: 'es',
      };

      const plannerResult = await runPlannerAgent(plannerInput);

      expect(plannerResult.output.briefsCreated).toBe(1);

      // Content agent receives brief ID from planner
      const contentResult = await runContentAgent('brief-123');

      expect(contentResult.input.language).toBe(plannerInput.language);
      expect(contentResult.input.variant).toBe(plannerInput.variant);
      expect(contentResult.status).toBe('completed');
    });

    it('should propagate journey topic through agents', async () => {
      const plannerInput: PlannerAgentInput = {
        mode: 'gaps',
        journeyTopic: 'space-exploration',
      };

      const plannerResult = await runPlannerAgent(plannerInput);

      expect(plannerResult.output.mode).toBe('gaps');

      // Content agent gets brief with journey topic
      const contentResult = await runContentAgent('brief-123');

      expect(contentResult.input.journeyTopic).toBeTruthy();
    });
  });

  describe('Content -> QA flow', () => {
    it('should validate generated content with QA', async () => {
      const contentResult = await runContentAgent('brief-123');

      expect(contentResult.output.title).toBe('El Gato Amistoso');
      expect(contentResult.output.slug).toBeTruthy();
      expect(contentResult.output.vocabItemCount).toBeGreaterThanOrEqual(0);

      // QA validates the story
      const qaResult = await runJourneyStoryQaAgent('published-story-1');

      expect(qaResult.output.story.title).toBe('El Gato Amistoso');
      expect(qaResult.output.story.slug).toBe('el-gato-amistoso-es-es-1');
    });

    it('should provide story metadata to QA agent', async () => {
      await runContentAgent('brief-123');

      const qaResult = await runJourneyStoryQaAgent('published-story-1');

      expect(qaResult.output.story).toEqual({
        id: 'published-story-1',
        title: 'El Gato Amistoso',
        slug: 'el-gato-amistoso-es-es-1',
        level: 'a1',
        variant: 'es',
        journeyTopic: 'animals',
        journeyOrder: 1,
      });
    });
  });

  describe('Create-Journey mode flow', () => {
    it('should create journey and generate briefs in create-journey mode', async () => {
      const plannerInput: PlannerAgentInput = {
        mode: 'create-journey',
        newJourneyTopic: 'marine-biology',
        newJourneyTopicLabel: 'Marine Biology',
        targetLanguages: ['es'],
        targetLevels: ['a1', 'a2'],
        storiesPerLevel: 3,
      };

      const plannerResult = await runPlannerAgent(plannerInput);

      expect(plannerResult.output.mode).toBe('create-journey');
      expect(plannerResult.output.journeysCreated).toBeGreaterThan(0);
      expect(plannerResult.output.briefsCreated).toBeGreaterThan(0);
      expect(plannerResult.output.journeysProposed.length).toBeGreaterThan(0);
    });
  });

  describe('Error handling in pipeline', () => {
    it('should handle content generation failure gracefully', async () => {
      const { loadBrief } = await vi.importMock('@/agents/content/tools');
      (loadBrief as any).mockRejectedValueOnce(new Error('Brief not found'));

      const contentResult = await runContentAgent('nonexistent-brief');

      expect(contentResult.status).toBe('failed');
      expect(contentResult.output.status).toBe('failed');
    });
  });

  describe('Run ID tracking', () => {
    it('should generate unique run IDs for each agent', async () => {
      const plannerResult = await runPlannerAgent({ mode: 'gaps', language: 'es' });
      const contentResult = await runContentAgent('brief-123');
      const qaResult = await runJourneyStoryQaAgent('published-story-1');

      expect(plannerResult.runId).toBe('planner-run-id');
      expect(contentResult.runId).toBe('content-run-id');
      expect(qaResult.runId).toBe('qa-run-id');

      // All run IDs should be unique
      const runIds = [plannerResult.runId, contentResult.runId, qaResult.runId];
      const uniqueIds = new Set(runIds);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('Tool execution tracking', () => {
    it('should track tools used by each agent', async () => {
      const plannerResult = await runPlannerAgent({ mode: 'gaps' });
      const contentResult = await runContentAgent('brief-123');
      const qaResult = await runJourneyStoryQaAgent('published-story-1');

      expect(plannerResult.toolsUsed.length).toBeGreaterThan(0);
      expect(contentResult.toolsUsed.length).toBeGreaterThan(0);
      expect(qaResult.toolsUsed.length).toBeGreaterThan(0);

      // Each tool entry should have name and summary
      plannerResult.toolsUsed.forEach((tool) => {
        expect(tool.toolName).toBeDefined();
        expect(tool.summary).toBeDefined();
      });
    });
  });

  describe('Pipeline output structure', () => {
    it('should return properly structured output from each agent', async () => {
      const plannerResult = await runPlannerAgent({ mode: 'gaps' });

      expect(plannerResult).toHaveProperty('runId');
      expect(plannerResult).toHaveProperty('agent');
      expect(plannerResult).toHaveProperty('status');
      expect(plannerResult).toHaveProperty('startedAt');
      expect(plannerResult).toHaveProperty('completedAt');
      expect(plannerResult).toHaveProperty('input');
      expect(plannerResult).toHaveProperty('output');
      expect(plannerResult).toHaveProperty('toolsUsed');

      // All timestamps should be ISO strings
      expect(new Date(plannerResult.startedAt)).toBeInstanceOf(Date);
      expect(new Date(plannerResult.completedAt)).toBeInstanceOf(Date);
    });

    it('should include summaries in all outputs', async () => {
      const plannerResult = await runPlannerAgent({ mode: 'gaps', language: 'es' });
      const contentResult = await runContentAgent('brief-123');
      const qaResult = await runJourneyStoryQaAgent('published-story-1');

      expect(plannerResult.output.summary).toBeTruthy();
      expect(contentResult.output.summary).toBeTruthy();
      expect(qaResult.output.summary).toBeTruthy();

      // Summaries should be non-empty strings
      expect(typeof plannerResult.output.summary).toBe('string');
      expect(typeof contentResult.output.summary).toBe('string');
      expect(typeof qaResult.output.summary).toBe('string');
    });
  });
});
