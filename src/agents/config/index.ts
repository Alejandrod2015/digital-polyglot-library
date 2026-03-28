/**
 * Configuration module for Digital Polyglot Library agents
 * Re-exports pedagogical rules and helper functions
 */

export {
  type CEFRLevel,
  type PedagogicalRule,
  PEDAGOGICAL_RULES,
  getRuleForLevel,
  getRuleForLevelAsync,
  loadPedagogicalRules,
  invalidatePedagogicalCache,
  buildContentPromptContext,
} from "./pedagogicalConfig";
