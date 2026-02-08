/**
 * Domo Data Hooks
 * React Query hooks for fetching and caching Domo data
 *
 * DATA SOURCING RULES:
 *   - SE names come ONLY from the Opportunities dataset ("Sales Consultant" field)
 *   - SE mapping file is used ONLY for:
 *       1. SE → SE Manager lookup
 *       2. Identifying PoC Sales Consultants (via the "PoC Sales Consultant" column)
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOpportunities, fetchSEMapping, DomoOpportunity, DomoSEMapping, isDomoEnvironment } from '@/lib/domo';
import { Deal } from '@/types/tdr';
import { ALLOWED_MANAGERS, POC_SE_MANAGER } from '@/lib/constants';

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

// SE lookup result from mapping
interface SELookupResult {
  seManager: string;
  isPoc: boolean;
}

/**
 * Transform a Domo opportunity to a Deal
 * SE name is sourced directly from the Opportunities dataset
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

  // Get manager name (Mgr Forecast Name is the AE/sales manager)
  const mgrForecastName = (opp['Mgr Forecast Name'] as string) || opp['Domo Opportunity Owner'] || 'Unassigned';

  return {
    id: opp['Opportunity Id'],
    account: opp['Account Name'] || 'Unknown Account',
    dealName: opp['Opportunity Name'] || 'Unnamed Opportunity',
    stage,
    stageNumber,
    stageAge: opp['Stage Age'] ?? undefined,
    acv,
    closeDate: opp['Close Date'] || new Date().toISOString().split('T')[0],
    closeDateFQ: (opp['Close Date FQ'] as string) || undefined,
    partnerSignal,
    riskLevel,
    reasons: reasons.slice(0, 3),
    owner: mgrForecastName,
    // SE name sourced DIRECTLY from the Opportunities dataset
    salesConsultant: opp['Sales Consultant'] || undefined,
    // seManager will be populated via SE mapping join (below)
    seManager: undefined,
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
 * Hook to get deals transformed from Domo opportunities
 * All data is pre-filtered to exclude deals with Stage Age > 365 days
 */
export function useDeals() {
  const { data: opportunities, isLoading: oppsLoading, error: oppsError, refetch } = useOpportunities();
  const { data: seMapping, isLoading: seLoading } = useSEMapping();

  // Build SE lookup map from the mapping dataset
  // Maps SE name (lowercase) → { seManager, isPoc }
  // Checks all relevant columns: Sales Consultant, PoC Sales Consultant, Solutions Consultant
  const seLookup = useMemo(() => {
    const lookup = new Map<string, SELookupResult>();
    if (!seMapping) return lookup;

    console.log(`[SE Lookup] Building from ${seMapping.length} mapping records`);

    for (const mapping of seMapping) {
      const manager = mapping.seManager || '';

      // Regular Sales Consultants
      if (mapping.salesConsultant) {
        const key = mapping.salesConsultant.toLowerCase();
        lookup.set(key, {
          seManager: manager,
          isPoc: false,
        });
      }

      // PoC Sales Consultants
      if (mapping.pocSalesConsultant) {
        const key = mapping.pocSalesConsultant.toLowerCase();
        lookup.set(key, {
          seManager: manager,
          isPoc: true,
        });
      }

      // Solutions Consultants (fallback lookup)
      if (mapping.solutionsConsultant) {
        const key = mapping.solutionsConsultant.toLowerCase();
        if (!lookup.has(key)) {
          lookup.set(key, {
            seManager: manager,
            isPoc: false,
          });
        }
      }
    }

    console.log(`[SE Lookup] Built lookup with ${lookup.size} entries`);
    console.log(`[SE Lookup] Sample entries:`,
      Array.from(lookup.entries()).slice(0, 8).map(([k, v]) =>
        `"${k}" → Mgr="${v.seManager}" isPoc=${v.isPoc}`
      )
    );
    
    return lookup;
  }, [seMapping]);

  // Transform and enrich deals with SE Manager data
  // SE name comes from Opportunities; SE Manager comes from the mapping join
  const deals: Deal[] = useMemo(() => {
    if (!opportunities) return [];
    
    let matchCount = 0;
    let unmatchedCount = 0;
    const unmatchedSEs = new Set<string>();
    
    const result = opportunities.map((opp) => {
      const deal = transformOpportunityToDeal(opp);
      
      // Join: Opportunities['Sales Consultant'] → SE Mapping → SE Manager
      const sc = deal.salesConsultant?.trim();
      if (sc) {
        const seData = seLookup.get(sc.toLowerCase());
        if (seData) {
          deal.seManager = seData.seManager || undefined;
          matchCount++;
        } else {
          unmatchedSEs.add(sc);
          unmatchedCount++;
        }
      }
      
      return deal;
    });
    
    console.log(`[SE Join] Matched ${matchCount}/${result.length} deals. Unmatched: ${unmatchedCount}`);
    if (unmatchedSEs.size > 0) {
      console.log(`[SE Join] Unmatched SEs (not in mapping):`, Array.from(unmatchedSEs).slice(0, 15));
    }
    
    return result;
  }, [opportunities, seLookup]);

  // Extract unique filter options
  // RULE: SE names come ONLY from the Opportunities dataset
  //       SE mapping is used only to categorize them (PoC vs regular) and get SE Managers
  const filterOptions = useMemo(() => {
    const allowedSet = new Set(ALLOWED_MANAGERS.map(m => m.toLowerCase()));
    const currentYear = new Date().getFullYear();

    // Collect SE Managers from the mapping dataset
    const seManagerSet = new Set<string>();
    if (seMapping) {
      for (const m of seMapping) {
        if (m.seManager && m.seManager !== 'TBD' && m.seManager.trim() !== '') {
          seManagerSet.add(m.seManager.trim());
        }
      }
    }

    // Build a set of PoC Sales Consultant names (lowercase) from the mapping
    const pocNameSet = new Set<string>();
    if (seMapping) {
      for (const m of seMapping) {
        if (m.pocSalesConsultant) {
          pocNameSet.add(m.pocSalesConsultant.toLowerCase());
        }
      }
    }

    // Also consider: if an SE's manager is the POC_SE_MANAGER, they're a PoC Architect
    const pocByManagerSet = new Set<string>();
    if (seMapping) {
      for (const m of seMapping) {
        if (m.seManager === POC_SE_MANAGER) {
          if (m.salesConsultant) pocByManagerSet.add(m.salesConsultant.toLowerCase());
          if (m.pocSalesConsultant) pocByManagerSet.add(m.pocSalesConsultant.toLowerCase());
          if (m.solutionsConsultant) pocByManagerSet.add(m.solutionsConsultant.toLowerCase());
        }
      }
    }

    // Source SE names from Opportunities ONLY (filtered to allowed managers)
    const salesConsultants = new Set<string>();
    const pocSalesConsultants = new Set<string>();
    const forecastManagers = new Set<string>();
    const quarters = new Set<string>();

    const isValidQuarter = (q: string): boolean => {
      if (!q) return false;
      const match = q.match(/(\d{4})/);
      if (match) {
        const year = parseInt(match[1]);
        return year <= currentYear;
      }
      return false;
    };

    if (opportunities) {
      for (const opp of opportunities) {
        const mgrName = (opp['Mgr Forecast Name'] as string) || opp['Domo Opportunity Owner'] || '';
        
        // Only include deals from allowed managers
        if (!allowedSet.has(mgrName.toLowerCase())) continue;

        // Source SE name from Opportunities dataset
        const sc = opp['Sales Consultant'];
        if (sc && sc.trim()) {
          const scLower = sc.trim().toLowerCase();
          // Determine if this SE is a PoC Architect
          // Check: appears in PoC Sales Consultant column, OR reports to Dan Wentworth
          if (pocNameSet.has(scLower) || pocByManagerSet.has(scLower)) {
            pocSalesConsultants.add(sc.trim());
          } else {
            salesConsultants.add(sc.trim());
          }
        }

        if (mgrName.trim()) {
          forecastManagers.add(mgrName.trim());
        }

        // Quarters
        const closeFQ = opp['Close Date FQ'] as string | undefined;
        const currentFQ = opp['Current FQ'] as string | undefined;
        if (closeFQ && isValidQuarter(closeFQ)) quarters.add(closeFQ);
        if (currentFQ && isValidQuarter(currentFQ)) quarters.add(currentFQ);
      }
    }

    // Dedup: if someone ended up in both sets, prefer PoC
    for (const pocSE of pocSalesConsultants) {
      salesConsultants.delete(pocSE);
    }

    console.log(`[SE Filter] SE Managers: ${seManagerSet.size} — ${Array.from(seManagerSet).join(', ')}`);
    console.log(`[SE Filter] Sales Engineers (from Opps): ${salesConsultants.size}`);
    console.log(`[SE Filter] PoC Architects (from Opps): ${pocSalesConsultants.size}`);
    console.log(`[SE Filter] PoC names:`, Array.from(pocSalesConsultants).slice(0, 10));

    return {
      seManagers: Array.from(seManagerSet).sort(),
      salesConsultants: Array.from(salesConsultants).sort(),
      pocSalesConsultants: Array.from(pocSalesConsultants).sort(),
      forecastManagers: Array.from(forecastManagers).filter(mgr =>
        (ALLOWED_MANAGERS as readonly string[]).includes(mgr)
      ).sort(),
      quarters: Array.from(quarters).sort(),
    };
  }, [seMapping, opportunities]);

  return {
    deals,
    filterOptions,
    isLoading: oppsLoading || seLoading,
    error: oppsError,
    refetch,
    isDomoConnected: isDomoEnvironment(),
  };
}
