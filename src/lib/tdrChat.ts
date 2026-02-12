/**
 * TDR Chat Service — Sprint 8
 *
 * Provides a unified interface for multi-provider chat in the TDR workspace.
 * Routes messages through Code Engine (Cortex/Perplexity) or Domo AI (direct).
 */

import { isDomoEnvironment } from './domo';
import type { ProviderKey } from '@/config/llmProviders';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  messageId: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  contextStep?: string | null;
  provider?: string | null;
  modelUsed?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  citedSources?: string[] | null;
  createdAt?: string;
}

export interface SendMessageParams {
  sessionId: string;
  opportunityId: string;
  accountName: string;
  userMessage: string;
  provider: ProviderKey;
  model: string;
  contextStep?: string;
  createdBy?: string;
  includeKnowledgeBase?: boolean;
}

export interface SendMessageResult {
  success: boolean;
  userMessageId?: string;
  assistantMessageId?: string;
  content?: string;
  provider?: string;
  model?: string;
  tokensIn?: number | null;
  tokensOut?: number | null;
  citations?: string[] | null;
  durationMs?: number;
  error?: string;
}

// ─── Code Engine ─────────────────────────────────────────────────────────────

interface DomoSDK {
  get: (url: string) => Promise<unknown>;
  post: (url: string, body?: unknown) => Promise<unknown>;
}

function getDomo(): DomoSDK | null {
  const domo =
    (window as unknown as { domo?: DomoSDK }).domo ||
    (globalThis as unknown as { domo?: DomoSDK }).domo;
  return domo || null;
}

const CE_BASE = '/domo/codeengine/v2/packages';

async function callCodeEngine<T>(
  fnName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const domo = getDomo();
  if (!domo) throw new Error(`[TDRChat] No Domo SDK — function: ${fnName}`);

  const url = `${CE_BASE}/${fnName}`;
  console.log(`[TDRChat] Calling Code Engine: ${fnName}`, Object.keys(args));

  try {
    const result = await domo.post(url, args);
    console.log(`[TDRChat] Code Engine response for ${fnName}:`, result);
    return result as T;
  } catch (err) {
    console.error(`[TDRChat] Code Engine call failed: ${fnName}`, err);
    throw err;
  }
}

function extractResult(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null) {
    if ('success' in raw) return raw as Record<string, unknown>;
    const keys = Object.keys(raw);
    if (keys.length === 1) {
      const inner = (raw as Record<string, unknown>)[keys[0]];
      if (typeof inner === 'object' && inner !== null)
        return inner as Record<string, unknown>;
    }
  }
  return (raw as Record<string, unknown>) || {};
}

// ─── Domo AI (direct frontend call) ─────────────────────────────────────────

async function callDomoAI(input: string): Promise<string> {
  const domo = getDomo();
  if (!domo) throw new Error('[TDRChat] No Domo SDK for AI call');

  const result = (await domo.post('/domo/ai/v1/text/chat', {
    input,
    temperature: 0.3,
  })) as { choices?: Array<{ output?: string }>; output?: string };

  return result.choices?.[0]?.output || (result as { output?: string }).output || '';
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

let mockCounter = 0;

const MOCK_RESPONSES: Record<string, string> = {
  cortex: `Based on the deal context, here are my key observations:

**Technical Fit**: The account's current tech stack (Snowflake + AWS) aligns well with Domo's cloud-native architecture. The existing Tableau footprint represents a displacement opportunity.

**Risk Factors**:
- ThoughtSpot POC is a competitive threat — need to position Domo's embedded analytics strength
- No identified technical champion yet — recommend engaging the VP of Data

**Recommended Next Step**: Schedule an architecture workshop focused on the Snowflake → Domo integration story.`,
  perplexity: `Based on recent web research:

The account has been actively expanding their cloud data infrastructure. Key findings:
1. **Cloud Migration**: Announced a major Teradata → Snowflake migration in Q4 2025
2. **BI Consolidation**: CTO publicly stated goals for "single pane of glass" analytics
3. **Budget Signal**: BI modernization budget allocated for FY2026

*Sources: Company blog, LinkedIn posts, industry press releases*`,
  domo: `Looking at the deal data:

This opportunity shows strong indicators for a successful TDR:
- **ACV Alignment**: Deal value supports a full enterprise deployment
- **Stage Progression**: Moving through pipeline at expected velocity
- **Competitive Dynamics**: Manageable competitive landscape with clear differentiation points

I'd recommend focusing the TDR discussion on the technical architecture fit and partner alignment.`,
};

function getMockResponse(provider: ProviderKey): string {
  return MOCK_RESPONSES[provider] || MOCK_RESPONSES.cortex;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const tdrChat = {
  /**
   * Send a message and get an AI response.
   * Routes to the appropriate provider.
   */
  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const {
      sessionId,
      opportunityId,
      accountName,
      userMessage,
      provider,
      model,
      contextStep,
      createdBy,
      includeKnowledgeBase,
    } = params;

    // Dev mode — return mock
    if (!isDomoEnvironment()) {
      console.log(`[TDRChat] Dev mode: mock ${provider} response`);
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
      mockCounter++;
      return {
        success: true,
        userMessageId: `mock-user-${mockCounter}`,
        assistantMessageId: `mock-assistant-${mockCounter}`,
        content: getMockResponse(provider),
        provider,
        model,
        tokensIn: 150 + Math.floor(Math.random() * 200),
        tokensOut: 200 + Math.floor(Math.random() * 300),
        durationMs: 800 + Math.floor(Math.random() * 1200),
      };
    }

    // Domo AI: call frontend-direct, then persist via Code Engine
    if (provider === 'domo') {
      try {
        const domoInput = `You are a TDR analyst assistant for ${accountName}.\n\n${contextStep ? `Current TDR step: ${contextStep}\n\n` : ''}User question: ${userMessage}`;
        const assistantContent = await callDomoAI(domoInput);

        // Persist both messages via Code Engine
        const raw = await callCodeEngine<unknown>('sendChatMessage', {
          sessionId,
          opportunityId,
          accountName,
          userMessage,
          provider: 'domo',
          model: 'domo-default',
          contextStep: contextStep || '',
          createdBy: createdBy || 'current-user',
          assistantContent,
          includeKnowledgeBase: includeKnowledgeBase ? 'true' : 'false',
        });
        const result = extractResult(raw) as SendMessageResult;
        return { ...result, content: result.content || assistantContent };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[TDRChat] Domo AI send failed:', msg);
        return { success: false, error: msg };
      }
    }

    // Cortex / Perplexity — route through Code Engine
    try {
      const raw = await callCodeEngine<unknown>('sendChatMessage', {
        sessionId,
        opportunityId,
        accountName,
        userMessage,
        provider,
        model,
        contextStep: contextStep || '',
        createdBy: createdBy || 'current-user',
        assistantContent: '',
        includeKnowledgeBase: includeKnowledgeBase ? 'true' : 'false',
      });
      const result = extractResult(raw) as SendMessageResult;
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[TDRChat] ${provider} send failed:`, msg);
      return { success: false, error: msg };
    }
  },

  /**
   * Load chat history for a session.
   */
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    if (!isDomoEnvironment()) {
      console.log('[TDRChat] Dev mode: returning empty history');
      return [];
    }

    try {
      const raw = await callCodeEngine<unknown>('getChatHistory', { sessionId });
      const result = extractResult(raw) as {
        success?: boolean;
        messages?: ChatMessage[];
      };
      return result.messages || [];
    } catch (err) {
      console.error('[TDRChat] Failed to load chat history:', err);
      return [];
    }
  },
};


