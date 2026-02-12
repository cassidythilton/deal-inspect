/**
 * LLM Provider Registry — Sprint 8 / Updated Sprint 22
 *
 * Central configuration for all LLM providers and models available
 * in the TDR Inline Chat experience.
 *
 * Sprint 22: Replaced legacy open-source models with frontier models
 * from Anthropic (Claude 4) and OpenAI (GPT-4.1, o4-mini) on Snowflake Cortex.
 */

export type ProviderKey = 'cortex' | 'perplexity' | 'domo';

export interface LLMModel {
  id: string;
  label: string;
  description?: string;
  contextWindow?: number;
  costTier?: 'low' | 'medium' | 'high';
}

/** Icon key — mapped to Lucide components in the UI layer */
export type ProviderIconKey = 'snowflake' | 'search' | 'cpu';

export interface LLMProvider {
  key: ProviderKey;
  label: string;
  icon: ProviderIconKey;
  description: string;
  models: LLMModel[];
  defaultModelId: string;
  /** Whether this provider routes through Code Engine (true) or frontend-direct (false) */
  serverSide: boolean;
}

export const LLM_PROVIDERS: Record<ProviderKey, LLMProvider> = {
  cortex: {
    key: 'cortex',
    label: 'Snowflake Cortex',
    icon: 'snowflake',
    description: 'Snowflake-hosted models via AI_COMPLETE',
    serverSide: true,
    defaultModelId: 'claude-4-sonnet',
    models: [
      { id: 'claude-4-sonnet', label: 'Claude 4 Sonnet', description: 'Fast, excellent reasoning', costTier: 'medium' },
      { id: 'claude-4-opus', label: 'Claude 4 Opus', description: 'Most capable, deep reasoning', costTier: 'high' },
      { id: 'openai-gpt-4.1', label: 'GPT-4.1', description: 'Latest GPT, strong all-around', costTier: 'high' },
      { id: 'openai-o4-mini', label: 'OpenAI o4-mini', description: 'Reasoning-optimized, efficient', costTier: 'medium' },
    ],
  },
  perplexity: {
    key: 'perplexity',
    label: 'Perplexity',
    icon: 'search',
    description: 'Web-grounded answers with citations',
    serverSide: true,
    defaultModelId: 'sonar',
    models: [
      { id: 'sonar', label: 'Sonar', description: 'Fast web search', costTier: 'low' },
      { id: 'sonar-pro', label: 'Sonar Pro', description: 'Deeper research', costTier: 'medium' },
    ],
  },
  domo: {
    key: 'domo',
    label: 'Domo AI',
    icon: 'cpu',
    description: "Domo's native AI — no Code Engine needed",
    serverSide: false,
    defaultModelId: 'default',
    models: [
      { id: 'default', label: 'Domo Default', description: 'Built-in Domo AI model', costTier: 'low' },
    ],
  },
};

/** Flat list of all providers for iteration */
export const PROVIDER_LIST: LLMProvider[] = Object.values(LLM_PROVIDERS);

/** Get the default model for a provider */
export function getDefaultModel(providerKey: ProviderKey): LLMModel {
  const provider = LLM_PROVIDERS[providerKey];
  return provider.models.find((m) => m.id === provider.defaultModelId) || provider.models[0];
}

