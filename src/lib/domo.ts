/**
 * Domo Data Layer
 * Handles all data fetching from Domo datasets with pre-filtering
 */

// Maximum stage age in days - deals older than this are excluded
export const MAX_STAGE_AGE_DAYS = 365;

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
// Join key: SalesConsultant (from opportunities) matches SalesConsultant here
export interface DomoSEMapping {
  'Sales Consultant': string;      // The key to join on
  'Solutions Consultant': string;  // SE name
  'PoC Sales Consultant': string;  // PoC SE name
  'SE Manager': string;            // SE Manager name
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
  'DomoOpportunityOwner': 'Domo Opportunity Owner',
  'SalesConsultant': 'Sales Consultant',
  'PrimaryPartnerRole': 'Primary Partner Role',
  'PartnersInvolved': 'Partners Involved',
  'DomoForecastCategory': 'Domo Forecast Category',
};

const SE_MAPPING_FIELD_MAP: Record<string, string> = {
  'SalesConsultant': 'Sales Consultant',
  'SolutionsConsultant': 'Solutions Consultant',
  'PocSalesConsultant': 'PoC Sales Consultant',
  'SeManager': 'SE Manager',
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
      console.log('[Domo] Sample opportunity fields:', Object.keys(rawOpps[0]).slice(0, 10));
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
 * Fetch SE mapping data
 * Used for dynamic join: opportunities['Sales Consultant'] -> SE mapping
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
      console.log('[Domo] Sample SE mapping fields:', Object.keys(rawMappings[0]));
    }

    // Normalize field names
    const seMappings = rawMappings.map((record) => 
      normalizeRecord<DomoSEMapping>(record, SE_MAPPING_FIELD_MAP)
    );
    
    if (seMappings.length > 0) {
      console.log('[Domo] Normalized SE mapping sample:', seMappings[0]);
    }
    
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
