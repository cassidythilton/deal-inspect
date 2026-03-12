/**
 * TDR Readout Service — Frontend service for assembling readout data
 * and generating PDFs.
 *
 * Sprint 13: TDR Readout PDF Engine
 */

import { isDomoEnvironment } from './domo';
import type { ReadoutPayload } from '@/components/pdf/readoutTypes';

// ─── Code Engine Calling ─────────────────────────────────────────────────────

interface DomoSDK {
  get: (url: string) => Promise<unknown>;
  post: (url: string, body?: unknown) => Promise<unknown>;
  put: (url: string, body?: unknown) => Promise<unknown>;
  delete: (url: string) => Promise<unknown>;
}

function getDomo(): DomoSDK | null {
  const domo =
    (window as unknown as { domo?: DomoSDK }).domo ||
    (globalThis as unknown as { domo?: DomoSDK }).domo;
  return domo || null;
}

const CE_BASE = '/domo/codeengine/v2/packages';

async function callCodeEngine<T>(fnName: string, args: Record<string, unknown> = {}): Promise<T> {
  const domo = getDomo();
  if (!domo) throw new Error(`[Readout] No Domo SDK — function: ${fnName}`);
  const url = `${CE_BASE}/${fnName}`;
  console.log(`[Readout] Calling Code Engine: ${fnName}`, Object.keys(args));
  const result = await domo.post(url, args);
  console.log(`[Readout] Code Engine raw response for ${fnName}:`, result);
  return result as T;
}

function extractResult(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null) {
    if ('success' in raw) return raw as Record<string, unknown>;
    const keys = Object.keys(raw);
    if (keys.length === 1) {
      const inner = (raw as Record<string, unknown>)[keys[0]];
      if (typeof inner === 'object' && inner !== null) return inner as Record<string, unknown>;
    }
  }
  return raw as Record<string, unknown>;
}

// ─── Mock data for dev mode ──────────────────────────────────────────────────

const MOCK_READOUT: ReadoutPayload = {
  success: true,
  session: {
    sessionId: 'mock-sess-001',
    opportunityId: 'mock-opp-001',
    opportunityName: 'Acme Corp — Data Modernization',
    accountName: 'Acme Corp',
    acv: 125000,
    stage: '3: Demonstrate Value',
    status: 'in-progress',
    owner: 'Andrew Rich',
    createdBy: 'current-user',
    iteration: 2,
    notes: 'Strong technical alignment, needs champion identification.',
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  inputs: [
    // Step 1: Deal Context
    { stepId: 'deal-context', fieldId: 'strategic-value', value: 'High', savedAt: new Date().toISOString() },
    { stepId: 'deal-context', fieldId: 'customer-goal', value: 'Account is migrating from legacy Teradata to Snowflake and evaluating BI consolidation.', savedAt: new Date().toISOString() },
    { stepId: 'deal-context', fieldId: 'why-now', value: 'Unified analytics across 15 business units — $2M annual reporting cost reduction.', savedAt: new Date().toISOString() },
    { stepId: 'deal-context', fieldId: 'key-technical-stakeholders', value: 'CTO, VP Data Engineering', savedAt: new Date().toISOString() },
    { stepId: 'deal-context', fieldId: 'timeline', value: 'This Quarter', savedAt: new Date().toISOString() },
    // Step 2: Technical Architecture
    { stepId: 'tech-architecture', fieldId: 'cloud-platform', value: 'Snowflake', savedAt: new Date().toISOString() },
    { stepId: 'tech-architecture', fieldId: 'current-state', value: 'Snowflake (Enterprise), AWS, Tableau, dbt, Kafka, Salesforce CRM. Legacy Teradata being retired.', savedAt: new Date().toISOString() },
    { stepId: 'tech-architecture', fieldId: 'target-state', value: 'Domo as unified analytics layer. Data flows from Snowflake via MagicETL. Embedded analytics for customer-facing apps.', savedAt: new Date().toISOString() },
    { stepId: 'tech-architecture', fieldId: 'domo-layers', value: '["Data Integration","Visualization / BI","Embedded Analytics"]', savedAt: new Date().toISOString() },
    { stepId: 'tech-architecture', fieldId: 'why-domo', value: 'Composable architecture, embedded analytics, and Snowflake-native integration.', savedAt: new Date().toISOString() },
    // Step 3: Risk & Verdict
    { stepId: 'risk-verdict', fieldId: 'top-risks', value: 'Tableau entrenched for exec dashboards. ThoughtSpot POC planned Q1 2026.', savedAt: new Date().toISOString() },
    { stepId: 'risk-verdict', fieldId: 'key-assumption', value: 'CTO will champion Domo over ThoughtSpot if architecture story resonates.', savedAt: new Date().toISOString() },
    { stepId: 'risk-verdict', fieldId: 'verdict', value: 'Proceed', savedAt: new Date().toISOString() },
    { stepId: 'risk-verdict', fieldId: 'partner-name', value: 'Snowflake', savedAt: new Date().toISOString() },
    { stepId: 'risk-verdict', fieldId: 'partner-posture', value: 'Amplifying', savedAt: new Date().toISOString() },
    // Step 4: AI & ML
    { stepId: 'ai-ml', fieldId: 'ai-level', value: 'Generative AI', savedAt: new Date().toISOString() },
    { stepId: 'ai-ml', fieldId: 'ai-signals', value: '["Manual review loops","Workflow bottlenecks (handoffs, approvals, queue time)"]', savedAt: new Date().toISOString() },
    { stepId: 'ai-ml', fieldId: 'ai-problem', value: 'Reports and summaries are created manually. AI could generate executive briefings from data.', savedAt: new Date().toISOString() },
    { stepId: 'ai-ml', fieldId: 'ai-data', value: '["Structured data (CRM, ERP, databases)"]', savedAt: new Date().toISOString() },
    { stepId: 'ai-ml', fieldId: 'ai-value', value: 'Reduce report creation time by 60%. Clear ownership with Data team.', savedAt: new Date().toISOString() },
    // Step 5: Adoption
    { stepId: 'adoption', fieldId: 'expected-users', value: '150 power users, 500 viewers', savedAt: new Date().toISOString() },
    { stepId: 'adoption', fieldId: 'adoption-success', value: 'Adoption plan: phased rollout. Success metrics: 80% weekly active users within 90 days.', savedAt: new Date().toISOString() },
  ],
  sumble: {
    technologies: { BI: ['Tableau', 'Looker'], DW: ['Snowflake'], Cloud: ['AWS'], CRM: ['Salesforce'] },
    pulledAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  perplexity: {
    summary: 'Acme Corp is a Fortune 500 manufacturer undergoing a major digital transformation. They recently announced a $50M investment in data infrastructure and are consolidating from 7 BI tools to a single platform.',
    recentInitiatives: ['$50M data infrastructure investment', 'BI consolidation from 7 tools', 'Cloud migration (AWS)'],
    technologySignals: ['Snowflake Enterprise deployment', 'dbt for transformations', 'Evaluating ThoughtSpot'],
    competitiveLandscape: ['Tableau entrenched for executive dashboards', 'ThoughtSpot POC planned', 'Power BI used in finance division'],
    citations: ['https://acme.com/press/data-initiative', 'https://techcrunch.com/acme-data'],
    pulledAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  brief: {
    content: '**1. Executive Summary**\n\nAcme Corp is a mid-market deal involving cloud data modernization. Strong technical alignment with Domo positioning as the unified analytics layer.\n\n**2. Risk Factors**\n\n- Tableau is entrenched for executive dashboards\n- ThoughtSpot POC planned for Q1 2026\n- No identified internal champion yet\n\n**3. Recommended Actions**\n\n- Schedule architecture workshop\n- Prepare competitive positioning deck\n- Identify and engage CTO as potential champion',
    modelUsed: 'llama3.3-70b',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  classifiedFindings: {
    findings: [
      { finding: 'CTO stated goal of "single pane of glass"', category: 'strategic_initiative' },
      { finding: 'Budget allocated for BI modernization FY2026', category: 'expansion_opportunity' },
      { finding: 'ThoughtSpot evaluation in progress', category: 'competitive_threat' },
    ],
  },
  extractedEntities: {
    competitors: ['Tableau', 'ThoughtSpot', 'Power BI'],
    technologies: ['Snowflake', 'AWS', 'dbt', 'Kafka', 'Salesforce'],
    executives: ['CTO (unnamed)'],
    budgets: ['$50M data infrastructure'],
    timelines: ['ThoughtSpot POC Q1 2026', 'BI consolidation FY2026'],
  },
  chatHighlights: [
    { role: 'user', content: 'What is the competitive risk from ThoughtSpot?', provider: 'cortex', model: 'llama3.3-70b', createdAt: new Date(Date.now() - 86400000).toISOString() },
    { role: 'assistant', content: 'ThoughtSpot is evaluating for search-based analytics. Their strength is natural language queries, but Domo offers a more comprehensive platform with embedded analytics, data apps, and workflow automation. Position Domo as the full-stack alternative.', provider: 'cortex', model: 'llama3.3-70b', createdAt: new Date(Date.now() - 86400000).toISOString() },
  ],
  orgProfile: {
    industry: 'Manufacturing',
    totalEmployees: 12500,
    hqCountry: 'United States',
    hqState: 'California',
    pulledAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  hiringSignals: {
    jobCount: 8,
    jobsSummary: null,
    pulledAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  keyPeople: {
    peopleCount: 5,
    peopleSummary: null,
    pulledAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  actionPlan: null,
  generatedAt: new Date().toISOString(),
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DealTeamInfo {
  ae?: string;
  se?: string;
  seManager?: string;
  pocArchitect?: string;
  owner?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  memberCount: number;
}

export interface SlackDistributionResult {
  success: boolean;
  messageTs?: string;
  fileId?: string;
  channelName?: string;
  distributionId?: string;
  error?: string;
}

export interface ReadoutSummaryResult {
  success: boolean;
  summary?: string;
  modelUsed?: string;
  cached?: boolean;
  error?: string;
}

// ─── Session Cache ───────────────────────────────────────────────────────────
const _cache: { sessionId?: string; payload?: ReadoutPayload; pdfBase64?: string } = {};

// ─── Public API ──────────────────────────────────────────────────────────────

export const tdrReadout = {
  /**
   * Assemble the full TDR readout payload from Snowflake.
   */
  async assembleReadout(sessionId: string): Promise<ReadoutPayload> {
    if (_cache.sessionId === sessionId && _cache.payload?.success) {
      console.log('[Readout] Returning cached payload');
      return _cache.payload;
    }

    if (!isDomoEnvironment()) {
      console.log('[Readout] Dev mode: returning mock readout payload');
      return { ...MOCK_READOUT };
    }

    try {
      const raw = await callCodeEngine<unknown>('assembleTDRReadout', { sessionId });
      const result = extractResult(raw) as unknown as ReadoutPayload;
      _cache.sessionId = sessionId;
      _cache.payload = result;
      _cache.pdfBase64 = undefined;
      return result;
    } catch (err) {
      console.error('[Readout] assembleReadout failed:', err);
      return { ...MOCK_READOUT, success: false, error: String(err) };
    }
  },

  /**
   * Generate the PDF blob from a readout payload.
   * Uses dynamic import to avoid bundling @react-pdf/renderer on initial load.
   */
  async generatePDF(payload: ReadoutPayload): Promise<Blob> {
    const { pdf } = await import('@react-pdf/renderer');
    const { TDRReadoutDocument } = await import('@/components/pdf/TDRReadoutDocument');
    const { createElement } = await import('react');

    const doc = createElement(TDRReadoutDocument, { payload });
    const blob = await pdf(doc).toBlob();
    return blob;
  },

  /**
   * One-click download: assembles readout, generates PDF, triggers browser download.
   */
  async downloadReadout(sessionId: string, accountName: string): Promise<void> {
    // 1. Assemble data
    const payload = await this.assembleReadout(sessionId);
    if (!payload.success) {
      throw new Error(payload.error || 'Failed to assemble readout data');
    }

    // 2. Generate PDF
    const blob = await this.generatePDF(payload);

    // 3. Trigger download
    const date = new Date().toISOString().split('T')[0];
    const safeName = accountName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
    const filename = `TDR-Readout-${safeName}-${date}.pdf`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // ─── Sprint 14: Slack Distribution ──────────────────────────────────────────

  /**
   * Generate an AI-written executive summary for Slack distribution.
   */
  async generateReadoutSummary(sessionId: string, dealTeam?: DealTeamInfo, forceRegenerate?: boolean): Promise<ReadoutSummaryResult> {
    if (!isDomoEnvironment()) {
      return { success: true, summary: '**Deal Overview**\nAcme Corp is a $125K mid-market deal at Stage 3, positioning Domo as the unified analytics layer replacing a fragmented Tableau/ThoughtSpot stack.\n\n**Technical Positioning**\n- Key technical alignment on Snowflake + embedded analytics\n- Domo positioned to replace fragmented BI stack\n\n**Competitive Landscape**\n- Tableau and ThoughtSpot are incumbent tools\n- Domo differentiates with unified data + analytics platform\n\n**Risk & Recommendation**\n- Recommend scheduling architecture workshop and engaging CTO as champion\n- Proceed — close before ThoughtSpot POC in Q1 2026', cached: false };
    }
    try {
      const dealTeamJson = dealTeam ? JSON.stringify(dealTeam) : '';
      const args: Record<string, unknown> = { sessionId, dealTeamJson };
      if (forceRegenerate) args.forceRegenerate = true;
      const raw = await callCodeEngine<unknown>('generateReadoutSummary', args);
      const result = extractResult(raw);
      return {
        success: result.success as boolean,
        summary: result.summary as string || '',
        modelUsed: result.modelUsed as string || '',
        cached: result.cached as boolean || false,
        error: result.error as string | undefined,
      };
    } catch (err) {
      console.error('[Readout] generateReadoutSummary failed:', err);
      return { success: false, error: String(err) };
    }
  },

  /**
   * Fetch available Slack channels for the channel picker.
   */
  async getSlackChannels(): Promise<{ success: boolean; channels: SlackChannel[]; error?: string }> {
    if (!isDomoEnvironment()) {
      return { success: true, channels: [
        { id: 'C1234', name: 'tdr-readouts', isPrivate: false, memberCount: 15 },
        { id: 'C5678', name: 'se-team', isPrivate: false, memberCount: 28 },
        { id: 'G9012', name: 'deal-reviews', isPrivate: true, memberCount: 8 },
      ] };
    }
    try {
      const raw = await callCodeEngine<unknown>('getSlackChannels', { placeholder: 'list' });
      const result = extractResult(raw);
      return {
        success: result.success as boolean,
        channels: (result.channels as SlackChannel[]) || [],
        error: result.error as string | undefined,
      };
    } catch (err) {
      console.error('[Readout] getSlackChannels failed:', err);
      return { success: false, channels: [], error: String(err) };
    }
  },

  /**
   * Distribute a TDR readout to a Slack channel.
   * Sends executive-level Block Kit message with @mentions and inline PDF.
   */
  async distributeToSlack(
    sessionId: string,
    channel: string,
    summary: string,
    pdfBase64: string,
    dealTeam?: DealTeamInfo,
  ): Promise<SlackDistributionResult> {
    if (!isDomoEnvironment()) {
      return { success: true, messageTs: '1234567890.123456', channelName: channel, distributionId: 'mock-dist-001' };
    }
    try {
      const dealTeamJson = dealTeam ? JSON.stringify(dealTeam) : '{}';
      const raw = await callCodeEngine<unknown>('distributeToSlack', {
        sessionId, channel, summary, pdfBase64, dealTeamJson,
      });
      const result = extractResult(raw);
      return {
        success: result.success as boolean,
        messageTs: result.messageTs as string | undefined,
        fileId: result.fileId as string | undefined,
        channelName: result.channelName as string | undefined,
        distributionId: result.distributionId as string | undefined,
        error: result.error as string | undefined,
      };
    } catch (err) {
      console.error('[Readout] distributeToSlack failed:', err);
      return { success: false, error: String(err) };
    }
  },

  /**
   * Full share workflow: assemble → generate PDF → generate summary → send to Slack.
   */
  async shareToSlack(
    sessionId: string,
    channel: string,
    accountName: string,
    customSummary?: string,
    dealTeam?: DealTeamInfo,
  ): Promise<SlackDistributionResult> {
    // 1. Assemble readout
    const payload = await this.assembleReadout(sessionId);
    if (!payload.success) {
      return { success: false, error: payload.error || 'Failed to assemble readout data' };
    }

    // 2. Generate PDF as base64 (use cache if same session)
    let pdfBase64 = '';
    if (_cache.sessionId === sessionId && _cache.pdfBase64) {
      console.log('[Readout] Using cached PDF');
      pdfBase64 = _cache.pdfBase64;
    } else {
      try {
        const blob = await this.generatePDF(payload);
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        pdfBase64 = btoa(binary);
        _cache.pdfBase64 = pdfBase64;
      } catch (pdfErr) {
        console.warn('[Readout] PDF generation failed, sending without attachment:', pdfErr);
      }
    }

    // 3. Generate or use custom summary
    let summary = customSummary || '';
    if (!summary) {
      const summaryResult = await this.generateReadoutSummary(sessionId, dealTeam);
      summary = summaryResult.summary || `TDR Readout for ${accountName}`;
    }

    // 4. Distribute with deal team context
    return this.distributeToSlack(sessionId, channel, summary, pdfBase64, dealTeam);
  },
};

