# Agent Pipeline Tests

This directory contains comprehensive unit and integration tests for the agent pipeline, which consists of three main agents: **Planner**, **Content**, and **QA**.

## Overview

The agent pipeline orchestrates the creation of educational language stories:

1. **Planner Agent** (`planner.test.ts`) - Detects curriculum gaps and proposes/creates journeys
2. **Content Agent** (`content.test.ts`) - Generates story content using LLM
3. **QA Agent** (`qa.test.ts`) - Validates generated stories against quality criteria
4. **Pipeline Integration** (`pipeline.test.ts`) - Tests the full end-to-end flow

## Running Tests

### Run all tests once
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run specific test file
```bash
npx vitest run src/agents/__tests__/planner.test.ts
```

### Run tests with coverage
```bash
npx vitest run --coverage
```

## Test Structure

### Planner Agent Tests (`planner.test.ts`)

Tests for the gap detection and journey creation logic.

**Key test cases:**
- Input validation for `PlannerAgentInput` types
- Gap detection with catalog mocking
- Journey creation mode
- Tool usage tracking
- Error handling and graceful failures

**What it validates:**
- Planner can run in "gaps" mode to detect curriculum holes
- Planner can run in "create-journey" mode to create new learning paths
- Detected gaps are properly categorized by language, level, and topic
- Briefs are created for detected gaps
- Run metadata (runId, timestamps) is properly persisted

### Content Agent Tests (`content.test.ts`)

Tests for story generation and slug creation.

**Key test cases:**
- Slug generation with proper URL encoding and accent removal
- Brief loading and validation
- LLM-based story generation
- Vocabulary extraction from text
- Synopsis generation
- Draft saving and persistence
- Error handling for missing briefs

**What it validates:**
- Slugs are valid URL-safe strings (lowercase, no accents, hyphens)
- All required content elements are generated (title, text, vocab, synopsis)
- Word count is calculated correctly
- Vocabulary items are properly formatted
- Generated content flows through the full pipeline

### QA Agent Tests (`qa.test.ts`)

Tests for quality assurance checks on stories.

**Key test cases:**
- Story validation with all required fields present (should pass)
- Story validation with missing critical fields (should fail)
- Score calculation based on findings severity
- Finding structure and suggestions
- Both journey story and draft QA modes
- Run metadata and persistence

**What it validates:**
- Stories with all fields (title, slug, text, synopsis, vocab, media) pass QA
- Missing critical fields result in "fail" status
- Warning-level findings result in "needs_review" status
- Info-level findings don't affect pass/fail but reduce score
- Score formula: `100 - (critical × 30) - (warning × 12) - (info × 3)`
- QA findings include actionable suggestions for fixing issues

### Pipeline Integration Tests (`pipeline.test.ts`)

Tests the full end-to-end workflow across all agents.

**Key test cases:**
- Complete flow: Planner → Content → QA
- Data integrity throughout the pipeline
- Proper input/output mapping between agents
- Journey creation and brief generation
- Error handling at each stage
- Run ID uniqueness and tracking
- Tool execution tracking
- Output structure consistency

**What it validates:**
- All agents work correctly in sequence
- Data flows properly between agents
- Each agent receives correct inputs from previous agent
- All outputs follow expected structure
- Timestamps are ISO strings
- Run IDs are unique per agent

## Mocking Strategy

All tests use `vi.mock()` to mock external dependencies:

### Mocked Modules

**Prisma Operations**
- `loadBrief()` returns test brief data
- `saveBriefs()` saves gaps as briefs
- `saveStoryDraft()` persists generated content

**OpenAI Integration**
- `generateStoryWithLLM()` returns mock story content
- `generateVocabFromText()` returns mock vocabulary items
- `generateSynopsis()` returns mock synopsis

**Sanity/Studio Integration**
- `loadJourneyStoryForQa()` returns mock story with all fields
- `loadDraftForQa()` returns mock draft converted to story shape

**Agent Persistence**
- `persistAgentRun()` generates unique run IDs
- `updateAgentRunOutput()` updates run output
- `persistQAReview()` saves QA reviews

**Config & Rules**
- `loadPedagogicalRules()` loads CEFR rules
- `getRuleForLevel()` returns level-specific constraints
- `buildContentPromptContext()` builds LLM prompts

### Why Mocking?

- **No external API calls** - Tests run without network access
- **Consistent data** - Mock data is deterministic and reproducible
- **Fast execution** - No database or API latency
- **Isolation** - Each test is independent of others
- **Reliability** - Tests don't fail due to external service outages

## Test Data

### Mock Stories
- Stories with all required fields for passing QA
- Stories with missing fields for failing QA
- Stories with different CEFR levels (a1, a2, b1, b2)
- Stories in different languages (es, en) and variants

### Mock Briefs
- Complete briefs with all metadata
- Briefs linked to journeys and topics
- Briefs with pedagogical constraints

### Mock Content
- Generated Spanish text samples
- Vocabulary lists with proper structure
- Synopses and titles

## Key Testing Patterns

### 1. Input Validation
Tests verify that agents accept and validate correct input types:
```typescript
const input: PlannerAgentInput = {
  mode: 'gaps',
  language: 'es',
  variant: 'es',
};
expect(input.mode).toBe('gaps');
```

### 2. Tool Mocking
Tools are mocked to return test data without side effects:
```typescript
vi.mock('@/agents/planner/tools', () => ({
  loadCatalog: vi.fn(async () => mockCatalogStories),
  detectGaps: vi.fn(async (stories, filters) => mockGaps),
}));
```

### 3. Integration Testing
Pipeline tests verify multi-agent flows:
```typescript
const planner = await runPlannerAgent(input);
const content = await runContentAgent(planner.output.briefId);
const qa = await runJourneyStoryQaAgent(content.output.storyId);
```

### 4. Error Scenarios
Tests verify graceful error handling:
```typescript
(loadBrief as any).mockRejectedValueOnce(new Error('Brief not found'));
const result = await runContentAgent('nonexistent-brief');
expect(result.status).toBe('failed');
```

## Coverage Goals

- **Planner Agent:** Gap detection logic, mode switching, journey creation
- **Content Agent:** Slug generation, content generation flow, error handling
- **QA Agent:** Field validation, score calculation, finding severity levels
- **Pipeline:** End-to-end flows, data integrity, agent composition

## Adding New Tests

1. Create test file: `src/agents/__tests__/feature.test.ts`
2. Import testing utilities:
   ```typescript
   import { describe, it, expect, vi, beforeEach } from 'vitest';
   ```
3. Mock external dependencies with `vi.mock()`
4. Write test cases with descriptive names
5. Use `beforeEach` to reset mocks between tests

Example:
```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something specific', async () => {
    const result = await functionUnderTest(input);
    expect(result).toEqual(expected);
  });
});
```

## Configuration

- **Framework:** Vitest (fast, Vite-native)
- **Environment:** Node.js (no browser simulation)
- **Path Aliases:** Supports `@/` imports matching tsconfig
- **Globals:** Test functions are global (describe, it, expect, etc.)

## Debugging Tests

### Run single test with verbose output
```bash
npx vitest run src/agents/__tests__/planner.test.ts --reporter=verbose
```

### Run with debugging
```bash
node --inspect-brk ./node_modules/vitest/vitest.mjs run
```

### Check mock call history
```typescript
const { loadBrief } = await vi.importMock('@/agents/content/tools');
expect(loadBrief).toHaveBeenCalledWith('brief-123');
expect(loadBrief).toHaveBeenCalledTimes(1);
```

## Next Steps

1. Install Vitest: `npm install -D vitest @vitejs/plugin-react`
2. Run tests: `npm test`
3. Monitor coverage: `npm run test -- --coverage`
4. Expand tests as new features are added
5. Use these tests as documentation for agent interfaces

## Related Files

- Agent implementations: `src/agents/[planner|content|qa]/agent.ts`
- Agent types: `src/agents/[planner|content|qa]/types.ts`
- Agent tools: `src/agents/[planner|content|qa]/tools.ts`
- Test config: `vitest.config.ts`
- Package scripts: `package.json` (test, test:watch)
