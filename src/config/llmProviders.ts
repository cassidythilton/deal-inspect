/**
 * LLM Provider Registry — Sprint 8
 *
 * Central configuration for all LLM providers and models available
 * in the TDR Inline Chat experience.
 */

export type ProviderKey = 'cortex' | 'perplexity' | 'domo';

export interface LLMModel {
  id: string;
  label: string;
  description?: string;
  contextWindow?: number;
  costTier?: 'low' | 'medium' | 'high';
}

export interface LLMProvider {
  key: ProviderKey;
  label: string;
  icon: string;
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
    icon: '❄️',
    description: 'Snowflake-hosted models via AI_COMPLETE',
    serverSide: true,
    defaultModelId: 'llama3.3-70b',
    models: [
      { id: 'llama3.3-70b', label: 'Llama 3.3 70B', description: 'Fast, great reasoning', costTier: 'medium' },
      { id: 'llama3.1-405b', label: 'Llama 3.1 405B', description: 'Most capable open model', costTier: 'high' },
      { id: 'mistral-large2', label: 'Mistral Large 2', description: 'Strong multilingual', costTier: 'medium' },
      { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', description: 'Anthropic on Snowflake', costTier: 'high' },
      { id: 'snowflake-arctic', label: 'Snowflake Arctic', description: 'Snowflake native model', costTier: 'low' },
    ],
  },
  perplexity: {
    key: 'perplexity',
    label: 'Perplexity',
    icon: '🔍',
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
    icon: '🤖',
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

