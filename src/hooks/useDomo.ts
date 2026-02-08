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

  // Build reasons/tags based on deal characteristics
  const reasons: string[] = [];
  const isCompetitive = opp['Number of Competitors'] && Number(opp['Number of Competitors']) > 0;
  if (isCompetitive) reasons.push('Competitive');
  if (hasPartner) reasons.push('Partner play');
  if (stageAge > 90) reasons.push('Stalled');
  if (opp['Type']) reasons.push(opp['Type']);

  // Get ACV - prefer Likely, fallback to ACV (USD)
  const acv = opp['Likely'] || opp['ACV (USD)'] || 0;

  // Get stage number from stage name
  const stage = opp['Stage'] || 'Unknown';
  const stageLower = stage.toLowerCase();
  let stageNumber = 1;
  if (stageLower.includes('discovery') || stageLower.includes('determine')) stageNumber = 2;
  else if (stageLower.includes('validation') || stageLower.includes('demonstrate')) stageNumber = 3;
  else if (stageLower.includes('proposal') || stageLower.includes('negotiate')) stageNumber = 4;
  else if (stageLower.includes('closing') || stageLower.includes('close')) stageNumber = 5;

  // Calculate TDR score
  let tdrScore = 25;
  if (riskLevel === 'green') tdrScore += 15;
  if (riskLevel === 'yellow') tdrScore += 5;
  if (partnerSignal === 'strong') tdrScore += 10;
  if (partnerSignal === 'moderate') tdrScore += 5;
  if (stageAge < 60) tdrScore += 5;
  if (acv > 100000) tdrScore += 5;
  tdrScore = Math.min(50, tdrScore);

  // Get manager name (Mgr Forecast Name is the sales manager)
  const mgrForecastName = (opp['Mgr Forecast Name'] as string) || opp['Domo Opportunity Owner'] || 'Unassigned';

  return {
    id: opp['Opportunity Id'],
    account: opp['Account Name'] || 'Unknown Account',
    dealName: opp['Opportunity Name'] || 'Unnamed Opportunity',
    stage: stage,
    stageNumber,
    stageAge: opp['Stage Age'] ?? undefined,
    acv,
    closeDate: opp['Close Date'] || new Date().toISOString().split('T')[0],
    closeDateFQ: (opp['Close Date FQ'] as string) || undefined,
    partnerSignal,
    riskLevel,
    reasons: reasons.slice(0, 3),
    owner: mgrForecastName,
    salesConsultant: opp['Sales Consultant'] || undefined,
    // Partner details
    partnersInvolved: opp['Partners Involved'] || undefined,
    primaryPartnerRole: opp['Primary Partner Role'] || undefined,
    dealCode: (opp['Deal Code'] as string) || undefined,
    tdrScore,
    isCompetitive: !!isCompetitive,
    isPartnerPlay: hasPartner,
    isStalled: stageAge > 90,
    isEarlyStage: stageNumber <= 2,
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
}

/**
 * Hook to get deals transformed from Domo opportunities
 * All data is pre-filtered to exclude deals with Stage Age > 365 days
 */
export function useDeals() {
  const { data: opportunities, isLoading: oppsLoading, error: oppsError, refetch } = useOpportunities();
  const { data: seMapping, isLoading: seLoading } = useSEMapping();

  // Create SE lookup map
  // Key: se (SE name from mapping) -> se_manager
  // Use case-insensitive lookup for robustness
  const seLookup = useMemo(() => {
    const lookup = new Map<string, SEMappingResult>();
    if (seMapping) {
      console.log(`[SE Join] Building lookup from ${seMapping.length} SE mappings`);
      for (const mapping of seMapping) {
        const key = mapping['se']?.trim();
        const manager = mapping['se_manager']?.trim();
        if (key && manager) {
          // Store with lowercase key for case-insensitive matching
          lookup.set(key.toLowerCase(), {
            seManager: manager,
          });
        }
      }
      console.log(`[SE Join] Lookup has ${lookup.size} entries.`);
      console.log(`[SE Join] Sample mappings:`, Array.from(lookup.entries()).slice(0, 10).map(([k, v]) => `${k} -> ${v.seManager}`));
      
      // Check specifically for Mike Tong
      const mikeTong = lookup.get('mike tong');
      console.log(`[SE Join] Mike Tong mapping:`, mikeTong);
    }
    return lookup;
  }, [seMapping]);

  // Transform and enrich deals with SE data
  // Dynamic join: opportunities['Sales Consultant'] -> SE mapping['se']
  const deals: Deal[] = useMemo(() => {
    if (!opportunities) return [];
    
    let matchCount = 0;
    const unmatchedSEs = new Set<string>();
    
    const result = opportunities.map((opp) => {
      const deal = transformOpportunityToDeal(opp);
      
      // Dynamic join: Look up SE data using Sales Consultant as the key (case-insensitive)
      const salesConsultant = deal.salesConsultant?.trim();
      if (salesConsultant) {
        const seData = seLookup.get(salesConsultant.toLowerCase());
        if (seData) {
          deal.seManager = seData.seManager;
          matchCount++;
        } else {
          unmatchedSEs.add(salesConsultant);
        }
      }
      
      return deal;
    });
    
    console.log(`[SE Join] Matched ${matchCount}/${result.length} deals with SE data`);
    if (unmatchedSEs.size > 0) {
      console.log(`[SE Join] Unmatched SEs (not in mapping):`, Array.from(unmatchedSEs).slice(0, 10));
    }
    return result;
  }, [opportunities, seLookup]);

  // Extract unique filter options - ONLY from deals belonging to allowed managers
  const filterOptions = useMemo(() => {
    // Import allowed managers and PoC SE Manager
    const ALLOWED_MANAGERS = ['Andrew Rich', 'John Pasalano', 'Keith White', 'Taylor Rust', 'Casey Morgan'];
    const POC_SE_MANAGER = 'Dan Wentworth';
    const allowedSet = new Set(ALLOWED_MANAGERS.map(m => m.toLowerCase()));
    
    // Current year for filtering
    const currentYear = new Date().getFullYear();
    
    const seManagers = new Set<string>();
    const salesConsultants = new Set<string>();
    const pocSalesConsultants = new Set<string>(); // PoC Architects - SEs under Dan Wentworth
    const forecastManagers = new Set<string>();
    const quarters = new Set<string>();
    
    // Build a map of SE -> SE Manager from the mapping data
    const seToManagerMap = new Map<string, string>();
    if (seMapping) {
      for (const mapping of seMapping) {
        const se = mapping['se']?.trim();
        const manager = mapping['se_manager']?.trim();
        if (se && manager) {
          seToManagerMap.set(se.toLowerCase(), manager);
        }
      }
    }
    
    // Helper to check if quarter is within current year or before
    const isValidQuarter = (q: string): boolean => {
      if (!q) return false;
      // Parse formats like "2026-Q1" or "Q1 2026"
      const match = q.match(/(\d{4})/);
      if (match) {
        const year = parseInt(match[1]);
        return year <= currentYear;
      }
      return false;
    };
    
    // Only get SEs from deals belonging to allowed managers
    if (opportunities) {
      for (const opp of opportunities) {
        const mgrName = (opp['Mgr Forecast Name'] as string) || opp['Domo Opportunity Owner'] || '';
        
        // Only include if manager is in allowed list
        if (!allowedSet.has(mgrName.toLowerCase())) continue;
        
        const sc = opp['Sales Consultant'];
        if (sc) {
          // Check if this SE reports to Dan Wentworth (PoC SE Manager)
          const seManager = seToManagerMap.get(sc.toLowerCase());
          if (seManager === POC_SE_MANAGER) {
            pocSalesConsultants.add(sc);
          } else {
            salesConsultants.add(sc);
          }
        }
        
        if (mgrName) {
          forecastManagers.add(mgrName);
        }
        
        // Get quarters from Close Date FQ or Current FQ - only if within current year
        const closeFQ = opp['Close Date FQ'] as string | undefined;
        const currentFQ = opp['Current FQ'] as string | undefined;
        if (closeFQ && isValidQuarter(closeFQ)) quarters.add(closeFQ);
        if (currentFQ && isValidQuarter(currentFQ)) quarters.add(currentFQ);
      }
    }
    
    // From SE mapping - get managers for SEs we found (excluding Dan Wentworth since those are PoC)
    if (seMapping) {
      for (const mapping of seMapping) {
        const sc = mapping['se'];
        // Only include SE managers for SEs in our regular SE list (not PoC)
        if (sc && salesConsultants.has(sc)) {
          const manager = mapping['se_manager'];
          if (manager && manager !== 'TBD' && manager !== POC_SE_MANAGER) {
            seManagers.add(manager);
          }
        }
      }
    }
    
    // Also get from deals (in case of mock data)
    for (const deal of deals) {
      // Only include if manager is in allowed list
      if (!allowedSet.has((deal.owner || '').toLowerCase())) continue;
      
      if (deal.salesConsultant) {
        const seManager = seToManagerMap.get(deal.salesConsultant.toLowerCase());
        if (seManager === POC_SE_MANAGER) {
          pocSalesConsultants.add(deal.salesConsultant);
        } else if (!salesConsultants.has(deal.salesConsultant)) {
          salesConsultants.add(deal.salesConsultant);
        }
      }
      if (deal.closeDateFQ && isValidQuarter(deal.closeDateFQ)) {
        quarters.add(deal.closeDateFQ);
      }
    }
    
    return {
      seManagers: Array.from(seManagers).sort(),
      salesConsultants: Array.from(salesConsultants).sort(),
      pocSalesConsultants: Array.from(pocSalesConsultants).sort(),
      forecastManagers: Array.from(forecastManagers).sort(),
      quarters: Array.from(quarters).sort(),
    };
  }, [seMapping, opportunities, deals]);

  return {
    deals,
    filterOptions,
    isLoading: oppsLoading || seLoading,
    error: oppsError,
    refetch,
    isDomoConnected: isDomoEnvironment(),
  };
}
