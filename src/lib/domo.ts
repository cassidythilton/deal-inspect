/**
 * Domo Data Layer
 * Handles all data fetching from Domo datasets with pre-filtering
 */

// Maximum stage age in days - deals older than this are excluded
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
  'Primary Partner Role': string | null;
  'Partners Involved': string | null;
  'Domo Forecast Category': string;
  'Type': string;
  [key: string]: unknown;
}

// SE Mapping dataset structure
// Columns: Sales Consultant, Solutions Consultant, PoC Sales Consultant, SE Manager
// Used ONLY for SE → SE Manager lookup and PoC role identification
export interface DomoSEMapping {
  salesConsultant: string;       // Regular Sales Consultant name
  solutionsConsultant: string;   // Solutions Consultant name
  pocSalesConsultant: string;    // PoC Sales Consultant name
  seManager: string;             // SE Manager name
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
  'PrimaryPartnerRole': 'Primary Partner Role',
  'PartnersInvolved': 'Partners Involved',
  'DomoForecastCategory': 'Domo Forecast Category',
  'NumberOfCompetitors': 'Number of Competitors',
};

/**
 * Fetch opportunities from Domo with pre-filtering for stage age
 * Deals with Stage Age > MAX_STAGE_AGE_DAYS are excluded
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
      console.log('[Domo] Sample opportunity fields:', Object.keys(rawOpps[0]).slice(0, 15));
    }

    // Normalize and pre-filter by stage age
    const allOpps = rawOpps
      .map((record) => normalizeRecord<DomoOpportunity>(record, OPPORTUNITY_FIELD_MAP))
      .filter((opp) => {
        const stageAge = opp['Stage Age'];
        // Keep deals with null/undefined stage age or stage age <= MAX_STAGE_AGE_DAYS
        if (stageAge === null || stageAge === undefined) {
          return true;
        }
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
 * Read a string field from a record, trying multiple possible key variations.
 * Domo may return fields using aliases (camelCase) or full column names.
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
 * Dataset columns (manifest aliases → column names):
 *   SalesConsultant     → "Sales Consultant"
 *   SolutionsConsultant → "Solutions Consultant"
 *   PocSalesConsultant  → "PoC Sales Consultant"
 *   SeManager           → "SE Manager"
 *
 * Used ONLY for:
 *   1. SE → SE Manager lookup
 *   2. Identifying which SEs are PoC Sales Consultants
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
      console.log('[Domo] SE mapping sample record:', rawMappings[0]);
    }

    // Normalize each record — try Domo aliases (camelCase), full column names,
    // and legacy aliases (se, se_manager) for backward compatibility
    const seMappings: DomoSEMapping[] = rawMappings.map((record) => ({
      salesConsultant: readField(record,
        'SalesConsultant', 'Sales Consultant', 'sales_consultant', 'sc', 'se', 'SE'),
      solutionsConsultant: readField(record,
        'SolutionsConsultant', 'Solutions Consultant', 'solutions_consultant'),
      pocSalesConsultant: readField(record,
        'PocSalesConsultant', 'PoC Sales Consultant', 'poc_sales_consultant', 'PocSC'),
      seManager: readField(record,
        'SeManager', 'SE Manager', 'se_manager', 'SE_Manager', 'Manager'),
    }));
    
    if (seMappings.length > 0) {
      console.log('[Domo] Normalized SE mapping sample:', seMappings[0]);
      console.log('[Domo] SE mapping samples:',
        seMappings.slice(0, 5).map(m =>
          `SC="${m.salesConsultant}" PoC="${m.pocSalesConsultant}" Mgr="${m.seManager}"`
        )
      );
    }
    
    // Count stats
    const withSC = seMappings.filter(m => m.salesConsultant).length;
    const withPoC = seMappings.filter(m => m.pocSalesConsultant).length;
    const withMgr = seMappings.filter(m => m.seManager).length;
    console.log(`[Domo] SE mapping stats: ${withSC} with SC, ${withPoC} with PoC, ${withMgr} with Manager`);
    
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
