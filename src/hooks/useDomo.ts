/**
 * Domo Data Hooks
 *
 * DATA FLOW:
 *   1. Fetch Opportunities via React Query (standard, works)
 *   2. Fetch SE Mapping via DIRECT useEffect (bypasses React Query entirely)
 *   3. Build SE lookup: se name (lowercase) → se_manager
 *   4. Enrich each deal with SE Manager from lookup
 *   5. Extract filter options:
 *      - SALES ENGINEERS  = unique names from "Sales Consultant" field
 *      - POC ARCHITECTS   = unique names from "PoC Sales Consultant" field
 *      - SE MANAGERS      = unique managers from SE mapping dataset
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOpportunities, fetchSEMapping, DomoSEMapping, isDomoEnvironment } from '@/lib/domo';
import { Deal } from '@/types/tdr';
import { getActiveManagers } from '@/lib/appSettings';
import { calculateTDRScore } from '@/lib/tdrCriticalFactors';
// AppDB retired in Sprint 12 — Snowflake is the single source of truth
import type { TDRSession } from '@/lib/appDb';
import { snowflakeStore } from '@/lib/snowflakeStore';
import type { SnowflakeSession } from '@/lib/snowflakeStore';
import type { TDRSessionSummary } from '@/types/tdr';
import { getAppSettings } from '@/lib/appSettings';
import { accountIntel } from '@/lib/accountIntel';
import { generateTDRRecommendations, isAIEnabled } from '@/lib/domoAi';
import type { TDRRecommendation } from '@/lib/domoAi';

export const queryKeys = {
  opportunities: ['opportunities'] as const,
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

/**
 * Transform a Domo opportunity into a Deal.
 */
function transformOpportunityToDeal(opp: Record<string, unknown>): Deal {
  // Read fields with fallbacks for both alias and canonical names
  const get = (primary: string, ...fallbacks: string[]): string => {
    for (const key of [primary, ...fallbacks]) {
      const val = opp[key];
      if (val !== undefined && val !== null && val !== '') return String(val);
    }
    return '';
  };
  const getNum = (primary: string, ...fallbacks: string[]): number => {
    const v = get(primary, ...fallbacks);
    return v ? Number(v) || 0 : 0;
  };

  const hasPartner = !!(get('Primary Partner Role', 'PrimaryPartnerRole') || get('Partners Involved', 'PartnersInvolved'));
  const partnerSignal: Deal['partnerSignal'] = hasPartner 
    ? (get('Primary Partner Role', 'PrimaryPartnerRole') ? 'strong' : 'moderate')
    : 'none';

  const stageAge = getNum('Stage Age', 'StageAge');
  let riskLevel: Deal['riskLevel'] = 'green';
  if (stageAge > 180) riskLevel = 'red';
  else if (stageAge > 90) riskLevel = 'yellow';

  const numCompetitors = getNum('Number of Competitors', 'NumberOfCompetitors');
  const competitors = get('Competitors', 'competitors', 'CompetitorName', 'Competitor') || undefined;
  const isCompetitive = numCompetitors > 0 || !!competitors;

  const reasons: string[] = [];
  if (isCompetitive) reasons.push('Competitive');
  if (hasPartner) reasons.push('Partner play');
  if (stageAge > 90) reasons.push('Stalled');
  const dealType = get('Type');
  if (dealType) reasons.push(dealType);

  const acv = getNum('Likely') || getNum('ACV (USD)', 'AcvUsd') || 0;

  const stage = get('Stage') || 'Unknown';
  let stageNumber = 1;
  const stageMatch = stage.match(/^(\d+):/);
  if (stageMatch) {
    stageNumber = parseInt(stageMatch[1]);
  } else {
    const sl = stage.toLowerCase();
    if (sl.includes('determine') || sl.includes('discovery')) stageNumber = 2;
    else if (sl.includes('demonstrate') || sl.includes('validation')) stageNumber = 3;
    else if (sl.includes('confirm') || sl.includes('proposal') || sl.includes('negotiate')) stageNumber = 4;
    else if (sl.includes('clos')) stageNumber = 5;
  }

  const accountExecutive = get('Domo Opportunity Owner', 'DomoOpportunityOwner') || undefined;
  const owner = get('Forecast Manager', 'Mgr Forecast Name', 'MgrForecastName') || accountExecutive || 'Unassigned';
  const salesConsultant = get('Sales Consultant', 'SalesConsultant') || undefined;
  const pocSalesConsultant = get('PoC Sales Consultant', 'PocSalesConsultant') || undefined;

  return {
    id: get('Opportunity Id', 'OpportunityId'),
    account: get('Account Name', 'AccountName') || 'Unknown Account',
    dealName: get('Opportunity Name', 'OpportunityName') || 'Unnamed Opportunity',
    stage,
    stageNumber,
    stageAge: stageAge || undefined,
    acv,
    closeDate: get('Close Date', 'CloseDate') || new Date().toISOString().split('T')[0],
    closeDateFQ: get('Close Date FQ', 'CloseDateFQ') || undefined,
    partnerSignal,
    riskLevel,
    reasons: reasons.slice(0, 3),
    owner,
    accountExecutive,
    salesConsultant,
    pocSalesConsultant,
    seManager: undefined, // set by SE mapping join
    partnersInvolved: get('Partners Involved', 'PartnersInvolved') || undefined,
    primaryPartnerRole: get('Primary Partner Role', 'PrimaryPartnerRole') || undefined,
    partnerInfluence: get('Partner Influence', 'PartnerInfluence') || undefined,
    snowflakeTeam: get('Snowflake Team Picklist', 'SnowflakeTeamPicklist') || undefined,
    dealCode: get('Deal Code', 'DealCode') || undefined,
    websiteDomain: get('Webiste Domain', 'WebisteDomain') || undefined,
    forecastCategory: get('Domo Forecast Category', 'DomoForecastCategory') || undefined,
    dealType: dealType || undefined,
    numCompetitors,
    competitors,
    tdrScore: undefined,
    isCompetitive,
    isPartnerPlay: hasPartner,
    isStalled: stageAge > 90,
    isEarlyStage: stageNumber <= 2,
    // ML propensity (from DEAL_PREDICTIONS joined in Domo)
    propensityScore: getNum('PropensityScore', 'PROPENSITY_SCORE') || undefined,
    mlPrediction: get('MlPrediction', 'PREDICTION') || undefined,
    propensityQuadrant: (get('PropensityQuadrant', 'QUADRANT') || undefined) as Deal['propensityQuadrant'],
    propensityFactors: buildPropensityFactors(opp),
    propensityScoredAt: get('PropensityScoredAt', 'SCORED_AT') || undefined,
    propensityModelVersion: get('PropensityModelVersion', 'MODEL_VERSION') || undefined,
    accountRevenue: getNum('AccountRevenueUsd', 'Account Revenue USD') || undefined,
    accountEmployees: getNum('AccountEmployees', 'Account Employees') || undefined,
    strategicAccount: (get('StrategicAccount', 'Strategic Account') || '').toLowerCase() === 'true' || undefined,
    region: get('Region') || undefined,
    salesSegment: get('SalesSegment', 'Sales Segment') || undefined,
    salesVertical: get('SalesVertical', 'Sales Vertical') || undefined,
    // Cortex-seeded TDR responses (Sprint 32b)
    callCount: getNum('CallCount', 'call_count') || undefined,
    seededInputs: buildSeededInputs(get),
  };
}

const SEED_FIELD_MAP: Array<[string, string, string]> = [
  // [manifestAlias, stepId, fieldId]
  ['SeedStrategicValue',            'deal-context',       'strategic-value'],
  ['SeedCustomerDecision',          'deal-context',       'customer-goal'],
  ['SeedWhyNow',                    'deal-context',       'why-now'],
  ['SeedKeyTechnicalStakeholders',  'deal-context',       'key-technical-stakeholders'],
  ['SeedTimeline',                  'deal-context',       'timeline'],
  ['SeedCloudPlatform',             'tech-architecture',  'cloud-platform'],
  ['SeedCurrentState',              'tech-architecture',  'current-state'],
  ['SeedTargetState',               'tech-architecture',  'target-state'],
  ['SeedDomoLayers',                'tech-architecture',  'domo-layers'],
  ['SeedOutOfScope',                'tech-architecture',  'out-of-scope'],
  ['SeedWhyDomo',                   'tech-architecture',  'why-domo'],
  ['SeedTopRisks',                  'risk-verdict',       'top-risks'],
  ['SeedKeyAssumption',             'risk-verdict',       'key-assumption'],
  ['SeedVerdict',                   'risk-verdict',       'verdict'],
  ['SeedPartnerName',               'risk-verdict',       'partner-name'],
  ['SeedPartnerPosture',            'risk-verdict',       'partner-posture'],
  ['SeedAiLevel',                   'ai-ml',              'ai-level'],
  ['SeedAiSignals',                 'ai-ml',              'ai-signals'],
  ['SeedAiProblem',                 'ai-ml',              'ai-problem'],
  ['SeedAiData',                    'ai-ml',              'ai-data'],
  ['SeedAiValue',                   'ai-ml',              'ai-value'],
  ['SeedExpectedUsers',             'adoption',           'expected-users'],
  ['SeedAdoptionSuccess',           'adoption',           'adoption-success'],
];

function buildSeededInputs(get: (primary: string, ...fallbacks: string[]) => string): Record<string, string> | undefined {
  const map: Record<string, string> = {};
  let count = 0;
  for (const [alias, stepId, fieldId] of SEED_FIELD_MAP) {
    const val = get(alias);
    if (val) {
      map[`${stepId}::${fieldId}`] = val;
      count++;
    }
  }
  return count > 0 ? map : undefined;
}

function buildPropensityFactors(opp: Record<string, unknown>): Deal['propensityFactors'] {
  const get = (key: string): string => {
    const val = opp[key];
    return val !== undefined && val !== null && val !== '' ? String(val) : '';
  };
  const getNum = (key: string): number => {
    const v = get(key);
    return v ? Number(v) || 0 : 0;
  };

  const factors: NonNullable<Deal['propensityFactors']> = [];
  for (let i = 1; i <= 5; i++) {
    const name = get(`Factor${i}Name`) || get(`FACTOR_${i}_NAME`);
    if (!name) continue;
    factors.push({
      name,
      value: get(`Factor${i}Value`) || get(`FACTOR_${i}_VALUE`),
      direction: (get(`Factor${i}Direction`) || get(`FACTOR_${i}_DIRECTION`) || 'neutral') as 'helps' | 'hurts' | 'neutral',
      magnitude: getNum(`Factor${i}Magnitude`) || getNum(`FACTOR_${i}_MAGNITUDE`),
    });
  }
  return factors.length > 0 ? factors : undefined;
}

/**
 * Main hook — fetches deals, SE mapping, and builds filter options.
 */
export function useDeals() {
  const { data: opportunities, isLoading: oppsLoading, error: oppsError, refetch: refetchOpps } = useOpportunities();

  // ── TDR sessions per deal (Snowflake-only since Sprint 12) ──
  const [tdrSessionsByDeal, setTdrSessionsByDeal] = useState<Map<string, TDRSession[]>>(new Map());
  const [tdrStatusLoaded, setTdrStatusLoaded] = useState(false);

  const fetchTDRStatus = useCallback(async () => {
    const settings = getAppSettings();

    if (!settings.enableSnowflake) {
      setTdrStatusLoaded(true);
      return;
    }

    try {
      console.log('[useDomo] Fetching TDR sessions from Snowflake...');
      const sfMap = await snowflakeStore.getSessionsByDeal();

      // Convert SnowflakeSession map to TDRSession map for compatibility
      const compatMap = new Map<string, TDRSession[]>();
      for (const [oppId, sessions] of sfMap) {
        compatMap.set(oppId, sessions.map(s => snowflakeStore.toAppDbSession(s)));
      }

      setTdrSessionsByDeal(compatMap);
      console.log(`[useDomo] Snowflake: ${sfMap.size} deals with TDR sessions`);
    } catch (err) {
      console.error('[useDomo] Snowflake fetch failed:', err);
    }
    setTdrStatusLoaded(true);
  }, []);

  useEffect(() => {
    fetchTDRStatus();
  }, [fetchTDRStatus]);

  // ── Account Intelligence: which deals have cached intel ──
  const [dealsWithIntel, setDealsWithIntel] = useState<Set<string>>(new Set());

  const fetchDealsWithIntel = useCallback(async () => {
    try {
      const ids = await accountIntel.getDealsWithIntel();
      setDealsWithIntel(ids);
      if (ids.size > 0) {
        console.log(`[useDomo] ${ids.size} deals have cached account intelligence`);
      }
    } catch (err) {
      console.warn('[useDomo] Failed to fetch deals with intel:', err);
    }
  }, []);

  useEffect(() => {
    fetchDealsWithIntel();
  }, [fetchDealsWithIntel]);

  // ── SE Mapping: direct useEffect (bypasses React Query entirely) ──
  const [seMappingData, setSeMappingData] = useState<DomoSEMapping[]>([]);
  const [seMappingStatus, setSeMappingStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  const fetchSEMappingDirect = useCallback(async () => {
    if (!isDomoEnvironment()) {
      setSeMappingStatus('loaded');
      return;
    }
    setSeMappingStatus('loading');
    try {
      console.log('[useDomo] Fetching SE mapping directly...');
      const data = await fetchSEMapping();
      console.log(`[useDomo] SE mapping received: ${data.length} records`);
      if (data.length > 0) {
        console.log('[useDomo] SE mapping sample:', data.slice(0, 3));
        const uniqueMgrs = new Set(data.filter(d => d.se_manager).map(d => d.se_manager));
        console.log('[useDomo] SE Managers found:', Array.from(uniqueMgrs));
      }
      setSeMappingData(data);
      setSeMappingStatus('loaded');
    } catch (err) {
      console.error('[useDomo] SE mapping direct fetch FAILED:', err);
      setSeMappingStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchSEMappingDirect();
  }, [fetchSEMappingDirect]);

  // ── SE Lookup: se name (lowercase) → se_manager ──
  const seLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    if (seMappingData.length === 0) return lookup;

    for (const mapping of seMappingData) {
      const se = mapping.se?.trim();
      const mgr = mapping.se_manager?.trim();
      if (se && mgr) {
        lookup.set(se.toLowerCase(), mgr);
      }
    }

    console.log(`[SE Lookup] Built ${lookup.size} entries from ${seMappingData.length} records`);
    if (lookup.size > 0) {
      console.log('[SE Lookup] Samples:', Array.from(lookup.entries()).slice(0, 5).map(([k, v]) => `"${k}" → "${v}"`));
      console.log('[SE Lookup] Unique managers:', Array.from(new Set(lookup.values())));
    }

    return lookup;
  }, [seMappingData]);

  // ── Transform & enrich deals ──
  const deals: Deal[] = useMemo(() => {
    if (!opportunities) return [];
    
    let matchCount = 0;
    let tdrMatchCount = 0;
    const unmatchedSEs = new Set<string>();

    const result = opportunities.map((opp) => {
      const deal = transformOpportunityToDeal(opp as Record<string, unknown>);
      
      // Join: look up SE Manager for Sales Consultant
      if (deal.salesConsultant) {
        const mgr = seLookup.get(deal.salesConsultant.trim().toLowerCase());
        if (mgr) {
          deal.seManager = mgr;
          matchCount++;
        } else {
          unmatchedSEs.add(deal.salesConsultant);
        }
      }

      // Also try PoC Sales Consultant
      if (!deal.seManager && deal.pocSalesConsultant) {
        const mgr = seLookup.get(deal.pocSalesConsultant.trim().toLowerCase());
        if (mgr) {
          deal.seManager = mgr;
        matchCount++;
      }
      }

      deal.tdrScore = calculateTDRScore(deal);

      // Composite Deal Priority (Sprint 30b)
      if (deal.propensityScore != null && deal.tdrScore != null) {
        const pct = Math.round(deal.propensityScore * 100);
        deal.dealPriority = Math.round(pct * 0.6 + deal.tdrScore * 0.4);
        const highWin = pct >= 40;
        const highComplexity = deal.tdrScore >= 50;
        deal.dealQuadrant = highComplexity && highWin ? 'PRIORITIZE'
          : !highComplexity && highWin ? 'FAST_TRACK'
          : highComplexity && !highWin ? 'INVESTIGATE'
          : 'DEPRIORITIZE';
      }

      // Enrich with TDR sessions from AppDB (multiple per deal)
      const sessions = tdrSessionsByDeal.get(deal.id);
      if (sessions && sessions.length > 0) {
        deal.tdrSessions = sessions.map((s): TDRSessionSummary => ({
          id: s.id || '',
          status: s.status,
          completedAt: s.status === 'completed' ? s.updatedAt : undefined,
          createdAt: s.createdAt,
        }));
        tdrMatchCount++;
      } else {
        deal.tdrSessions = [];
      }

      // Enrich with intel indicator
      deal.hasIntel = dealsWithIntel.has(deal.id);
      
      return deal;
    });
    
    console.log(`[SE Join] Matched ${matchCount}/${result.length} deals to SE managers`);
    if (unmatchedSEs.size > 0) {
      console.log('[SE Join] Unmatched SEs:', Array.from(unmatchedSEs).slice(0, 10));
    }
    if (tdrMatchCount > 0) {
      console.log(`[AppDB] ${tdrMatchCount} deals have TDR sessions`);
    }

    const propensityCount = result.filter(d => d.propensityScore != null).length;
    console.log(`[ML Propensity] ${propensityCount}/${result.length} deals have propensity scores`);
    if (propensityCount > 0) {
      const sample = result.find(d => d.propensityScore != null);
      console.log('[ML Propensity] Sample:', {
        id: sample?.id, score: sample?.propensityScore,
        quadrant: sample?.propensityQuadrant, factors: sample?.propensityFactors?.length
      });
    }

    return result;
  }, [opportunities, seLookup, tdrSessionsByDeal, dealsWithIntel]);

  // ── Filter options ──
  const filterOptions = useMemo(() => {
    const activeManagers = getActiveManagers();
    const allowedSet = new Set(activeManagers.map(m => m.toLowerCase()));
    const currentYear = new Date().getFullYear();

    // SE Managers — from the SE mapping dataset
    const seManagerSet = new Set<string>();
    for (const m of seMappingData) {
      const mgr = m.se_manager?.trim();
      if (mgr && mgr !== 'TBD' && mgr !== '') {
        seManagerSet.add(mgr);
      }
    }

    // Fallback: extract SE managers from enriched deals
    if (seManagerSet.size === 0 && deals.length > 0) {
      console.log('[Filters] SE mapping empty — extracting managers from deals...');
      for (const d of deals) {
        if (d.seManager && d.seManager.trim()) {
          seManagerSet.add(d.seManager.trim());
        }
      }
    }

    // SE names from Opportunities —
    // SALES ENGINEERS  = names in "Sales Consultant" field
    // POC ARCHITECTS   = names in "PoC Sales Consultant" field
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
        const mgrName = String(
          (opp as Record<string, unknown>)['Forecast Manager'] ??
          (opp as Record<string, unknown>)['Mgr Forecast Name'] ??
          (opp as Record<string, unknown>)['MgrForecastName'] ??
          opp['Domo Opportunity Owner'] ?? ''
        ).trim();
        if (!allowedSet.has(mgrName.toLowerCase())) continue;

        // Sales Consultant → SALES ENGINEERS group
        const sc = opp['Sales Consultant']?.trim();
        if (sc) {
          salesConsultants.add(sc);
        }

        // PoC Sales Consultant → POC ARCHITECTS group
        const pocSC = opp['PoC Sales Consultant']?.trim();
        if (pocSC) {
          pocSalesConsultants.add(pocSC);
        }

        if (mgrName) forecastManagers.add(mgrName);

        const closeFQ = String((opp as Record<string, unknown>)['Close Date FQ'] ?? (opp as Record<string, unknown>)['CloseDateFQ'] ?? '');
        if (closeFQ && isValidQuarter(closeFQ)) quarters.add(closeFQ);
        }
    }

    // Derive current FQ from date (replaces dataset-level CurrentFQ column)
    const now = new Date();
    const fq = Math.ceil((now.getMonth() + 1) / 3);
    quarters.add(`${now.getFullYear()}-Q${fq}`);

    // Remove anyone who appears in PoC from the Sales Engineers list
    for (const poc of pocSalesConsultants) {
      salesConsultants.delete(poc);
    }

    console.log(`[Filters] SE Managers: ${seManagerSet.size} — [${Array.from(seManagerSet).join(', ')}]`);
    console.log(`[Filters] Sales Engineers: ${salesConsultants.size} — [${Array.from(salesConsultants).slice(0, 5).join(', ')}...]`);
    console.log(`[Filters] PoC Architects: ${pocSalesConsultants.size} — [${Array.from(pocSalesConsultants).join(', ')}]`);
    console.log(`[Filters] Forecast Managers: ${forecastManagers.size}`);
    console.log(`[Filters] SE mapping status: ${seMappingStatus}`);
    
    return {
      seManagers: Array.from(seManagerSet).sort(),
      salesConsultants: Array.from(salesConsultants).sort(),
      pocSalesConsultants: Array.from(pocSalesConsultants).sort(),
      forecastManagers: Array.from(forecastManagers).filter(mgr =>
        activeManagers.includes(mgr)
      ).sort(),
      quarters: Array.from(quarters).sort(),
    };
  }, [seMappingData, seMappingStatus, opportunities, deals]);

  // ── Domo AI: TDR candidate recommendations ──
  const [aiRecommendations, setAiRecommendations] = useState<TDRRecommendation[]>([]);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  const fetchAIRecommendations = useCallback(async () => {
    if (!isDomoEnvironment() || !isAIEnabled()) {
      setAiStatus('loaded');
      return;
    }
    if (!opportunities || opportunities.length === 0) return;

    setAiStatus('loading');
    try {
      console.log('[useDomo] Fetching Domo AI TDR recommendations...');
      const recs = await generateTDRRecommendations(opportunities);
      console.log(`[useDomo] AI returned ${recs.length} recommendations`);
      setAiRecommendations(recs);
      setAiStatus('loaded');
    } catch (err) {
      console.error('[useDomo] AI recommendations failed:', err);
      setAiStatus('error');
    }
  }, [opportunities]);

  // Trigger AI call once opportunities are loaded
  useEffect(() => {
    if (opportunities && opportunities.length > 0 && aiStatus === 'idle') {
      fetchAIRecommendations();
    }
  }, [opportunities, aiStatus, fetchAIRecommendations]);

  // Derive the IDs of AI-suggested deals (top 3-5)
  const suggestedDealIds: Set<string> = useMemo(() => {
    if (aiRecommendations.length === 0) return new Set();
    // Take top 5 by AI score, minimum score ≥ 50
    const top = aiRecommendations
      .filter((r) => r.score >= 50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return new Set(top.map((r) => r.opportunityId));
  }, [aiRecommendations]);

  const refetch = useCallback(() => {
    refetchOpps();
    fetchSEMappingDirect();
    fetchTDRStatus();
    setAiStatus('idle'); // will re-trigger when opportunities reload
  }, [refetchOpps, fetchSEMappingDirect, fetchTDRStatus]);

  return {
    deals,
    filterOptions,
    isLoading: oppsLoading || seMappingStatus === 'loading',
    error: oppsError,
    refetch,
    refetchTDRStatus: fetchTDRStatus,
    isDomoConnected: isDomoEnvironment(),
    seMappingStatus,
    tdrStatusLoaded,
    // AI Recommendations
    aiRecommendations,
    suggestedDealIds,
    aiStatus,
  };
}
