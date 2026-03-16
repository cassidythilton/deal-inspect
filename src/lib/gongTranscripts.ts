/**
 * Gong Transcript Search — Sprint 33
 *
 * Queries Gong call transcripts via Cortex Search (through Code Engine).
 * Transcripts are indexed in Snowflake and scoped by Opportunity ID.
 */

import { isDomoEnvironment } from './domo';

interface DomoSDK {
  post: (url: string, body?: unknown) => Promise<unknown>;
}

function getDomo(): DomoSDK | null {
  const domo =
    (window as unknown as { domo?: DomoSDK }).domo ||
    (globalThis as unknown as { domo?: DomoSDK }).domo;
  return domo || null;
}

export interface GongTranscriptResult {
  accountName: string;
  opportunityName: string;
  callCount: number;
  transcriptExcerpt: string;
  score: number;
}

export interface GongSearchResponse {
  success: boolean;
  results: GongTranscriptResult[];
  resultCount: number;
  error?: string;
}

const MOCK_RESULTS: GongTranscriptResult[] = [
  {
    accountName: 'Acme Technologies',
    opportunityName: 'Acme — Enterprise Analytics Platform',
    callCount: 4,
    transcriptExcerpt:
      '[2025-12-04]\nSE: What are the key security requirements for this deployment?\nCustomer VP: We need SOC 2 Type II compliance, and all data must stay in US-EAST-1. Our CISO is very firm on encryption at rest and in transit — AES-256 minimum. We also need audit logging for every data access event.\n\n[2025-12-11]\nSE: Let me revisit the timeline. When do you need to go live?\nCustomer VP: Our board mandate is Q2 next year. We have a hard deadline because the Teradata contract expires in June and we cannot renew it.',
    score: 0.87,
  },
];

export const gongTranscripts = {
  async search(
    opportunityId: string,
    query: string,
  ): Promise<GongSearchResponse> {
    if (!isDomoEnvironment()) {
      console.log('[GongTranscripts] Dev mode: returning mock results');
      await new Promise((r) => setTimeout(r, 400));
      return { success: true, results: MOCK_RESULTS, resultCount: MOCK_RESULTS.length };
    }

    const domo = getDomo();
    if (!domo) {
      return { success: false, results: [], resultCount: 0, error: 'No Domo SDK' };
    }

    try {
      console.log(`[GongTranscripts] Searching for: "${query.substring(0, 60)}..." (opp: ${opportunityId})`);
      const raw = (await domo.post('/domo/codeengine/v2/packages/searchGongTranscripts', {
        opportunityId,
        query,
      })) as Record<string, unknown>;

      const inner = (raw?.result as GongSearchResponse) || (raw as GongSearchResponse);
      return {
        success: inner.success ?? true,
        results: inner.results || [],
        resultCount: inner.resultCount || 0,
        error: inner.error,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[GongTranscripts] Search failed:', msg);
      return { success: false, results: [], resultCount: 0, error: msg };
    }
  },

  buildChatContext(results: GongTranscriptResult[], maxChars = 4000): string {
    if (results.length === 0) return '';

    let context =
      '### Gong Call Transcript Context\nThe following excerpts are from actual sales call transcripts for this deal:\n\n';
    let charCount = context.length;

    for (const result of results) {
      const header = `**${result.opportunityName}** (${result.callCount} calls, relevance: ${Math.round(result.score * 100)}%)\n`;
      const body = result.transcriptExcerpt + '\n\n';

      if (charCount + header.length + body.length > maxChars) break;

      context += header + body;
      charCount += header.length + body.length;
    }

    return context;
  },
};
