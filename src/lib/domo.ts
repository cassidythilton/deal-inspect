/**
 * Domo Data Layer
 * Handles all data fetching from Domo datasets with pre-filtering
 */

import { MAX_STAGE_AGE_DAYS, CLOSE_DATE_PROXIMITY_DAYS } from './constants';

export { MAX_STAGE_AGE_DAYS };

export interface DomoOpportunity {
  'Opportunity Id': string;
  'Opportunity Name': string;
  'Account Name': string;
  'Stage': string;
  'Stage Age': number | null;
  'ACV (USD)': number;
  'Likely': number;
  'Close Date': string;
  'Close Date FQ': string;
  'Domo Opportunity Owner': string;
  'Sales Consultant': string;
  'PoC Sales Consultant': string;
  'Primary Partner Role': string | null;
  'Partners Involved': string | null;
  'Partner Influence': string | null;
  'Snowflake Team Picklist': string | null;
  'Domo Forecast Category': string;
  'Type': string;
  'Deal Code': string | null;
  'Number of Competitors': number | null;
  'competitors': string | null;
  'Forecast Manager': string;
  'Webiste Domain': string | null;
  // ML & expanded fields
  'Account Revenue USD': number | null;
  'Account Employees': number | null;
  'Strategic Account': string | null;
  'Region': string | null;
  'Sales Segment': string | null;
  'Sales Vertical': string | null;
  'Platform Price': number | null;
  'Professional Services Price': number | null;
  'Line Items': number | null;
  'Contract Type': string | null;
  'Pricing Type': string | null;
  'CPQ': string | null;
  'Is Partner': string | null;
  'Is Pipeline': string | null;
  'Non-Competitive Deal': string | null;
  'People AI Engagement Level': string | null;
  'Is Closed': string | null;
  'Is Won': string | null;
  'Total Closed Won Count': number | null;
  'Total Closed Lost Count': number | null;
  'New Logo Won Count': number | null;
  'New Logo Lost Count': number | null;
  'Upsell Won Count': number | null;
  'Upsell Lost Count': number | null;
  'Total Opty Count': number | null;
  'Created Date': string | null;
  'Discovery Call Completed': string | null;
  'Demo Completed Date': string | null;
  'Pricing Call Date': string | null;
  'Gate Call Completed': string | null;
  'Has Pre-Call Plan': number | null;
  'Has ADM/AE Sync Agenda': number | null;
  'Forecast Comments': string | null;
  'Next Step': string | null;
  'Business Challenge': string | null;
  [key: string]: unknown;
}

// SE Mapping — exactly 2 columns in the actual dataset: se, se_manager
export interface DomoSEMapping {
  se: string;
  se_manager: string;
}

export const CONFIG = {
  datasets: {
    opportunities: 'opportunitiesmagic',
    seMapping: 'semapping',
  },
} as const;

/**
 * Normalize field names from Domo aliases to expected names
 */
function normalizeRecord<T>(record: Record<string, unknown>, fieldMap: Record<string, string>): T {
  const normalized: Record<string, unknown> = { ...record };
  for (const [alias, canonical] of Object.entries(fieldMap)) {
    if (alias in record && !(canonical in record)) {
      normalized[canonical] = record[alias];
    }
  }
  return normalized as T;
}

const OPPORTUNITY_FIELD_MAP: Record<string, string> = {
  'OpportunityId': 'Opportunity Id',
  'OpportunityName': 'Opportunity Name',
  'AccountName': 'Account Name',
  'StageAge': 'Stage Age',
  'AcvUsd': 'ACV (USD)',
  'CloseDate': 'Close Date',
  'CloseDateFQ': 'Close Date FQ',
  'DomoOpportunityOwner': 'Domo Opportunity Owner',
  'MgrForecastName': 'Forecast Manager',
  'SalesConsultant': 'Sales Consultant',
  'PocSalesConsultant': 'PoC Sales Consultant',
  'PrimaryPartnerRole': 'Primary Partner Role',
  'PartnersInvolved': 'Partners Involved',
  'PartnerInfluence': 'Partner Influence',
  'SnowflakeTeamPicklist': 'Snowflake Team Picklist',
  'DomoForecastCategory': 'Domo Forecast Category',
  'NumberOfCompetitors': 'Number of Competitors',
  'Competitors': 'competitors',
  'DealCode': 'Deal Code',
  'WebisteDomain': 'Webiste Domain',
  'AccountRevenueUsd': 'Account Revenue USD',
  'AccountEmployees': 'Account Employees',
  'StrategicAccount': 'Strategic Account',
  'Region': 'Region',
  'SalesSegment': 'Sales Segment',
  'SalesVertical': 'Sales Vertical',
  'PlatformPrice': 'Platform Price',
  'ProfessionalServicesPrice': 'Professional Services Price',
  'LineItems': 'Line Items',
  'ContractType': 'Contract Type',
  'PricingType': 'Pricing Type',
  'CPQ': 'CPQ',
  'IsPartner': 'Is Partner',
  'IsPipeline': 'Is Pipeline',
  'NonCompetitiveDeal': 'Non-Competitive Deal',
  'PeopleAiEngagement': 'People AI Engagement Level',
  'IsClosed': 'Is Closed',
  'IsWon': 'Is Won',
  'TotalClosedWonCount': 'Total Closed Won Count',
  'TotalClosedLostCount': 'Total Closed Lost Count',
  'NewLogoWonCount': 'New Logo Won Count',
  'NewLogoLostCount': 'New Logo Lost Count',
  'UpsellWonCount': 'Upsell Won Count',
  'UpsellLostCount': 'Upsell Lost Count',
  'TotalOptyCount': 'Total Opty Count',
  'CreatedDate': 'Created Date',
  'DiscoveryCallCompleted': 'Discovery Call Completed',
  'DemoCompletedDate': 'Demo Completed Date',
  'PricingCallDate': 'Pricing Call Date',
  'GateCallCompleted': 'Gate Call Completed',
  'HasPreCallPlan': 'Has Pre-Call Plan',
  'HasAdmAeSyncAgenda': 'Has ADM/AE Sync Agenda',
  'ForecastComments': 'Forecast Comments',
  'NextStep': 'Next Step',
  'BusinessChallenge': 'Business Challenge',
};

/**
 * Fetch opportunities from Domo with server-side filtering.
 *
 * The v2 dataset has ~195K rows (all historical deals). We use the Domo
 * Data API v2 query parameters to filter server-side, avoiding a
 * browser-killing full-table download.
 *
 * Strategy (in order):
 *  1. /data/v2/ with ?fields= and &filter= (Domo's own @domoinc/query uses this)
 *  2. /data/v1/ with same query params
 *  3. /data/v1/ unfiltered (full dataset fallback)
 */
export async function fetchOpportunities(): Promise<DomoOpportunity[]> {
  const domo = (window as unknown as {
    domo?: {
      get: (url: string) => Promise<unknown[]>;
      post: (url: string, body?: unknown, options?: unknown) => Promise<unknown>;
    };
  }).domo
    || (globalThis as unknown as {
      domo?: {
        get: (url: string) => Promise<unknown[]>;
        post: (url: string, body?: unknown, options?: unknown) => Promise<unknown>;
      };
    }).domo;

  if (!domo) {
    console.log('[Domo] Dev mode - no domo SDK, returning empty data');
    return [];
  }

  const alias = CONFIG.datasets.opportunities;

  try {
    // Columns consumed by transformOpportunityToDeal + filter-options builder.
    const fields = [
      'OpportunityId', 'OpportunityName', 'AccountName',
      'Stage', 'StageAge', 'Type', 'Likely', 'AcvUsd',
      'CloseDate', 'CloseDateFQ',
      'DomoOpportunityOwner', 'MgrForecastName',
      'SalesConsultant', 'PocSalesConsultant',
      'PrimaryPartnerRole', 'PartnersInvolved', 'PartnerInfluence',
      'SnowflakeTeamPicklist', 'DomoForecastCategory',
      'NumberOfCompetitors', 'Competitors',
      'DealCode', 'WebisteDomain', 'IsClosed',
      'PropensityScore', 'MlPrediction', 'PropensityQuadrant',
      'Factor1Name', 'Factor1Value', 'Factor1Direction', 'Factor1Magnitude',
      'Factor2Name', 'Factor2Value', 'Factor2Direction', 'Factor2Magnitude',
      'Factor3Name', 'Factor3Value', 'Factor3Direction', 'Factor3Magnitude',
      'Factor4Name', 'Factor4Value', 'Factor4Direction', 'Factor4Magnitude',
      'Factor5Name', 'Factor5Value', 'Factor5Direction', 'Factor5Magnitude',
      'PropensityScoredAt', 'PropensityModelVersion',
    ];

    // Quarter window: current quarter through current + 4
    const now = new Date();
    const curYear = now.getFullYear();
    const curQ = Math.ceil((now.getMonth() + 1) / 3);
    const quarters: string[] = [];
    for (let offset = 0; offset <= 4; offset++) {
      let q = curQ + offset;
      let y = curYear;
      while (q > 4) { q -= 4; y++; }
      quarters.push(`${y}-Q${q}`);
    }

    // Domo filter syntax (from @domoinc/query source):
    //   column names are single-quoted, string values are double-quoted
    //   !in for "not in", in for "in"
    const closedFilter = `'IsClosed' !in ["true","1","yes"]`;
    const qtrValues = quarters.map(q => `"${q}"`).join(',');
    const qtrFilter = `'CloseDateFQ' in [${qtrValues}]`;
    const combinedFilter = `${closedFilter}, ${qtrFilter}`;

    const fieldsParam = fields.map(f => encodeURIComponent(f)).join(',');

    // Strategy 1: /data/v2/ with query params (same as @domoinc/query library)
    const v2Url = `/data/v2/${alias}?fields=${fieldsParam}&filter=${closedFilter}, ${qtrFilter}`;
    console.log(`[Domo] Strategy 1: /data/v2/ with fields + filter (${fields.length} cols, quarters ${quarters[0]}–${quarters[quarters.length - 1]})...`);

    let rawOpps: Record<string, unknown>[];
    let strategy = '';

    try {
      const t0 = performance.now();
      const result = await domo.get(v2Url);
      rawOpps = (result || []) as Record<string, unknown>[];
      strategy = 'v2+fields+filter';
      console.log(`[Domo] Strategy 1 OK: ${rawOpps.length} records in ${Math.round(performance.now() - t0)}ms`);
    } catch (err1) {
      console.warn('[Domo] Strategy 1 failed (/data/v2/ with filter):', err1);

      // Strategy 2: /data/v1/ with filter only (no field selection)
      const v1FilterUrl = `/data/v1/${alias}?filter=${combinedFilter}`;
      console.log('[Domo] Strategy 2: /data/v1/ with filter...');
      try {
        const t0 = performance.now();
        const result = await domo.get(v1FilterUrl);
        rawOpps = (result || []) as Record<string, unknown>[];
        strategy = 'v1+filter';
        console.log(`[Domo] Strategy 2 OK: ${rawOpps.length} records in ${Math.round(performance.now() - t0)}ms`);
      } catch (err2) {
        console.warn('[Domo] Strategy 2 failed (/data/v1/ with filter):', err2);

        // Strategy 3: /data/v2/ with fields only (no filter)
        const v2FieldsUrl = `/data/v2/${alias}?fields=${fieldsParam}`;
        console.log('[Domo] Strategy 3: /data/v2/ with fields only...');
        try {
          const t0 = performance.now();
          const result = await domo.get(v2FieldsUrl);
          rawOpps = (result || []) as Record<string, unknown>[];
          strategy = 'v2+fields';
          console.log(`[Domo] Strategy 3 OK: ${rawOpps.length} records in ${Math.round(performance.now() - t0)}ms`);
        } catch (err3) {
          console.warn('[Domo] Strategy 3 failed (/data/v2/ with fields):', err3);

          // Strategy 4: /data/v1/ unfiltered (full dataset fallback)
          console.log('[Domo] Strategy 4: /data/v1/ unfiltered (full fallback)...');
          const t0 = performance.now();
          const rawData = await domo.get(`/data/v1/${alias}`);
          rawOpps = (rawData || []) as Record<string, unknown>[];
          strategy = 'v1-full';
          console.log(`[Domo] Strategy 4 (full fallback): ${rawOpps.length} records in ${Math.round(performance.now() - t0)}ms`);
        }
      }
    }

    console.log(`[Domo] Final: ${rawOpps.length} records via ${strategy}`);

    if (rawOpps.length > 0) {
      console.log('[Domo] Sample record keys:', Object.keys(rawOpps[0]).sort());
    }

    // Client-side filtering for strategies that didn't filter server-side
    if (strategy === 'v1-full' || strategy === 'v2+fields') {
      const before = rawOpps.length;
      const closedValues = new Set(['true', '1', 'yes']);
      const qtrSet = new Set(quarters);
      rawOpps = rawOpps.filter(r => {
        const closed = String(r['IsClosed'] ?? r['Is Closed'] ?? '').toLowerCase();
        if (closedValues.has(closed)) return false;
        const fq = String(r['CloseDateFQ'] ?? r['Close Date FQ'] ?? '');
        if (fq && !qtrSet.has(fq)) return false;
        return true;
      });
      console.log(`[Domo] Client-side filter: ${before} → ${rawOpps.length} (open pipeline, ${quarters[0]}–${quarters[quarters.length - 1]})`);
    }

    const nowMs = Date.now();
    const proximityMs = CLOSE_DATE_PROXIMITY_DAYS * 86_400_000;

    const allOpps = rawOpps
      .map((record) => normalizeRecord<DomoOpportunity>(record, OPPORTUNITY_FIELD_MAP))
      .filter((opp) => {
        const stageAge = opp['Stage Age'];
        if (stageAge === null || stageAge === undefined) return true;
        if (stageAge <= MAX_STAGE_AGE_DAYS) return true;

        const closeStr = opp['Close Date'] as string | undefined;
        if (closeStr) {
          const closeMs = new Date(closeStr).getTime();
          if (!isNaN(closeMs) && closeMs - nowMs <= proximityMs && closeMs >= nowMs) return true;
        }

        return false;
      });

    const filteredOut = rawOpps.length - allOpps.length;
    console.log(`[Domo] Pre-filtered ${filteredOut} deals with Stage Age > ${MAX_STAGE_AGE_DAYS}d (${CLOSE_DATE_PROXIMITY_DAYS}d proximity override active)`);

    // Deduplicate by Opportunity Id — keep the record with the most non-empty fields
    const dedupMap = new Map<string, DomoOpportunity>();
    for (const opp of allOpps) {
      const id = opp['Opportunity Id'];
      if (!id) continue;
      const existing = dedupMap.get(id);
      if (!existing) {
        dedupMap.set(id, opp);
      } else {
        const richness = (o: DomoOpportunity) =>
          Object.values(o).filter(v => v != null && String(v).trim() !== '').length;
        if (richness(opp) > richness(existing)) dedupMap.set(id, opp);
      }
    }
    const deduped = Array.from(dedupMap.values());
    const dupCount = allOpps.length - deduped.length;
    if (dupCount > 0) console.log(`[Domo] Deduped ${dupCount} duplicate Opportunity IDs`);
    console.log(`[Domo] Returning ${deduped.length} opportunities`);

    return deduped;
  } catch (error) {
    console.error('[Domo] Failed to fetch opportunities:', error);
    return [];
  }
}

// ─── SE Mapping ──────────────────────────────────────────────────────────────

/**
 * All possible key names Domo might use to return the SE name column.
 * Covers: current manifest aliases, old v1.4 aliases, raw column names.
 */
const SE_KEY_CANDIDATES = [
  'se', 'SE',
  'SalesConsultant', 'Sales Consultant', 'Sales_Consultant',
  'SolutionsConsultant', 'Solutions Consultant',
  'PocSalesConsultant', 'PoC Sales Consultant',
];

const MANAGER_KEY_CANDIDATES = [
  'se_manager', 'SE_Manager', 'SE Manager',
  'SeManager', 'seManager',
  'se_mgr', 'Manager',
];

/**
 * Read the first non-empty string value from a record trying multiple keys.
 */
function readField(record: Record<string, unknown>, candidates: string[]): string {
  for (const key of candidates) {
    const val = record[key];
    if (val !== undefined && val !== null && val !== '') {
      return String(val).trim();
    }
  }
  return '';
}

/**
 * Auto-detect which keys in the record correspond to SE name and SE Manager.
 *
 * The dataset has exactly 2 text columns. One is a person name (the SE),
 * the other is their manager. We identify them by:
 *   1. Trying known key candidates first
 *   2. Falling back to heuristic: the key containing 'manager'/'mgr' is the manager
 *   3. Last resort: the 2-column dataset → first key with fewer unique values is likely manager
 */
function detectSEMappingKeys(records: Record<string, unknown>[]): { seKey: string; mgrKey: string } | null {
  if (records.length === 0) return null;

  const allKeys = Object.keys(records[0]);
  console.log('[SE Detect] Record keys:', allKeys);
  console.log('[SE Detect] First record values:', records[0]);

  // Method 1: Try known candidates
  let seKey = '';
  let mgrKey = '';

  for (const k of allKeys) {
    if (!seKey && SE_KEY_CANDIDATES.some(c => c.toLowerCase() === k.toLowerCase())) {
      seKey = k;
    }
    if (!mgrKey && MANAGER_KEY_CANDIDATES.some(c => c.toLowerCase() === k.toLowerCase())) {
      mgrKey = k;
    }
  }

  if (seKey && mgrKey) {
    console.log(`[SE Detect] Found via candidates: SE="${seKey}", Manager="${mgrKey}"`);
    return { seKey, mgrKey };
  }

  // Method 2: Heuristic — key containing 'manager' or 'mgr' is the manager
  for (const k of allKeys) {
    const kl = k.toLowerCase();
    if (kl.includes('manager') || kl.includes('mgr')) {
      mgrKey = k;
    }
  }

  if (mgrKey) {
    // The other key is the SE
    seKey = allKeys.find(k => k !== mgrKey) || '';
    if (seKey) {
      console.log(`[SE Detect] Found via heuristic: SE="${seKey}", Manager="${mgrKey}"`);
      return { seKey, mgrKey };
    }
  }

  // Method 3: 2-column dataset — column with fewer unique values is likely manager
  if (allKeys.length === 2) {
    const [k1, k2] = allKeys;
    const unique1 = new Set(records.map(r => String(r[k1] ?? ''))).size;
    const unique2 = new Set(records.map(r => String(r[k2] ?? ''))).size;

    // The column with fewer unique values is the manager (29 SEs → ~4 managers)
    if (unique1 < unique2) {
      console.log(`[SE Detect] 2-col heuristic: Manager="${k1}" (${unique1} unique), SE="${k2}" (${unique2} unique)`);
      return { seKey: k2, mgrKey: k1 };
    } else {
      console.log(`[SE Detect] 2-col heuristic: Manager="${k2}" (${unique2} unique), SE="${k1}" (${unique1} unique)`);
      return { seKey: k1, mgrKey: k2 };
    }
  }

  console.warn('[SE Detect] Could not identify SE mapping columns from keys:', allKeys);
  return null;
}

/**
 * Fetch SE mapping data from Domo.
 *
 * The actual dataset has exactly 2 columns: se, se_manager (29 rows).
 * This function is ultra-robust: it tries known aliases, then auto-detects.
 */
export async function fetchSEMapping(): Promise<DomoSEMapping[]> {
  const domo = (window as unknown as { domo?: { get: (url: string) => Promise<unknown[]> } }).domo
    || (globalThis as unknown as { domo?: { get: (url: string) => Promise<unknown[]> } }).domo;

  if (!domo) {
    console.log('[Domo] Dev mode - no domo SDK, returning empty SE mapping');
    return [];
  }

  const alias = CONFIG.datasets.seMapping;
  console.log(`[Domo] Fetching SE mapping from /data/v1/${alias}...`);

  try {
    const rawData = await domo.get(`/data/v1/${alias}`);
    const rawMappings = (rawData || []) as Record<string, unknown>[];

    console.log(`[Domo] Fetched ${rawMappings.length} SE mapping records`);

    if (rawMappings.length === 0) {
      console.warn('[Domo] SE mapping returned 0 records');
      return [];
    }

    // Log the raw structure
    console.log('[Domo] SE mapping raw keys:', Object.keys(rawMappings[0]));
    console.log('[Domo] SE mapping first 3 rows:', rawMappings.slice(0, 3));

    // Auto-detect which keys are SE and Manager
    const detected = detectSEMappingKeys(rawMappings);

    let seMappings: DomoSEMapping[];

    if (detected) {
      // Use detected keys
      seMappings = rawMappings.map((record) => ({
        se: String(record[detected.seKey] ?? '').trim(),
        se_manager: String(record[detected.mgrKey] ?? '').trim(),
      }));
    } else {
      // Fallback: try all known candidates
      seMappings = rawMappings.map((record) => ({
        se: readField(record, SE_KEY_CANDIDATES),
        se_manager: readField(record, MANAGER_KEY_CANDIDATES),
      }));
    }

    // Validate
    const valid = seMappings.filter(m => m.se && m.se_manager);
    console.log(`[Domo] Valid SE mappings: ${valid.length}/${seMappings.length}`);
    console.log('[Domo] SE mapping samples:', valid.slice(0, 5).map(m => `"${m.se}" → "${m.se_manager}"`));

    const uniqueManagers = new Set(valid.map(m => m.se_manager));
    console.log('[Domo] Unique SE Managers:', Array.from(uniqueManagers));

    return seMappings;
  } catch (error) {
    console.error('[Domo] Failed to fetch SE mapping:', error);
    return [];
  }
}

/**
 * Check if running in Domo environment
 */
export function isDomoEnvironment(): boolean {
  return !!(
    (window as unknown as { domo?: unknown }).domo ||
    (globalThis as unknown as { domo?: unknown }).domo
  );
}
