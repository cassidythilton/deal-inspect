/**
 * Domo Data Hooks
 * React Query hooks for fetching and caching Domo data
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOpportunities, fetchSEMapping, DomoOpportunity, DomoSEMapping, isDomoEnvironment } from '@/lib/domo';
import { Deal } from '@/types/tdr';

export const queryKeys = {
  opportunities: ['opportunities'] as const,
  seMapping: ['se-mapping'] as const,
};

/**
 * Hook to fetch raw opportunities from Domo
 * Data is pre-filtered to exclude deals with Stage Age > 365 days
 */
export function useOpportunities() {
  return useQuery({
    queryKey: queryKeys.opportunities,
    queryFn: fetchOpportunities,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    enabled: isDomoEnvironment(),
  });
}

/**
 * Transform a Domo opportunity to a Deal
 */
function transformOpportunityToDeal(opp: DomoOpportunity): Deal {
  // Determine partner signal based on partner involvement
  const hasPartner = !!(
    opp['Primary Partner Role'] ||
    opp['Partners Involved']
  );
  
  const partnerSignal: Deal['partnerSignal'] = hasPartner 
    ? (opp['Primary Partner Role'] ? 'strong' : 'moderate')
    : 'none';

  // Determine risk level based on stage age and other factors
  const stageAge = opp['Stage Age'] || 0;
  let riskLevel: Deal['riskLevel'] = 'green';
  if (stageAge > 180) {
    riskLevel = 'red';
  } else if (stageAge > 90) {
    riskLevel = 'yellow';
  }

  // Build reasons based on deal characteristics
  const reasons: string[] = [];
  if (opp['Type']) reasons.push(opp['Type']);
  if (stageAge > 90) reasons.push(`${stageAge}d in stage`);
  if (hasPartner) reasons.push('Partner involved');

  // Get ACV - prefer Likely, fallback to ACV (USD)
  const acv = opp['Likely'] || opp['ACV (USD)'] || 0;

  return {
    id: opp['Opportunity Id'],
    account: opp['Account Name'] || 'Unknown Account',
    dealName: opp['Opportunity Name'] || 'Unnamed Opportunity',
    stage: opp['Stage'] || 'Unknown',
    stageAge: opp['Stage Age'] ?? undefined,
    acv,
    closeDate: opp['Close Date'] || new Date().toISOString().split('T')[0],
    partnerSignal,
    riskLevel,
    reasons: reasons.slice(0, 3),
    owner: opp['Domo Opportunity Owner'] || 'Unassigned',
    salesConsultant: opp['Sales Consultant'] || undefined,
  };
}

/**
 * Hook to fetch SE mapping data
 */
export function useSEMapping() {
  return useQuery({
    queryKey: queryKeys.seMapping,
    queryFn: fetchSEMapping,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    enabled: isDomoEnvironment(),
  });
}

// SE Mapping lookup result
interface SEMappingResult {
  seManager?: string;
  solutionsConsultant?: string;
  pocSalesConsultant?: string;
}

/**
 * Hook to get deals transformed from Domo opportunities
 * All data is pre-filtered to exclude deals with Stage Age > 365 days
 */
export function useDeals() {
  const { data: opportunities, isLoading: oppsLoading, error: oppsError, refetch } = useOpportunities();
  const { data: seMapping, isLoading: seLoading } = useSEMapping();

  // Create SE lookup map
  // Key: Sales Consultant (from opportunities) -> SE mapping data
  const seLookup = useMemo(() => {
    const lookup = new Map<string, SEMappingResult>();
    if (seMapping) {
      console.log(`[SE Join] Building lookup from ${seMapping.length} SE mappings`);
      for (const mapping of seMapping) {
        const key = mapping['Sales Consultant'];
        if (key) {
          lookup.set(key, {
            seManager: mapping['SE Manager'] || undefined,
            solutionsConsultant: mapping['Solutions Consultant'] || undefined,
            pocSalesConsultant: mapping['PoC Sales Consultant'] || undefined,
          });
        }
      }
      console.log(`[SE Join] Lookup has ${lookup.size} entries. Sample keys:`, Array.from(lookup.keys()).slice(0, 5));
    }
    return lookup;
  }, [seMapping]);

  // Transform and enrich deals with SE data
  // Dynamic join: opportunities['Sales Consultant'] -> SE mapping
  const deals: Deal[] = useMemo(() => {
    if (!opportunities) return [];
    
    let matchCount = 0;
    const result = opportunities.map((opp) => {
      const deal = transformOpportunityToDeal(opp);
      
      // Dynamic join: Look up SE data using Sales Consultant as the key
      const salesConsultant = deal.salesConsultant;
      if (salesConsultant && seLookup.has(salesConsultant)) {
        const seData = seLookup.get(salesConsultant)!;
        deal.seManager = seData.seManager;
        deal.pocSalesConsultant = seData.pocSalesConsultant;
        matchCount++;
      }
      
      return deal;
    });
    
    console.log(`[SE Join] Matched ${matchCount}/${result.length} deals with SE data`);
    return result;
  }, [opportunities, seLookup]);

  // Extract unique filter options
  const filterOptions = useMemo(() => {
    const seManagers = new Set<string>();
    const pocSalesConsultants = new Set<string>();
    
    // From SE mapping
    if (seMapping) {
      for (const mapping of seMapping) {
        const manager = mapping['SE Manager'];
        const pocSE = mapping['PoC Sales Consultant'];
        if (manager && manager !== 'TBD') {
          seManagers.add(manager);
        }
        if (pocSE) {
          pocSalesConsultants.add(pocSE);
        }
      }
    }
    
    return {
      seManagers: Array.from(seManagers).sort(),
      salesConsultants: [] as string[], // Not used for filtering
      pocSalesConsultants: Array.from(pocSalesConsultants).sort(),
    };
  }, [seMapping]);

  return {
    deals,
    filterOptions,
    isLoading: oppsLoading || seLoading,
    error: oppsError,
    refetch,
    isDomoConnected: isDomoEnvironment(),
  };
}
