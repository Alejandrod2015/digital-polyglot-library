import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runJourneyStoryQaAgent, runDraftQaAgent } from '@/agents/qa/agent';
import type { QAAgentFinding } from '@/agents/qa/types';

// Mock dependencies
vi.mock('@/agents/config/pedagogicalConfig', () => ({
  loadPedagogicalRules: vi.fn(async () => ({})),
  getRuleForLevel: vi.fn((level) => ({
    cefr: level,
    minWords: 100,
    maxWords: 500,
  })),
}));

const mockStoryWithAllFields = {
  id: 'story-1',
  title: 'The Adventure',
  slug: 'the-adventure-es-es-1',
  cefrLevel: 'a1',
  variant: 'es',
  journeyTopic: 'animals',
  journeyOrder: 1,
  text: 'Una vez había un gato. El gato era muy amistoso. Jugaba con sus amigos todos los días.',
  synopsis: 'A short story about a friendly cat',
  vocab: JSON.stringify([
    { term: 'gato', definition: 'cat', pos: 'noun', level: 'a1' },
    { term: 'amistoso', definition: 'friendly', pos: 'adjective', level: 'a1' },
  ]),
  coverImage: 'https://example.com/cover.jpg',
  audio: 'https://example.com/audio.mp3',
};

const mockStoryMissingFields = {
  id: 'story-2',
  title: '',
  slug: '',
  cefrLevel: 'b1',
  variant: 'es',
  journeyTopic: 'science',
  journeyOrder: null,
  text: '',
  synopsis: '',
  vocab: '[]',
  coverImage: null,
  audio: null,
};

vi.mock('@/agents/qa/tools', () => ({
  loadJourneyStoryForQa: vi.fn(async (storyId) => {
    if (storyId === 'story-1') return mockStoryWithAllFields;
    if (storyId === 'story-2') return mockStoryMissingFields;
    throw new Error(`Story ${storyId} not found`);
  }),
  loadDraftForQa: vi.fn(async (draftId) => {
    if (draftId === 'draft-1') return mockStoryWithAllFields;
    if (draftId === 'draft-2') return mockStoryMissingFields;
    throw new Error(`Draft ${draftId} not found`);
  }),
  runStoryQaChecks: vi.fn((story) => {
    const findings: QAAgentFinding[] = [];

    if (!story.title.trim()) {
      findings.push({
        code: 'missing_title',
        severity: 'critical',
        field: 'title',
        title: 'Falta el título',
        message: 'La historia no tiene título.',
        suggestion: 'Añade un título claro antes de aprobarla.',
      });
    }

    if (!story.slug.trim()) {
      findings.push({
        code: 'missing_slug',
        severity: 'critical',
        field: 'slug',
        title: 'Falta el slug',
        message: 'La historia no tiene slug.',
        suggestion: 'Crea un slug limpio para poder publicarla y abrirla en la app.',
      });
    }

    if (!story.text.trim()) {
      findings.push({
        code: 'missing_text',
        severity: 'critical',
        field: 'text',
        title: 'Falta el texto',
        message: 'La historia no tiene texto.',
        suggestion: 'Genera o añade el texto de la historia.',
      });
    }

    if (!story.synopsis.trim()) {
      findings.push({
        code: 'missing_synopsis',
        severity: 'warning',
        field: 'synopsis',
        title: 'Falta la sinopsis',
        message: 'La historia no tiene sinopsis.',
        suggestion: 'Añade una sinopsis breve.',
      });
    }

    if (!story.coverImage) {
      findings.push({
        code: 'missing_cover',
        severity: 'info',
        field: 'cover',
        title: 'Falta la portada',
        message: 'La historia no tiene una imagen de portada.',
        suggestion: 'Busca o genera una imagen apropiada.',
      });
    }

    return findings;
  }),
}));

vi.mock('@/lib/agentPersistence', () => ({
  persistAgentRun: vi.fn(async (run) => {
    if (run.status === 'completed') return 'qa-run-passed';
    if (run.status === 'needs_review') return 'qa-run-review';
    return 'qa-run-failed';
  }),
  persistQAReview: vi.fn(async () => ({})),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    storyDraft: {
      update: vi.fn(async () => ({})),
    },
  },
}));

describe('QA Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runStoryQaChecks - Story with all fields', () => {
    it('should pass QA when all fields are present', async () => {
      const result = await runJourneyStoryQaAgent('story-1');

      expect(result.output.status).toBe('pass');
      expect(result.output.findings.filter((f) => f.severity === 'critical')).toHaveLength(0);
    });

    it('should have high score for complete story', async () => {
      const result = await runJourneyStoryQaAgent('story-1');

      expect(result.output.score).toBeGreaterThan(80);
      expect(result.output.score).toBeLessThanOrEqual(100);
    });

    it('should return story metadata in output', async () => {
      const result = await runJourneyStoryQaAgent('story-1');

      expect(result.output.story.id).toBe('story-1');
      expect(result.output.story.title).toBe('The Adventure');
      expect(result.output.story.slug).toBe('the-adventure-es-es-1');
      expect(result.output.story.level).toBe('a1');
      expect(result.output.story.variant).toBe('es');
      expect(result.output.story.journeyTopic).toBe('animals');
      expect(result.output.story.journeyOrder).toBe(1);
    });
  });

  describe('runStoryQaChecks - Story missing fields', () => {
    it('should fail QA when critical fields are missing', async () => {
      const result = await runJourneyStoryQaAgent('story-2');

      expect(result.output.status).toBe('fail');
      expect(result.output.findings.filter((f) => f.severity === 'critical').length).toBeGreaterThan(0);
    });

    it('should detect missing title as critical', async () => {
      const result = await runJourneyStoryQaAgent('story-2');

      const titleFinding = result.output.findings.find((f) => f.code === 'missing_title');
      expect(titleFinding).toBeDefined();
      expect(titleFinding?.severity).toBe('critical');
    });

    it('should detect missing slug as critical', async () => {
      const result = await runJourneyStoryQaAgent('story-2');

      const slugFinding = result.output.findings.find((f) => f.code === 'missing_slug');
      expect(slugFinding).toBeDefined();
      expect(slugFinding?.severity).toBe('critical');
    });

    it('should detect missing text as critical', async () => {
      const result = await runJourneyStoryQaAgent('story-2');

      const textFinding = result.output.findings.find((f) => f.code === 'missing_text');
      expect(textFinding).toBeDefined();
      expect(textFinding?.severity).toBe('critical');
    });

    it('should detect missing synopsis as warning (non-critical)', async () => {
      const result = await runJourneyStoryQaAgent('story-2');

      const synopsisFinding = result.output.findings.find((f) => f.code === 'missing_synopsis');
      expect(synopsisFinding).toBeDefined();
      expect(synopsisFinding?.severity).toBe('warning');
    });

    it('should have low score for incomplete story', async () => {
      const result = await runJourneyStoryQaAgent('story-2');

      expect(result.output.score).toBeLessThan(50);
      expect(result.output.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Score calculation logic', () => {
    it('should calculate score based on findings', async () => {
      const resultPass = await runJourneyStoryQaAgent('story-1');
      const resultFail = await runJourneyStoryQaAgent('story-2');

      expect(resultPass.output.score).toBeGreaterThan(resultFail.output.score);
    });

    it('should deduct more points for critical findings', async () => {
      const result = await runJourneyStoryQaAgent('story-2');

      const criticalCount = result.output.findings.filter((f) => f.severity === 'critical').length;
      const warningCount = result.output.findings.filter((f) => f.severity === 'warning').length;
      const infoCount = result.output.findings.filter((f) => f.severity === 'info').length;

      // Each critical deducts 30 points, warning 12, info 3
      const expectedScore = Math.max(0, Math.min(100, 100 - criticalCount * 30 - warningCount * 12 - infoCount * 3));

      expect(result.output.score).toBe(expectedScore);
    });
  });

  describe('loadDraftForQa', () => {
    it('should load draft with correct shape', async () => {
      const result = await runDraftQaAgent('draft-1');

      expect(result.output.story.id).toBe('story-1');
      expect(result.output.story.title).toBe('The Adventure');
      expect(result.output.story.level).toBe('a1');
      expect(result.output.story.variant).toBe('es');
    });

    it('should pass QA for draft with all fields', async () => {
      const result = await runDraftQaAgent('draft-1');

      expect(result.output.status).toBe('pass');
    });

    it('should fail QA for draft missing fields', async () => {
      const result = await runDraftQaAgent('draft-2');

      expect(result.output.status).toBe('fail');
    });
  });

  describe('QA Agent run metadata', () => {
    it('should return run ID for journey story QA', async () => {
      const result = await runJourneyStoryQaAgent('story-1');

      expect(result.runId).toBeDefined();
      expect(result.runId.length).toBeGreaterThan(0);
    });

    it('should include QA tools in run summary', async () => {
      const result = await runJourneyStoryQaAgent('story-1');

      expect(result.toolsUsed.length).toBeGreaterThan(0);
      const toolNames = result.toolsUsed.map((t) => t.toolName);
      expect(toolNames).toContain('loadJourneyStoryForQa');
      expect(toolNames).toContain('runStoryQaChecks');
    });

    it('should set correct run status based on QA result', async () => {
      const resultPass = await runJourneyStoryQaAgent('story-1');
      const resultFail = await runJourneyStoryQaAgent('story-2');

      expect(resultPass.status).toBe('completed');
      expect(resultFail.status).toBe('failed');
    });
  });

  describe('Finding structure', () => {
    it('should return findings with required fields', async () => {
      const result = await runJourneyStoryQaAgent('story-2');

      expect(result.output.findings.length).toBeGreaterThan(0);

      result.output.findings.forEach((finding) => {
        expect(finding.code).toBeDefined();
        expect(finding.severity).toMatch(/critical|warning|info/);
        expect(finding.field).toBeDefined();
        expect(finding.title).toBeDefined();
        expect(finding.message).toBeDefined();
      });
    });

    it('should include suggestion for actionable findings', async () => {
      const result = await runJourneyStoryQaAgent('story-2');

      result.output.findings.forEach((finding) => {
        if (['critical', 'warning'].includes(finding.severity)) {
          expect(finding.suggestion).toBeDefined();
        }
      });
    });
  });
});
