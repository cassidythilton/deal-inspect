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

export interface GongDigestResponse {
  success: boolean;
  digest: string | null;
  accountName?: string;
  opportunityName?: string;
  callCount?: number;
  transcriptLength?: number;
  error?: string;
  reason?: string;
}

const MOCK_DIGEST = `## Gong Call Transcript Digest

### Key Topics & Themes
- Enterprise analytics platform evaluation — customer consolidating BI tools
- Data integration from Snowflake and multiple cloud sources
- Embedded analytics requirements for customer-facing dashboards

### Customer Requirements
- SOC 2 Type II compliance, data residency in US-EAST-1
- Single sign-on with Active Directory integration
- Real-time data refresh (not just nightly batch)

### AI & Advanced Analytics Opportunities
- **Incentive intelligence**: Customer VP mentioned "we need to optimize our reward programs using predictive models"
- Personalization engines for marketing campaigns
- Churn prediction for loyalty program members

### Objections & Concerns
- Pricing sensitivity — comparing against Power BI and Tableau
- Concerns about migration timeline from existing tools

### Key Stakeholders
- VP of Data (technical champion, pushing for consolidation)
- CFO (budget authority, needs ROI justification)
- Director of Engineering (evaluating technical fit)`;

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

  async getDigest(opportunityId: string): Promise<GongDigestResponse> {
    if (!isDomoEnvironment()) {
      console.log('[GongTranscripts] Dev mode: returning mock digest');
      await new Promise((r) => setTimeout(r, 800));
      return { success: true, digest: MOCK_DIGEST, callCount: 4, transcriptLength: 24000 };
    }

    const domo = getDomo();
    if (!domo) {
      return { success: false, digest: null, error: 'No Domo SDK' };
    }

    try {
      console.log(`[GongTranscripts] Fetching digest for opp: ${opportunityId}`);
      const raw = (await domo.post('/domo/codeengine/v2/packages/getGongTranscriptDigest', {
        opportunityId,
      })) as Record<string, unknown>;

      const inner = (raw?.result as GongDigestResponse) || (raw as GongDigestResponse);
      return {
        success: inner.success ?? false,
        digest: inner.digest || null,
        accountName: inner.accountName as string | undefined,
        opportunityName: inner.opportunityName as string | undefined,
        callCount: inner.callCount as number | undefined,
        transcriptLength: inner.transcriptLength as number | undefined,
        error: inner.error,
        reason: inner.reason,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[GongTranscripts] Digest fetch failed:', msg);
      return { success: false, digest: null, error: msg };
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
