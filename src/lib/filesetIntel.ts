/**
 * Fileset Intelligence — Sprint 19
 *
 * Integrates Domo filesets (PDFs — partner playbooks, competitive battle cards)
 * into the TDR experience via semantic search and Domo AI summarization.
 *
 * API Endpoints (via Domo SDK):
 *   - POST /domo/files/v1/filesets/{id}/query   → semantic search
 *   - GET  /domo/files/v1/filesets/{id}         → fileset metadata
 *   - GET  /domo/files/v1/filesets/{id}/files   → file listing
 *   - POST /domo/files/v1/filesets/search       → discover filesets
 *   - POST /domo/ai/v1/text/generation          → AI summarization
 */

import { isDomoEnvironment } from './domo';
import { getAppSettings } from './appSettings';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FilesetMetadata {
  id: string;
  name: string;
  description?: string;
  fileCount?: number;
  lastUpdated?: string;
  status?: string;
}

export interface FilesetMatch {
  content: {
    text: string;
  };
  metadata: {
    fileId?: string;
    path?: string;
    fileName?: string;
  };
  score: number;
  filesetInfo: {
    id: string;
    name: string;
  };
}

export interface FilesetSearchResult {
  matches: FilesetMatch[];
  query: string;
  filesetCount: number;
  totalMatches: number;
}

export interface FilesetSummary {
  summary: string;
  relevantDocuments: Array<{
    title: string;
    relevance: number;
    excerpt: string;
    source: string;
    filesetId: string;
  }>;
  competitorInsights: string[];
  partnerInsights: string[];
  matchSignal: 'strong' | 'partial' | 'none';
}

// ─── Domo SDK ────────────────────────────────────────────────────────────────

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

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Get metadata for a single fileset.
 */
async function getFilesetMetadata(filesetId: string): Promise<FilesetMetadata | null> {
  const domo = getDomo();
  if (!domo) return null;

  try {
    const meta = (await domo.get(`/domo/files/v1/filesets/${filesetId}`)) as Record<string, unknown>;
    return {
      id: filesetId,
      name: (meta.name as string) || (meta.title as string) || filesetId,
      description: (meta.description as string) || undefined,
      fileCount: (meta.fileCount as number) || (meta.file_count as number) || undefined,
      lastUpdated: (meta.updatedAt as string) || (meta.updated_at as string) || undefined,
      status: (meta.status as string) || 'active',
    };
  } catch (err) {
    console.warn(`[FilesetIntel] Failed to get metadata for ${filesetId}:`, err);
    return { id: filesetId, name: filesetId, status: 'error' };
  }
}

/**
 * Search a single fileset with a query. Tries multiple payload formats
 * for compatibility with different Domo API versions.
 */
async function searchFileset(
  filesetId: string,
  filesetName: string,
  query: string,
  topK = 8
): Promise<FilesetMatch[]> {
  const domo = getDomo();
  if (!domo) return [];

  const queryEndpoint = `/domo/files/v1/filesets/${filesetId}/query`;

  // Try multiple payload shapes — Domo's API can vary
  const payloadOptions = [
    { query, topK },
    { query, topK, includeContent: true },
    { query, limit: topK },
    { q: query, topK },
    { text: query, top_k: topK },
  ];

  for (const payload of payloadOptions) {
    try {
      console.log(`[FilesetIntel] Querying "${filesetName}" with payload:`, Object.keys(payload));
      const response = (await domo.post(queryEndpoint, payload)) as {
        matches?: FilesetMatch[];
        results?: FilesetMatch[];
      };

      const matches = response?.matches || response?.results || [];
      if (matches.length > 0) {
        return matches.map((m) => ({
          ...m,
          filesetInfo: m.filesetInfo || { id: filesetId, name: filesetName },
        }));
      }
    } catch (err) {
      console.log(`[FilesetIntel] Payload failed for "${filesetName}":`, err);
      continue;
    }
  }

  // Fallback: try listing files and matching by filename
  try {
    const filesEndpoint = `/domo/files/v1/filesets/${filesetId}/files`;
    const filesList = (await domo.get(filesEndpoint)) as {
      files?: Array<Record<string, unknown>>;
    };

    if (filesList?.files && filesList.files.length > 0) {
      const searchTerms = query.toLowerCase().split(/\s+/);
      const matchingFiles = filesList.files.filter((file) => {
        const filename = ((file.name as string) || (file.fileName as string) || '').toLowerCase();
        return searchTerms.some(
          (term) => filename.includes(term) || filename.includes(term.substring(0, 4))
        );
      });

      return matchingFiles.slice(0, topK).map((file, index) => ({
        content: {
          text: `Document: ${file.name || file.fileName || 'Unknown'}\nType: ${file.mimeType || 'PDF'}\nSize: ${file.size || 'Unknown'} bytes`,
        },
        metadata: {
          fileId: (file.id as string) || (file.fileId as string),
          path: (file.name as string) || (file.fileName as string) || 'Unknown',
          fileName: (file.name as string) || (file.fileName as string),
        },
        score: 0.6 - index * 0.05,
        filesetInfo: { id: filesetId, name: filesetName },
      }));
    }
  } catch (filesErr) {
    console.warn(`[FilesetIntel] File listing fallback failed for "${filesetName}":`, filesErr);
  }

  return [];
}

/**
 * Build a contextual search query from deal data for auto-search.
 */
function buildDealSearchQuery(context: {
  accountName?: string;
  competitors?: string[];
  partnerPlatform?: string;
  cloudPlatform?: string;
  industry?: string;
}): string {
  const parts: string[] = [];

  if (context.competitors && context.competitors.length > 0) {
    parts.push(`competitor ${context.competitors.slice(0, 3).join(' ')}`);
  }
  if (context.partnerPlatform) {
    parts.push(`partner ${context.partnerPlatform}`);
  }
  if (context.cloudPlatform) {
    parts.push(context.cloudPlatform);
  }
  if (context.industry) {
    parts.push(context.industry);
  }
  if (parts.length === 0 && context.accountName) {
    parts.push(`battle card competitive analysis ${context.accountName}`);
  }

  return parts.join(' ') || 'competitive battle card partner playbook';
}

/**
 * Summarize fileset results using Cortex AI via Code Engine.
 * Falls back to Domo AI text generation if Code Engine call fails.
 *
 * @param matches   - Fileset search matches
 * @param dealContext - Deal context string
 * @param sessionId  - Optional TDR session ID for Cortex context enrichment
 */
async function summarizeResults(
  matches: FilesetMatch[],
  dealContext: string,
  sessionId?: string
): Promise<string> {
  const domo = getDomo();
  if (!domo || matches.length === 0) return '';

  // Build structured document payload for Code Engine
  const documentPayload = matches.slice(0, 6).map((m) => ({
    title: m.metadata.fileName || m.metadata.path || 'Unknown',
    text: m.content.text,
    relevance: Math.round(m.score * 100),
    source: m.filesetInfo.name,
  }));

  // Try Cortex via Code Engine first (Sprint 19.5)
  // NOTE: If you get a 404 here, redeploy consolidated-sprint4-5.js in Domo Code Engine IDE.
  if (sessionId) {
    try {
      console.log('[FilesetIntel] Summarizing via Cortex Code Engine (sessionId:', sessionId, ')');
      const result = (await domo.post('/domo/codeengine/v2/packages/summarizeKBResults', {
        sessionId,
        documentTexts: JSON.stringify(documentPayload),
      })) as { success?: boolean; summary?: string; error?: string; result?: { success?: boolean; summary?: string; error?: string } };

      // Code Engine wraps response in { result: { ... } } — unwrap it
      const inner = result?.result || result;
      console.log('[FilesetIntel] Cortex KB raw response:', JSON.stringify(result).substring(0, 300));
      if (inner?.success && inner?.summary) {
        console.log('[FilesetIntel] Cortex KB summary received:', inner.summary.length, 'chars');
        return inner.summary;
      }
      console.warn('[FilesetIntel] Cortex KB summary returned empty or failed:', inner?.error);
    } catch (err) {
      console.warn('[FilesetIntel] Cortex Code Engine summarization failed (404 = redeploy Code Engine), falling back to Domo AI:', err);
    }
  }

  // Fallback: Domo AI text generation (original approach)
  // Also used when Cortex Code Engine isn't deployed or returns 404
  const documentTexts = matches
    .slice(0, 6)
    .map((m, i) => `[Doc ${i + 1}: ${m.metadata.fileName || m.metadata.path || 'Unknown'}]\n${m.content.text}`)
    .join('\n\n---\n\n');

  const prompt = `You are a TDR analyst. Based on the following documents from our knowledge base, provide a brief, actionable summary relevant to this deal context.

Deal Context: ${dealContext}

Documents:
${documentTexts}

Provide:
1. Key competitive insights from these documents
2. Relevant partner/platform guidance
3. Specific recommendations for this TDR

Keep the summary concise (3-5 bullet points). Focus on actionable intelligence.
POSITIONING (MANDATORY): Snowflake/Cortex are strategic partners — Domo enhances Cortex, never competes with it. Never describe Domo advantages over Cortex or propose comparisons vs Cortex. Named BI/analytics competitors (Tableau, Power BI, ThoughtSpot, Sigma, Looker, etc.) should be treated competitively.`;

  try {
    const result = (await domo.post('/domo/ai/v1/text/generation', {
      input: prompt,
      temperature: 0.3,
    })) as { output?: string; choices?: Array<{ output?: string }> };

    const summary = result?.choices?.[0]?.output || result?.output || '';
    if (summary) {
      console.log('[FilesetIntel] Domo AI fallback summary received:', summary.length, 'chars');
    }
    return summary;
  } catch (err) {
    console.warn('[FilesetIntel] AI summarization failed (both Cortex and Domo AI):', err);
    // Return a basic document listing as last resort
    const docList = matches
      .slice(0, 5)
      .map((m) => `• ${m.metadata.fileName || m.metadata.path || 'Document'} (${Math.round(m.score * 100)}% relevance)`)
      .join('\n');
    return docList ? `Relevant documents found:\n${docList}` : '';
  }
}

/**
 * Determine the match signal strength for scoring purposes.
 */
function evaluateMatchSignal(
  matches: FilesetMatch[],
  competitors: string[]
): 'strong' | 'partial' | 'none' {
  if (matches.length === 0) return 'none';

  const competitorLower = competitors.filter(c => typeof c === 'string' && c).map((c) => c.toLowerCase());
  const matchTexts = matches.map(
    (m) => `${m.content.text} ${m.metadata.fileName || ''}`.toLowerCase()
  );

  // Strong match: competitor name found in document content
  const hasCompetitorMatch = competitorLower.some((comp) =>
    matchTexts.some((text) => text.includes(comp))
  );

  if (hasCompetitorMatch && matches.some((m) => m.score >= 0.7)) {
    return 'strong';
  }
  if (hasCompetitorMatch || matches.some((m) => m.score >= 0.5)) {
    return 'partial';
  }
  if (matches.length > 0 && matches[0].score >= 0.3) {
    return 'partial';
  }

  return 'none';
}

// ─── Mock data for dev mode ──────────────────────────────────────────────────

function getMockSearchResults(query: string): FilesetSearchResult {
  return {
    matches: [
      {
        content: {
          text: 'Competitive Battle Card: Sigma Computing vs Domo\n\nKey Differentiators:\n- Domo offers full platform (ETL + analytics + apps) vs Sigma\'s spreadsheet-like BI\n- Domo embedded analytics far exceeds Sigma capabilities\n- Domo Workflows automate actions — Sigma is read-only\n\nWhen to use: Position Domo as the complete platform when Sigma is being evaluated for point analytics.',
        },
        metadata: {
          fileId: 'mock-1',
          path: 'Battle Cards/Sigma-vs-Domo.pdf',
          fileName: 'Sigma-vs-Domo.pdf',
        },
        score: 0.92,
        filesetInfo: { id: 'mock-fileset', name: 'Knowledge Base' },
      },
      {
        content: {
          text: 'Snowflake Co-Sell Playbook\n\nPartner Positioning:\n- Lead with data architecture story\n- Domo as the visualization and action layer on top of Snowflake\n- Joint solution brief available for customer presentations\n\nKey Technical Points:\n- Domo Cloud Amplifier for Snowflake reduces data movement\n- Federated queries keep data in Snowflake',
        },
        metadata: {
          fileId: 'mock-2',
          path: 'Partner Playbooks/Snowflake-CoSell.pdf',
          fileName: 'Snowflake-CoSell.pdf',
        },
        score: 0.85,
        filesetInfo: { id: 'mock-fileset', name: 'Knowledge Base' },
      },
      {
        content: {
          text: 'Enterprise Deal Architecture Patterns\n\nPattern 3: Cloud Data Platform + Domo\n- Customer has Snowflake/Databricks/BigQuery as data warehouse\n- Domo sits on top as analytics, embedded, and workflow layer\n- Integration via Cloud Amplifier or direct connectors\n\nBest for: Large enterprises with existing cloud investments.',
        },
        metadata: {
          fileId: 'mock-3',
          path: 'Architecture/Enterprise-Patterns.pdf',
          fileName: 'Enterprise-Patterns.pdf',
        },
        score: 0.78,
        filesetInfo: { id: 'mock-fileset', name: 'Knowledge Base' },
      },
    ],
    query,
    filesetCount: 1,
    totalMatches: 3,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const filesetIntel = {
  /**
   * Search all configured filesets with a query.
   */
  async search(query: string, filesetIds?: string[]): Promise<FilesetSearchResult> {
    const ids = filesetIds || getAppSettings().filesetIds || [];

    if (!isDomoEnvironment()) {
      console.log('[FilesetIntel] Dev mode: returning mock results');
      await new Promise((r) => setTimeout(r, 600));
      return getMockSearchResults(query);
    }

    if (ids.length === 0) {
      return { matches: [], query, filesetCount: 0, totalMatches: 0 };
    }

    console.log(`[FilesetIntel] Searching ${ids.length} filesets for: "${query}"`);

    // Get metadata for all filesets first
    const metadatas = await Promise.all(ids.map((id) => getFilesetMetadata(id)));
    const validFilesets = metadatas.filter((m): m is FilesetMetadata => m !== null && m.status !== 'error');

    // Search all filesets in parallel
    const searchPromises = validFilesets.map((fs) => searchFileset(fs.id, fs.name, query));
    const allResults = await Promise.all(searchPromises);

    // Combine and sort by score
    const combinedMatches: FilesetMatch[] = [];
    allResults.forEach((matches) => combinedMatches.push(...matches));
    combinedMatches.sort((a, b) => (b.score || 0) - (a.score || 0));

    const result: FilesetSearchResult = {
      matches: combinedMatches.slice(0, 15),
      query,
      filesetCount: validFilesets.length,
      totalMatches: combinedMatches.length,
    };

    console.log(`[FilesetIntel] Found ${result.totalMatches} matches across ${result.filesetCount} filesets`);
    return result;
  },

  /**
   * Auto-search filesets based on deal context. Used by TDRIntelligence panel.
   */
  async searchByDealContext(context: {
    accountName?: string;
    competitors?: string[];
    partnerPlatform?: string;
    cloudPlatform?: string;
    industry?: string;
  }): Promise<FilesetSearchResult> {
    const query = buildDealSearchQuery(context);
    return this.search(query);
  },

  /**
   * Get full summary with scoring signal. Used for Intelligence panel display.
   */
  async getIntelligenceSummary(
    searchResult: FilesetSearchResult,
    dealContext: string,
    competitors: string[],
    sessionId?: string
  ): Promise<FilesetSummary> {
    const matchSignal = evaluateMatchSignal(searchResult.matches, competitors);

    // Only summarize if we have meaningful matches
    let summary = '';
    if (searchResult.matches.length > 0 && matchSignal !== 'none') {
      summary = await summarizeResults(searchResult.matches, dealContext, sessionId);
    }

    const relevantDocuments = searchResult.matches.slice(0, 5).map((m) => ({
      title: m.metadata.fileName || m.metadata.path || 'Unknown Document',
      relevance: Math.round(m.score * 100),
      excerpt: m.content.text.substring(0, 200) + (m.content.text.length > 200 ? '...' : ''),
      source: m.filesetInfo.name,
      filesetId: m.filesetInfo.id,
    }));

    // Extract competitor/partner insights from match content
    const competitorInsights: string[] = [];
    const partnerInsights: string[] = [];
    const seenCompDocs = new Set<string>();
    const seenPartnerDocs = new Set<string>();

    for (const match of searchResult.matches.slice(0, 5)) {
      const text = match.content.text.toLowerCase();
      const rawName = match.metadata.fileName || '';
      const fileName = rawName.toLowerCase();
      // Create a short readable label from the filename (strip extension, truncate)
      const shortName = rawName.replace(/\.[^.]+$/, '').replace(/^.*[\\/]/, '');

      // Competitive signals — from filename or content
      const isCompetitiveFile = fileName.includes('battle') || fileName.includes('competitive') || fileName.includes('vs') || fileName.includes('compete');
      const hasCompetitiveContent = text.includes('competitive') || text.includes('differentiator') || text.includes('vs ') || text.includes('battle card');
      if ((isCompetitiveFile || hasCompetitiveContent) && !seenCompDocs.has(fileName)) {
        seenCompDocs.add(fileName);
        competitorInsights.push(shortName || 'Competitive intel');
      }

      // Partner signals — from filename or content
      const isPartnerFile = fileName.includes('partner') || fileName.includes('playbook') || fileName.includes('co-sell') || fileName.includes('cosell');
      const hasPartnerContent = text.includes('partner playbook') || text.includes('co-sell') || text.includes('joint pov');
      if ((isPartnerFile || hasPartnerContent) && !seenPartnerDocs.has(fileName)) {
        seenPartnerDocs.add(fileName);
        partnerInsights.push(shortName || 'Partner playbook');
      }
    }

    return {
      summary,
      relevantDocuments,
      competitorInsights,
      partnerInsights,
      matchSignal,
    };
  },

  /**
   * Get match signal for Post-TDR Score calculation.
   * Returns the numeric score contribution (0, 2, or 5).
   */
  getScoreSignal(matchSignal: 'strong' | 'partial' | 'none'): number {
    if (matchSignal === 'strong') return 5;
    if (matchSignal === 'partial') return 2;
    return 0;
  },

  /**
   * Get metadata for all configured filesets (for Settings page).
   */
  async getConfiguredFilesets(): Promise<FilesetMetadata[]> {
    const ids = getAppSettings().filesetIds || [];

    if (!isDomoEnvironment()) {
      return ids.map((id) => ({
        id,
        name: `Knowledge Base (${id.substring(0, 8)}...)`,
        description: 'Mock fileset for development',
        fileCount: 42,
        lastUpdated: new Date().toISOString(),
        status: 'active',
      }));
    }

    if (ids.length === 0) return [];

    const results = await Promise.all(ids.map((id) => getFilesetMetadata(id)));
    return results.filter((m): m is FilesetMetadata => m !== null);
  },

  /**
   * Discover available filesets in the Domo instance.
   * Tries multiple endpoints and response formats for Domo API compatibility.
   */
  async discoverFilesets(): Promise<FilesetMetadata[]> {
    const domo = getDomo();
    if (!domo) {
      console.warn('[FilesetIntel] discoverFilesets: No domo SDK available');
      return [];
    }

    // Multiple endpoints to try — Domo API can vary by environment
    const endpointsToTry = [
      { method: 'POST' as const, url: '/domo/files/v1/filesets/search?offset=0', body: {} },
      { method: 'GET' as const, url: '/domo/files/v1/filesets?offset=0', body: null },
      { method: 'GET' as const, url: '/domo/files/v1/filesets', body: null },
    ];

    for (const endpoint of endpointsToTry) {
      try {
        console.log(`[FilesetIntel] Trying ${endpoint.method} ${endpoint.url}...`);

        let response: unknown;
        if (endpoint.method === 'POST') {
          response = await domo.post(endpoint.url, endpoint.body ?? {});
        } else {
          response = await domo.get(endpoint.url);
        }

        console.log(`[FilesetIntel] Response from ${endpoint.url}:`, response);

        // Extract filesets from all known response shapes
        // The Domo API can return: fileSets (camelCase), filesets, results, data, items, or a direct array
        const resp = response as Record<string, unknown> | unknown[] | null;
        let rawFilesets: Array<Record<string, unknown>> = [];

        if (resp && (resp as Record<string, unknown>).fileSets) {
          rawFilesets = (resp as Record<string, unknown>).fileSets as Array<Record<string, unknown>>;
        } else if (resp && (resp as Record<string, unknown>).filesets) {
          rawFilesets = (resp as Record<string, unknown>).filesets as Array<Record<string, unknown>>;
        } else if (resp && Array.isArray(resp)) {
          rawFilesets = resp as Array<Record<string, unknown>>;
        } else if (resp && (resp as Record<string, unknown>).results) {
          rawFilesets = (resp as Record<string, unknown>).results as Array<Record<string, unknown>>;
        } else if (resp && (resp as Record<string, unknown>).data && Array.isArray((resp as Record<string, unknown>).data)) {
          rawFilesets = (resp as Record<string, unknown>).data as Array<Record<string, unknown>>;
        } else if (resp && (resp as Record<string, unknown>).items && Array.isArray((resp as Record<string, unknown>).items)) {
          rawFilesets = (resp as Record<string, unknown>).items as Array<Record<string, unknown>>;
        }

        console.log(`[FilesetIntel] Extracted ${rawFilesets.length} raw filesets from response`);

        if (rawFilesets.length > 0) {
          const mapped = rawFilesets
            .map((fs) => ({
              id: (fs.id as string) || (fs.filesetId as string) || '',
              name: (fs.name as string) || (fs.title as string) || 'Unknown',
              description: (fs.description as string) || undefined,
              fileCount: (fs.fileCount as number) || (fs.file_count as number) || undefined,
              lastUpdated: (fs.updatedAt as string) || (fs.lastModified as string) || (fs.last_modified as string) || undefined,
              status: 'active' as const,
            }))
            .filter((fs) => fs.id); // Filter out entries with no ID

          console.log(`[FilesetIntel] Discovered ${mapped.length} filesets (with valid IDs)`);
          return mapped;
        }
      } catch (err) {
        console.log(`[FilesetIntel] Failed with ${endpoint.method} ${endpoint.url}:`, err);
        continue; // Try next endpoint
      }
    }

    console.warn('[FilesetIntel] All fileset discovery endpoints failed or returned empty');
    return [];
  },

  /**
   * Build context string from fileset matches for chat injection.
   */
  buildChatContext(matches: FilesetMatch[], maxChars = 3000): string {
    if (matches.length === 0) return '';

    let context = '### Knowledge Base Context\nThe following excerpts are from internal documents (partner playbooks, competitive battle cards):\n\n';
    let charCount = context.length;

    for (const match of matches.slice(0, 6)) {
      const docHeader = `**[${match.metadata.fileName || match.metadata.path || 'Document'}]** (relevance: ${Math.round(match.score * 100)}%)\n`;
      const docText = match.content.text + '\n\n';

      if (charCount + docHeader.length + docText.length > maxChars) break;

      context += docHeader + docText;
      charCount += docHeader.length + docText.length;
    }

    return context;
  },
};

export type { FilesetMetadata as FilesetMeta };


