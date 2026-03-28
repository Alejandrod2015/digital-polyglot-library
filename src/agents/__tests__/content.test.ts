import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runContentAgent } from '@/agents/content/agent';

// Mock dependencies
vi.mock('@/agents/config/pedagogicalConfig', () => ({
  loadPedagogicalRules: vi.fn(async () => ({})),
  getRuleForLevel: vi.fn((level) => ({
    cefr: level,
    minWords: 100,
    maxWords: 500,
    vocabularyRange: { min: 500, max: 2000 },
  })),
  buildContentPromptContext: vi.fn((level, language, topic) => `Context for ${level} ${language} ${topic}`),
}));

vi.mock('@/agents/content/tools', () => ({
  loadBrief: vi.fn(async (briefId) => {
    if (!briefId) throw new Error('Brief ID required');
    return {
      id: briefId,
      language: 'es',
      variant: 'es',
      level: 'a1',
      topicSlug: 'animals',
      storySlot: 1,
      journeyFocus: 'Narrative',
      title: 'Test Story',
      brief: {
        description: 'A test story about animals',
      },
    };
  }),
  generateSlug: vi.fn((title, language, variant, slot) => {
    const clean = title
      .toLowerCase()
      .replace(/[áéíóúñ]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n' }[c]))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${clean}-${language}-${variant}-${slot}`;
  }),
  generateStoryWithLLM: vi.fn(async (params) => ({
    text: 'Una vez había un gato. El gato era muy amistoso. Jugaba con sus amigos todos los días.',
    title: params.title || 'Generated Story',
  })),
  generateVocabFromText: vi.fn(async (params) => [
    { term: 'gato', definition: 'cat', pos: 'noun', level: 'a1' },
    { term: 'amistoso', definition: 'friendly', pos: 'adjective', level: 'a1' },
    { term: 'jugar', definition: 'to play', pos: 'verb', level: 'a1' },
  ]),
  generateSynopsis: vi.fn(async (params) => 'A short story about a friendly cat'),
  saveStoryDraft: vi.fn(async (draftData) => 'draft-id-456'),
}));

vi.mock('@/lib/agentPersistence', () => ({
  persistAgentRun: vi.fn(async (run) => 'content-run-id-123'),
  updateAgentRunOutput: vi.fn(async () => ({})),
}));

describe('Content Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSlug', () => {
    it('should generate valid URL-friendly slugs', async () => {
      const { generateSlug } = await vi.importMock('@/agents/content/tools');

      const slug = generateSlug('El Gato Amistoso', 'es', 'es', 1);

      expect(slug).toBe('el-gato-amistoso-es-es-1');
      expect(slug).toMatch(/^[a-z0-9\-]+$/);
      expect(slug).not.toMatch(/^-+|-+$/);
    });

    it('should handle special characters and accents', async () => {
      const { generateSlug } = await vi.importMock('@/agents/content/tools');

      const slug = generateSlug('Español Niño Día', 'es', 'es', 2);

      expect(slug).toContain('espanol');
      expect(slug).toContain('nino');
      expect(slug).toContain('dia');
      expect(slug).not.toContain('ñ');
      expect(slug).not.toContain('á');
    });

    it('should include language, variant, and slot in slug', async () => {
      const { generateSlug } = await vi.importMock('@/agents/content/tools');

      const slug = generateSlug('My Story', 'en', 'us', 3);

      expect(slug).toContain('my-story');
      expect(slug).toContain('en');
      expect(slug).toContain('us');
      expect(slug).toContain('3');
    });
  });

  describe('loadBrief', () => {
    it('should load brief successfully', async () => {
      const { loadBrief } = await vi.importMock('@/agents/content/tools');

      const brief = await loadBrief('brief-123');

      expect(brief.id).toBe('brief-123');
      expect(brief.language).toBe('es');
      expect(brief.level).toBe('a1');
      expect(brief.title).toBe('Test Story');
    });

    it('should throw error for missing brief', async () => {
      const { loadBrief } = await vi.importMock('@/agents/content/tools');

      await expect(loadBrief('')).rejects.toThrow('Brief ID required');
    });
  });

  describe('runContentAgent', () => {
    it('should generate content successfully', async () => {
      const result = await runContentAgent('brief-123');

      expect(result.agent).toBe('content');
      expect(result.status).toBe('completed');
      expect(result.output.status).toBe('generated');
      expect(result.output.draftId).toBe('draft-id-456');
    });

    it('should generate slug and include it in output', async () => {
      const result = await runContentAgent('brief-123');

      expect(result.output.slug).toBeTruthy();
      expect(result.output.slug).toMatch(/^[a-z0-9\-]+$/);
    });

    it('should include generated content metadata', async () => {
      const result = await runContentAgent('brief-123');

      expect(result.output.title).toBe('Test Story');
      expect(result.output.synopsis).toBe('A short story about a friendly cat');
      expect(result.output.vocabItemCount).toBe(3);
      expect(result.output.wordCount).toBeGreaterThan(0);
      expect(result.output.textPreview.length).toBeLessThanOrEqual(200);
      expect(result.output.textPreview.length).toBeGreaterThan(0);
    });

    it('should persist agent run with correct metadata', async () => {
      const result = await runContentAgent('brief-123');

      expect(result.runId).toBe('content-run-id-123');
      expect(result.input.briefId).toBe('brief-123');
      expect(result.input.language).toBe('es');
      expect(result.input.level).toBe('a1');
      expect(result.toolsUsed.length).toBeGreaterThan(0);
    });

    it('should include all required tools in run summary', async () => {
      const result = await runContentAgent('brief-123');

      const toolNames = result.toolsUsed.map((t) => t.toolName);

      expect(toolNames).toContain('loadBrief');
      expect(toolNames).toContain('generateSlug');
      expect(toolNames).toContain('generateStoryWithLLM');
      expect(toolNames).toContain('generateVocabFromText');
      expect(toolNames).toContain('generateSynopsis');
      expect(toolNames).toContain('saveStoryDraft');
    });
  });

  describe('Content generation pipeline', () => {
    it('should flow through: loadBrief -> generateSlug -> generateStory -> vocab -> synopsis -> save', async () => {
      const { loadBrief, generateSlug, generateStoryWithLLM } = await vi.importMock(
        '@/agents/content/tools'
      );

      const result = await runContentAgent('brief-123');

      expect(loadBrief).toHaveBeenCalledWith('brief-123');
      expect(generateSlug).toHaveBeenCalled();
      expect(generateStoryWithLLM).toHaveBeenCalled();
      expect(result.output.status).toBe('generated');
    });

    it('should handle story data correctly', async () => {
      const result = await runContentAgent('brief-123');

      expect(result.output.title).toBeTruthy();
      expect(result.output.slug).toBeTruthy();
      expect(result.output.wordCount).toBeGreaterThan(0);
      expect(result.output.textPreview).toBeTruthy();
      expect(result.output.vocabItemCount).toBeGreaterThanOrEqual(0);
      expect(result.output.synopsis).toBeTruthy();
    });
  });

  describe('Error handling', () => {
    it('should handle brief loading errors gracefully', async () => {
      const { loadBrief } = await vi.importMock('@/agents/content/tools');
      (loadBrief as any).mockRejectedValueOnce(new Error('Brief not found'));

      const result = await runContentAgent('nonexistent-brief');

      expect(result.status).toBe('failed');
      expect(result.output.status).toBe('failed');
      expect(result.output.draftId).toBeNull();
      expect(result.output.summary).toContain('Fallo');
    });

    it('should include error message in output summary', async () => {
      const { loadBrief } = await vi.importMock('@/agents/content/tools');
      (loadBrief as any).mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await runContentAgent('brief-123');

      expect(result.output.summary).toContain('Database connection failed');
    });
  });
});
