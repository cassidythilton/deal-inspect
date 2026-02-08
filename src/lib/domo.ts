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
  'PoC Sales Consultant': string;     // PoC SE assigned to this deal
  'Primary Partner Role': string | null;
  'Partners Involved': string | null;
  'Partner Influence': string | null;  // "Yes" or "No"
  'Snowflake Team Picklist': string | null;
  'Domo Forecast Category': string;
  'Type': string;
  'Deal Code': string | null;
  'Number of Competitors': number | null;
  [key: string]: unknown;
}

// SE Mapping dataset — exactly 2 columns: se, se_manager
// Used ONLY for SE → SE Manager lookup
export interface DomoSEMapping {
  se: string;           // SE name (join key matching Sales Consultant / PoC SC from opportunities)
  se_manager: string;   // SE Manager name
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
  'DealCode': 'Deal Code',
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
      console.log('[Domo] Sample opportunity fields:', Object.keys(rawOpps[0]).sort().slice(0, 20));
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

/**
 * Read a string value from a record, trying multiple key variations.
 */
function readField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = record[key];
    if (val !== undefined && val !== null && val !== '') {
      return String(val).trim();
    }
  }
  return '';
}

/**
 * Fetch SE mapping data from Domo
 *
 * The actual dataset has exactly 2 columns:
 *   se          — SE name (join key)
 *   se_manager  — SE Manager name
 *
 * Domo returns fields using the aliases from manifest.json:
 *   alias "se"          → column "se"
 *   alias "se_manager"  → column "se_manager"
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

    if (rawMappings.length > 0) {
      console.log('[Domo] SE mapping field names:', Object.keys(rawMappings[0]));
      console.log('[Domo] SE mapping first row:', rawMappings[0]);
    }

    // Normalize — try the exact alias names first, then common variations
    const seMappings: DomoSEMapping[] = rawMappings.map((record) => ({
      se: readField(record, 'se', 'SE', 'Sales Consultant', 'SalesConsultant'),
      se_manager: readField(record, 'se_manager', 'SE Manager', 'SeManager', 'SE_Manager'),
    }));

    // Log stats
    const validMappings = seMappings.filter(m => m.se && m.se_manager);
    console.log(`[Domo] Valid SE mappings: ${validMappings.length}/${seMappings.length}`);
    console.log('[Domo] SE mapping samples:', validMappings.slice(0, 5).map(m => `"${m.se}" → "${m.se_manager}"`));

    // Log unique managers
    const uniqueManagers = new Set(validMappings.map(m => m.se_manager));
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
