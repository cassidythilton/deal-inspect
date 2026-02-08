/**
 * Domo Data Hooks
 * React Query hooks for fetching and caching Domo data
 *
 * DATA SOURCING RULES:
 *   - SE names come from the Opportunities dataset ("Sales Consultant" and "PoC Sales Consultant")
 *   - SE mapping file (2 columns: se, se_manager) is used ONLY for SE → SE Manager lookup
 *   - PoC categorization: if a deal's SE (from Sales Consultant) maps to Dan Wentworth → PoC Architect
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOpportunities, fetchSEMapping, DomoOpportunity, isDomoEnvironment } from '@/lib/domo';
import { Deal } from '@/types/tdr';
import { ALLOWED_MANAGERS, POC_SE_MANAGER } from '@/lib/constants';
import { calculateTDRScore } from '@/lib/tdrCriticalFactors';

export const queryKeys = {
  opportunities: ['opportunities'] as const,
  seMapping: ['se-mapping'] as const,
};

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

/**
 * Transform a Domo opportunity into a Deal.
 * SE name is sourced directly from Opportunities (Sales Consultant / PoC Sales Consultant).
 * TDR score is calculated AFTER enrichment with SE mapping data.
 */
function transformOpportunityToDeal(opp: DomoOpportunity): Deal {
  const hasPartner = !!(opp['Primary Partner Role'] || opp['Partners Involved']);
  const partnerSignal: Deal['partnerSignal'] = hasPartner
    ? (opp['Primary Partner Role'] ? 'strong' : 'moderate')
    : 'none';

  const stageAge = opp['Stage Age'] || 0;
  let riskLevel: Deal['riskLevel'] = 'green';
  if (stageAge > 180) riskLevel = 'red';
  else if (stageAge > 90) riskLevel = 'yellow';

  const numCompetitors = opp['Number of Competitors'] ? Number(opp['Number of Competitors']) : 0;
  const isCompetitive = numCompetitors > 0;

  const reasons: string[] = [];
  if (isCompetitive) reasons.push('Competitive');
  if (hasPartner) reasons.push('Partner play');
  if (stageAge > 90) reasons.push('Stalled');
  if (opp['Type']) reasons.push(opp['Type']);

  // ACV: prefer Likely, fallback to ACV (USD)
  const acv = opp['Likely'] || opp['ACV (USD)'] || 0;

  // Parse stage number
  const stage = opp['Stage'] || 'Unknown';
  const stageLower = stage.toLowerCase();
  let stageNumber = 1;
  if (stageLower.includes('determine') || stageLower.includes('discovery')) stageNumber = 2;
  else if (stageLower.includes('demonstrate') || stageLower.includes('validation')) stageNumber = 3;
  else if (stageLower.includes('confirm') || stageLower.includes('proposal') || stageLower.includes('negotiate')) stageNumber = 4;
  else if (stageLower.includes('clos')) stageNumber = 5;

  // Stage prefix number (e.g., "2: Determine Needs" → 2)
  const stageMatch = stage.match(/^(\d+):/);
  if (stageMatch) stageNumber = parseInt(stageMatch[1]);

  const mgrForecastName = (opp['Mgr Forecast Name'] as string) || opp['Domo Opportunity Owner'] || 'Unassigned';

  // SE fields from Opportunities dataset
  const salesConsultant = opp['Sales Consultant'] || undefined;
  const pocSalesConsultant = opp['PoC Sales Consultant'] || undefined;

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
    // SE fields — sourced directly from Opportunities
    salesConsultant,
    pocSalesConsultant,
    seManager: undefined, // will be set by SE mapping join
    // Partner details
    partnersInvolved: opp['Partners Involved'] || undefined,
    primaryPartnerRole: opp['Primary Partner Role'] || undefined,
    partnerInfluence: (opp['Partner Influence'] as string) || undefined,
    snowflakeTeam: (opp['Snowflake Team Picklist'] as string) || undefined,
    dealCode: (opp['Deal Code'] as string) || undefined,
    // Forecast & type
    forecastCategory: opp['Domo Forecast Category'] || undefined,
    dealType: opp['Type'] || undefined,
    numCompetitors,
    // TDR score — will be calculated after enrichment
    tdrScore: undefined,
    isCompetitive,
    isPartnerPlay: hasPartner,
    isStalled: stageAge > 90,
    isEarlyStage: stageNumber <= 2,
  };
}

/**
 * Hook to get deals transformed from Domo opportunities
 */
export function useDeals() {
  const { data: opportunities, isLoading: oppsLoading, error: oppsError, refetch } = useOpportunities();
  const { data: seMapping, isLoading: seLoading } = useSEMapping();

  // Build SE lookup: se name (lowercase) → se_manager
  const seLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    if (!seMapping) return lookup;

    console.log(`[SE Lookup] Building from ${seMapping.length} mapping records`);

    for (const mapping of seMapping) {
      const se = mapping.se?.trim();
      const mgr = mapping.se_manager?.trim();
      if (se && mgr) {
        lookup.set(se.toLowerCase(), mgr);
      }
    }

    console.log(`[SE Lookup] Built ${lookup.size} entries`);
    console.log(`[SE Lookup] Samples:`,
      Array.from(lookup.entries()).slice(0, 8).map(([k, v]) => `"${k}" → "${v}"`)
    );

    // Log unique managers
    const managers = new Set(lookup.values());
    console.log(`[SE Lookup] Unique SE Managers:`, Array.from(managers));

    return lookup;
  }, [seMapping]);

  // Transform, enrich with SE Manager, and calculate TDR score
  const deals: Deal[] = useMemo(() => {
    if (!opportunities) return [];

    let matchCount = 0;
    const unmatchedSEs = new Set<string>();

    const result = opportunities.map((opp) => {
      const deal = transformOpportunityToDeal(opp);

      // Join: look up SE Manager for the Sales Consultant
      const sc = deal.salesConsultant?.trim();
      if (sc) {
        const mgr = seLookup.get(sc.toLowerCase());
        if (mgr) {
          deal.seManager = mgr;
          matchCount++;
        } else {
          unmatchedSEs.add(sc);
        }
      }

      // Also try PoC Sales Consultant for SE Manager lookup
      if (!deal.seManager && deal.pocSalesConsultant) {
        const pocSC = deal.pocSalesConsultant.trim();
        const mgr = seLookup.get(pocSC.toLowerCase());
        if (mgr) {
          deal.seManager = mgr;
          matchCount++;
        }
      }

      // Calculate TDR score using the full scoring framework
      deal.tdrScore = calculateTDRScore(deal);

      return deal;
    });

    console.log(`[SE Join] Matched ${matchCount}/${result.length} deals`);
    if (unmatchedSEs.size > 0) {
      console.log(`[SE Join] Unmatched SEs:`, Array.from(unmatchedSEs).slice(0, 15));
    }

    return result;
  }, [opportunities, seLookup]);

  // Extract filter options — SE names from Opportunities ONLY
  const filterOptions = useMemo(() => {
    const allowedSet = new Set(ALLOWED_MANAGERS.map(m => m.toLowerCase()));
    const currentYear = new Date().getFullYear();

    // SE Managers from the mapping dataset
    const seManagerSet = new Set<string>();
    if (seMapping) {
      for (const m of seMapping) {
        if (m.se_manager && m.se_manager !== 'TBD' && m.se_manager.trim() !== '') {
          seManagerSet.add(m.se_manager.trim());
        }
      }
    }

    // Build PoC lookup: SE names that map to Dan Wentworth
    const pocSENames = new Set<string>();
    if (seMapping) {
      for (const m of seMapping) {
        if (m.se_manager?.trim() === POC_SE_MANAGER && m.se?.trim()) {
          pocSENames.add(m.se.trim().toLowerCase());
        }
      }
    }

    // SE names from Opportunities ONLY
    const salesConsultants = new Set<string>();
    const pocSalesConsultants = new Set<string>();
    const forecastManagers = new Set<string>();
    const quarters = new Set<string>();

    const isValidQuarter = (q: string): boolean => {
      if (!q) return false;
      const match = q.match(/(\d{4})/);
      return match ? parseInt(match[1]) <= currentYear : false;
    };

    if (opportunities) {
      for (const opp of opportunities) {
        const mgrName = (opp['Mgr Forecast Name'] as string) || opp['Domo Opportunity Owner'] || '';
        if (!allowedSet.has(mgrName.toLowerCase())) continue;

        // Sales Consultant from Opportunities → categorize using SE mapping
        const sc = opp['Sales Consultant'];
        if (sc && sc.trim()) {
          const scTrimmed = sc.trim();
          if (pocSENames.has(scTrimmed.toLowerCase())) {
            pocSalesConsultants.add(scTrimmed);
          } else {
            salesConsultants.add(scTrimmed);
          }
        }

        // PoC Sales Consultant from Opportunities → always PoC Architect
        const pocSC = opp['PoC Sales Consultant'];
        if (pocSC && pocSC.trim()) {
          pocSalesConsultants.add(pocSC.trim());
          // Remove from salesConsultants if it was there
          salesConsultants.delete(pocSC.trim());
        }

        if (mgrName.trim()) forecastManagers.add(mgrName.trim());

        const closeFQ = opp['Close Date FQ'] as string | undefined;
        const currentFQ = opp['Current FQ'] as string | undefined;
        if (closeFQ && isValidQuarter(closeFQ)) quarters.add(closeFQ);
        if (currentFQ && isValidQuarter(currentFQ)) quarters.add(currentFQ);
      }
    }

    // Dedup
    for (const pocSE of pocSalesConsultants) {
      salesConsultants.delete(pocSE);
    }

    console.log(`[Filters] SE Managers: ${seManagerSet.size} — [${Array.from(seManagerSet).join(', ')}]`);
    console.log(`[Filters] Sales Engineers: ${salesConsultants.size}`);
    console.log(`[Filters] PoC Architects: ${pocSalesConsultants.size}`);
    console.log(`[Filters] Forecast Managers: ${forecastManagers.size}`);

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
