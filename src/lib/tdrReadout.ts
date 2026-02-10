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
    { stepId: 'step-1', fieldId: 'Strategic Value', value: 'Account is migrating from legacy Teradata to Snowflake and evaluating BI consolidation.', savedAt: new Date().toISOString() },
    { stepId: 'step-1', fieldId: 'Business Impact', value: 'Unified analytics across 15 business units — $2M annual reporting cost reduction.', savedAt: new Date().toISOString() },
    { stepId: 'step-2', fieldId: 'Current Architecture', value: 'Snowflake (Enterprise), AWS, Tableau, dbt, Kafka, Salesforce CRM.', savedAt: new Date().toISOString() },
    { stepId: 'step-3', fieldId: 'Competitive Analysis', value: 'Tableau entrenched for exec dashboards. ThoughtSpot POC planned Q1 2026.', savedAt: new Date().toISOString() },
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
  generatedAt: new Date().toISOString(),
};

// ─── Public API ──────────────────────────────────────────────────────────────

export const tdrReadout = {
  /**
   * Assemble the full TDR readout payload from Snowflake.
   */
  async assembleReadout(sessionId: string): Promise<ReadoutPayload> {
    if (!isDomoEnvironment()) {
      console.log('[Readout] Dev mode: returning mock readout payload');
      return { ...MOCK_READOUT };
    }

    try {
      const raw = await callCodeEngine<unknown>('assembleTDRReadout', { sessionId });
      const result = extractResult(raw) as unknown as ReadoutPayload;
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
};

