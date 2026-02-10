/**
 * Domo Data Layer
 * Handles all data fetching from Domo datasets with pre-filtering
 */

import { MAX_STAGE_AGE_DAYS } from './constants';

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
  'Competitors': string | null;
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
    forecasts: 'forecastsmagic',
    wcpWeekly: 'wcpweekly',
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
  'CurrentFQ': 'Current FQ',
  'DomoOpportunityOwner': 'Domo Opportunity Owner',
  'MgrForecastName': 'Mgr Forecast Name',
  'SalesConsultant': 'Sales Consultant',
  'PocSalesConsultant': 'PoC Sales Consultant',
  'PrimaryPartnerRole': 'Primary Partner Role',
  'PartnersInvolved': 'Partners Involved',
  'PartnerInfluence': 'Partner Influence',
  'SnowflakeTeamPicklist': 'Snowflake Team Picklist',
  'DomoForecastCategory': 'Domo Forecast Category',
  'NumberOfCompetitors': 'Number of Competitors',
  'Competitors': 'Competitors',
  'DealCode': 'Deal Code',
  'WebisteDomain': 'Webiste Domain',
};

/**
 * Fetch opportunities from Domo with pre-filtering for stage age
 */
export async function fetchOpportunities(): Promise<DomoOpportunity[]> {
  const domo = (window as unknown as { domo?: { get: (url: string) => Promise<unknown[]> } }).domo
    || (globalThis as unknown as { domo?: { get: (url: string) => Promise<unknown[]> } }).domo;

  if (!domo) {
    console.log('[Domo] Dev mode - no domo SDK, returning empty data');
    return [];
  }

  const alias = CONFIG.datasets.opportunities;
  console.log(`[Domo] Fetching opportunities from /data/v1/${alias}...`);

  try {
    const rawData = await domo.get(`/data/v1/${alias}`);
    const rawOpps = (rawData || []) as Record<string, unknown>[];

    console.log(`[Domo] Fetched ${rawOpps.length} raw opportunity records`);

    if (rawOpps.length > 0) {
      console.log('[Domo] Sample opportunity fields:', Object.keys(rawOpps[0]).sort());
    }

    const allOpps = rawOpps
      .map((record) => normalizeRecord<DomoOpportunity>(record, OPPORTUNITY_FIELD_MAP))
      .filter((opp) => {
        const stageAge = opp['Stage Age'];
        if (stageAge === null || stageAge === undefined) return true;
        return stageAge <= MAX_STAGE_AGE_DAYS;
      });

    const filteredOut = rawOpps.length - allOpps.length;
    console.log(`[Domo] Pre-filtered ${filteredOut} deals with Stage Age > ${MAX_STAGE_AGE_DAYS} days`);
    console.log(`[Domo] Returning ${allOpps.length} opportunities`);

    return allOpps;
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
