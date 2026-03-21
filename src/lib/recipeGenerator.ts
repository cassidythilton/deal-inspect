import { Deal, TDRSessionSummary } from '@/types/tdr';
import { accountIntel as accountIntelService, AccountIntelligence } from '@/lib/accountIntel';
import { gongTranscripts, GongDigestResponse } from '@/lib/gongTranscripts';
import { cortexAi, StructuredExtractResult, ActionPlanResult, TDRBrief } from '@/lib/cortexAi';
import { isDomoEnvironment } from '@/lib/domo';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetDefinition {
  id: string;
  name: string;
  description: string;
  outputFormat: string;
  audience: 'executive' | 'technical' | 'mixed' | 'internal';
  skillRefs: string[];
  contextPriority: string[];
  constraints: string[];
}

interface AssetManifestEntry extends AssetDefinition {
  priority: 'critical' | 'recommended' | 'optional';
  triggerReason: string;
}

interface SkillReference {
  id: string;
  description: string;
}

interface AIValueContinuumAssessment {
  assessedLevels: Array<{
    level: number;
    name: string;
    confidence: 'high' | 'medium' | 'low';
    evidence: string[];
    domoCapabilities: string[];
  }>;
  seSelectedLevel: string;
  gapDetected: boolean;
  recommendation: string;
}

// ─── Asset Catalog ────────────────────────────────────────────────────────────

const UNIVERSAL_ASSETS: AssetDefinition[] = [
  {
    id: 'U1', name: 'Solution Brief',
    description: 'Executive summary mapping Domo capabilities to customer challenges, business initiatives, and technology landscape.',
    outputFormat: 'Markdown (2–4 pages)',
    audience: 'mixed',
    skillRefs: [],
    contextPriority: ['TDR Brief', 'Perplexity Summary', 'CRM Context'],
    constraints: ['Business language', 'No raw data dumps', 'Reference customer initiatives by name'],
  },
  {
    id: 'U2', name: 'Executive Pitch Deck Outline',
    description: 'Slide-by-slide narrative: customer situation → challenges → vision → Domo solution → differentiation → value → next steps.',
    outputFormat: 'Markdown (slide outline with talking points)',
    audience: 'executive',
    skillRefs: [],
    contextPriority: ['Gong Digest', 'TDR Inputs (deal-context, risk-verdict)', 'Competitive Landscape'],
    constraints: ['Max 15 slides', 'Each slide has title + 3-4 bullet talking points + data reference'],
  },
  {
    id: 'U3', name: 'ROI / Business Case Framework',
    description: 'Quantified value proposition: cost savings, efficiency gains, revenue enablement scaffolded from deal data.',
    outputFormat: 'Markdown (structured framework with fillable sections)',
    audience: 'executive',
    skillRefs: [],
    contextPriority: ['CRM (ACV, deal type)', 'TDR (customer-goal, why-now)', 'Perplexity (business initiatives)'],
    constraints: ['Include 3+ quantifiable metrics', 'Use industry benchmarks where available'],
  },
  {
    id: 'U4', name: 'Deal Strategy Playbook',
    description: 'Internal coaching document: win themes, objection handling, stakeholder influence strategy, competitive counter-positioning.',
    outputFormat: 'Markdown (internal document)',
    audience: 'internal',
    skillRefs: [],
    contextPriority: ['Gong Excerpts', 'Risk-Verdict inputs', 'Extracted Entities', 'Action Plan'],
    constraints: ['INTERNAL ONLY — do not share with customer', 'Map objections to Gong evidence'],
  },
];

const LAYER_ASSETS: Record<string, AssetDefinition> = {
  'Data Integration': {
    id: 'L1', name: 'Integration Architecture Diagram',
    description: 'Data flow diagram: source systems → connectors → Domo pipelines → transformations → output.',
    outputFormat: 'Markdown (diagram spec + Mermaid notation)',
    audience: 'technical',
    skillRefs: ['domo-code-engine', 'domo-workflow', 'domo-manifest'],
    contextPriority: ['TDR (current-state, target-state)', 'Sumble Tech Stack', 'Perplexity Tech Signals'],
    constraints: ['Use Mermaid diagram syntax', 'Reference customer current-state architecture'],
  },
  'Data Warehouse': {
    id: 'L2', name: 'Data Warehouse Design Brief',
    description: 'Schema mapping from current cloud platform to Domo + Snowflake architecture. Migration considerations.',
    outputFormat: 'Markdown (technical brief)',
    audience: 'technical',
    skillRefs: ['domo-dataset-query', 'domo-performance-optimizations'],
    contextPriority: ['TDR (cloud-platform, current-state)', 'Sumble Tech Stack'],
    constraints: ['Address migration from stated cloud-platform', 'Include optimization strategy'],
  },
  'Visualization / BI': {
    id: 'L3', name: 'Dashboard & Analytics Blueprint',
    description: 'Dashboard wireframes, KPI hierarchy, metric definitions, data source mapping, persona-based views.',
    outputFormat: 'Markdown (wireframes + metric definitions)',
    audience: 'mixed',
    skillRefs: ['domo-dataset-query', 'domo-data-api', 'domo-performance-optimizations'],
    contextPriority: ['TDR (customer-goal)', 'Perplexity (business initiatives)', 'CRM Context'],
    constraints: ['Include suggested Domo card types', 'Organize by user persona'],
  },
  'Embedded Analytics': {
    id: 'L4', name: 'Embedded Analytics Design',
    description: 'Domo Everywhere architecture: embed strategy, white-labeling, multi-tenant PDP, customer-facing UX.',
    outputFormat: 'Markdown (architecture document)',
    audience: 'technical',
    skillRefs: ['domo-js', 'domo-manifest'],
    contextPriority: ['TDR (target-state, why-domo)', 'Sumble Tech Stack'],
    constraints: ['Address PDP/multi-tenancy', 'Include authentication flow diagram'],
  },
  'App Development': {
    id: 'L5', name: 'App Prototype Specification',
    description: 'Full app spec: UI/UX requirements, component architecture, data model, navigation flow, manifest config.',
    outputFormat: 'Markdown (detailed spec) + optional code scaffold',
    audience: 'technical',
    skillRefs: ['domo-app-initial-build-playbook', 'domo-js', 'domo-manifest', 'domo-dataset-query', 'domo-appdb'],
    contextPriority: ['TDR (customer-goal, target-state)', 'Perplexity (business initiatives)'],
    constraints: ['Actionable enough for an agent to scaffold the app', 'Include manifest.json skeleton'],
  },
  'Automation / Alerts': {
    id: 'L6', name: 'Automation & Alerting Playbook',
    description: 'Alert rules, workflow triggers, notification chains, escalation logic, SLA monitoring.',
    outputFormat: 'Markdown (playbook)',
    audience: 'technical',
    skillRefs: ['domo-workflow', 'domo-code-engine'],
    contextPriority: ['TDR (customer-goal)', 'Gong (automation mentions)', 'AI Value Continuum (Level 1)'],
    constraints: ['Map to Domo Workflows and Buzz architecture'],
  },
  'AI / ML': {
    id: 'L7', name: 'AI/ML Solution Architecture',
    description: 'Comprehensive architecture mapped to the AI Value Continuum — assesses which levels apply and recommends Domo capabilities at each.',
    outputFormat: 'Markdown (architecture document with diagrams)',
    audience: 'technical',
    skillRefs: ['domo-ai-service-layer', 'domo-code-engine', 'domo-workflow'],
    contextPriority: ['AI Value Continuum Assessment', 'TDR (ai-level, ai-signals, ai-problem, ai-data, ai-value)', 'Sumble Tech Stack'],
    constraints: ['Map across all 4 continuum levels', 'Include data readiness assessment', 'Recommend specific Cortex functions'],
  },
};

// ─── Signal-Conditional Assets ────────────────────────────────────────────────

function getSignalAssets(deal: Deal, inputs: Record<string, Record<string, string>>, extractedEntities: StructuredExtractResult | null): AssetManifestEntry[] {
  const assets: AssetManifestEntry[] = [];

  const competitors = extractedEntities?.structured?.NAMED_COMPETITORS || [];
  if (deal.riskLevel === 'red' || competitors.length > 0 || (deal as Record<string, unknown>).isCompetitive) {
    assets.push({
      id: 'S1', name: 'Competitive Positioning Sheet',
      description: `Feature-by-feature differentiation against: ${competitors.length > 0 ? competitors.join(', ') : 'identified competitors'}.`,
      outputFormat: 'Markdown (comparison matrix + narrative)',
      audience: 'internal',
      skillRefs: [],
      contextPriority: ['Extracted Entities (competitors)', 'Gong (competitor mentions)', 'Perplexity (competitive landscape)'],
      constraints: ['Specific to named competitors in this deal'],
      priority: 'recommended',
      triggerReason: `Competitors detected: ${competitors.join(', ') || 'competitive signals present'}`,
    });
  }

  const partnerName = inputs['risk-verdict']?.['partner-name'];
  if (partnerName || (deal as Record<string, unknown>).partnersInvolved) {
    assets.push({
      id: 'S2', name: 'Partner Enablement Brief',
      description: `Co-sell strategy with ${partnerName || deal.partnersInvolved || 'partner'}.`,
      outputFormat: 'Markdown (co-sell brief)',
      audience: 'internal',
      skillRefs: [],
      contextPriority: ['TDR (partner-name, partner-posture)', 'CRM (partners)'],
      constraints: ['Include joint value proposition', 'Define roles & responsibilities'],
      priority: 'optional',
      triggerReason: `Partner deal: ${partnerName || deal.partnersInvolved}`,
    });
  }

  const stage = (deal.stage || '').toLowerCase();
  if (stage.includes('poc') || stage.includes('pilot') || stage.includes('evaluat')) {
    assets.push({
      id: 'S3', name: 'Technical POC Plan',
      description: 'Scoped POC: success criteria, timeline, data requirements, resource plan, evaluation rubric.',
      outputFormat: 'Markdown (structured plan)',
      audience: 'mixed',
      skillRefs: [],
      contextPriority: ['TDR (customer-goal, timeline)', 'CRM (close date)', 'Extracted Entities (timelines)'],
      constraints: ['Include clear success criteria', 'Max 4-week POC scope'],
      priority: 'recommended',
      triggerReason: `Deal stage indicates evaluation: ${deal.stage}`,
    });
  }

  if ((deal.stageNumber ?? 99) <= 2) {
    assets.push({
      id: 'S6', name: 'Discovery-to-Demo Bridge',
      description: 'Demo script aligned to discovered pain points, discovery gap analysis, recommended next conversations.',
      outputFormat: 'Markdown (demo script + gap analysis)',
      audience: 'internal',
      skillRefs: [],
      contextPriority: ['Gong Digest', 'TDR (customer-goal, why-now)', 'Perplexity Summary'],
      constraints: ['Identify what is still unknown', 'Include talking points per stakeholder'],
      priority: 'optional',
      triggerReason: `Early-stage deal (stage ${deal.stageNumber})`,
    });
  }

  if ((deal.stageNumber ?? 0) >= 5) {
    assets.push({
      id: 'S7', name: 'Implementation Readiness Packet',
      description: 'Deployment timeline, resource requirements, onboarding milestones, customer success handoff.',
      outputFormat: 'Markdown (implementation plan)',
      audience: 'mixed',
      skillRefs: [],
      contextPriority: ['TDR (timeline, target-state)', 'CRM (close date)', 'Sumble (org profile)'],
      constraints: ['Include go-live checklist', 'Address training plan'],
      priority: 'optional',
      triggerReason: `Late-stage deal (stage ${deal.stageNumber})`,
    });
  }

  const stakeholders = extractedEntities?.structured?.NAMED_STAKEHOLDERS || [];
  if (stakeholders.length >= 3 || deal.acv > 200000) {
    assets.push({
      id: 'S4', name: 'Executive Stakeholder Map',
      description: 'Influence diagram, per-persona value messaging, objection anticipation by role.',
      outputFormat: 'Markdown (map + messaging guide)',
      audience: 'internal',
      skillRefs: [],
      contextPriority: ['Extracted Entities (stakeholders)', 'Gong (stakeholder mentions)', 'Sumble (key people)'],
      constraints: ['Use Mermaid for influence diagram', 'Include messaging by persona'],
      priority: 'optional',
      triggerReason: `${stakeholders.length} stakeholders identified, ACV $${deal.acv.toLocaleString()}`,
    });
  }

  return assets;
}

// ─── Skills Repository Reference ──────────────────────────────────────────────

const FALLBACK_SKILLS: SkillReference[] = [
  { id: 'domo-app-initial-build-playbook', description: 'Kickoff sequence for new Domo app builds' },
  { id: 'domo-js', description: 'ryuu.js usage, navigation/events, import safety' },
  { id: 'domo-manifest', description: 'manifest.json mapping requirements and gotchas' },
  { id: 'domo-dataset-query', description: '@domoinc/query syntax and constraints' },
  { id: 'domo-data-api', description: 'High-level data-access routing' },
  { id: 'domo-appdb', description: 'Toolkit-first AppDB CRUD/query patterns' },
  { id: 'domo-ai-service-layer', description: 'AIClient patterns for generation, text-to-sql' },
  { id: 'domo-code-engine', description: 'Code Engine function invocation and contracts' },
  { id: 'domo-workflow', description: 'Workflow start/status patterns and input contracts' },
  { id: 'domo-performance-optimizations', description: 'Data query performance rules' },
  { id: 'domo-app-publish', description: 'Build and publish flow' },
  { id: 'domo-toolkit-wrapper', description: '@domoinc/toolkit client usage' },
  { id: 'domo-custom-connector-ide', description: 'Connector IDE auth/data processing' },
];

export async function fetchAvailableSkills(): Promise<SkillReference[]> {
  try {
    const response = await fetch('https://api.github.com/repos/stahura/domo-ai-vibe-rules/contents/skills');
    if (!response.ok) {
      console.warn('[Recipe] Failed to fetch skills from GitHub, using fallback.');
      return FALLBACK_SKILLS;
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      return data
        .filter((item: { type: string }) => item.type === 'dir')
        .map((item: { name: string }) => {
          const fallback = FALLBACK_SKILLS.find(s => s.id === item.name);
          return { id: item.name, description: fallback?.description || 'Domo platform skill' };
        });
    }
    return FALLBACK_SKILLS;
  } catch (err) {
    console.error('[Recipe] Error fetching skills:', err);
    return FALLBACK_SKILLS;
  }
}

// ─── AI Value Continuum Assessment ────────────────────────────────────────────

const AI_CONTINUUM_LEVELS = [
  { level: 1, name: 'Process Automation', keywords: ['manual', 'automate', 'rule', 'alert', 'notification', 'workflow', 'copy-paste', 'spreadsheet', 'email report', 'scheduling', 'batch'] },
  { level: 2, name: 'Traditional AI & ML', keywords: ['predict', 'forecast', 'classify', 'segment', 'cluster', 'anomaly', 'score', 'propensity', 'churn', 'regression', 'model', 'training data'] },
  { level: 3, name: 'Generative AI', keywords: ['generate', 'summarize', 'extract', 'natural language', 'chatbot', 'content', 'document', 'unstructured', 'text-to-sql', 'RAG', 'LLM', 'GPT'] },
  { level: 4, name: 'Agentic AI', keywords: ['autonomous', 'agent', 'orchestrat', 'end-to-end', 'self-service', 'decision', 'action', 'goal', 'reflect', 'multi-step'] },
];

function assessAIValueContinuum(
  inputs: Record<string, Record<string, string>>,
  intel: AccountIntelligence | null,
  gongDigest: string | null,
): AIValueContinuumAssessment {
  const aiStep = inputs['ai-ml'] || {};
  const seLevel = aiStep['ai-level'] || 'Not assessed';
  const aiSignals = aiStep['ai-signals'] || '';
  const aiProblem = aiStep['ai-problem'] || '';
  const aiValue = aiStep['ai-value'] || '';
  const customerGoal = inputs['deal-context']?.['customer-goal'] || '';
  const whyNow = inputs['deal-context']?.['why-now'] || '';

  const allText = [
    customerGoal, whyNow, aiSignals, aiProblem, aiValue,
    gongDigest || '',
    intel?.perplexity?.summary || '',
    ...(intel?.perplexity?.technologySignals || []),
    ...(intel?.perplexity?.recentInitiatives || []),
    ...(intel?.sumble?.technologies || []),
  ].join(' ').toLowerCase();

  const assessedLevels: AIValueContinuumAssessment['assessedLevels'] = [];

  for (const level of AI_CONTINUUM_LEVELS) {
    const matchedKeywords = level.keywords.filter(kw => allText.includes(kw));
    if (matchedKeywords.length >= 2) {
      const domoCapabilities = getDomoCapabilitiesForLevel(level.level);
      assessedLevels.push({
        level: level.level,
        name: level.name,
        confidence: matchedKeywords.length >= 4 ? 'high' : matchedKeywords.length >= 3 ? 'medium' : 'low',
        evidence: matchedKeywords.map(kw => `Signal: "${kw}" found in deal context`),
        domoCapabilities,
      });
    }
  }

  const noAI = seLevel.toLowerCase().includes('no ai');
  const gapDetected = noAI && assessedLevels.length > 0;

  let recommendation = '';
  if (assessedLevels.length === 0) {
    recommendation = 'No strong AI signals detected in deal context. Standard solution approach recommended.';
  } else if (gapDetected) {
    recommendation = `SE selected "${seLevel}" but ${assessedLevels.length} AI opportunity level(s) detected in deal signals. Recommend discussing AI opportunities with the customer.`;
  } else {
    const levels = assessedLevels.map(l => `Level ${l.level}: ${l.name}`).join(', ');
    recommendation = `AI opportunities identified at: ${levels}. Solution architecture should address these levels.`;
  }

  return { assessedLevels, seSelectedLevel: seLevel, gapDetected, recommendation };
}

function getDomoCapabilitiesForLevel(level: number): string[] {
  switch (level) {
    case 1: return ['Domo Workflows', 'Buzz Alerts', 'Code Engine functions', 'Magic ETL conditional branching', 'Beast Mode rules'];
    case 2: return ['SNOWFLAKE.ML.CLASSIFICATION', 'SNOWFLAKE.ML.FORECAST', 'Cortex AI_CLASSIFY', 'Domo AutoML', 'Model Registry'];
    case 3: return ['Cortex AI_COMPLETE', 'Cortex AI_EXTRACT', 'Cortex Search (RAG)', 'Domo AI Service Layer', 'Code Engine LLM orchestration'];
    case 4: return ['Workflows (orchestration)', 'Code Engine (tool execution)', 'AI Service Layer (reasoning)', 'AppDB (state)', 'Cortex functions (intelligence)'];
    default: return [];
  }
}

// ─── Context Aggregation ──────────────────────────────────────────────────────

function formatCRMContext(deal: Deal): string {
  const lines = [
    `## CRM Context\n`,
    `| Field | Value |`,
    `|-------|-------|`,
    `| **Deal Name** | ${deal.dealName} |`,
    `| **Account** | ${deal.account} |`,
    `| **Stage** | ${deal.stage}${deal.stageNumber ? ` [${String(deal.stageNumber).padStart(2, '0')}]` : ''} |`,
    `| **ACV** | $${deal.acv.toLocaleString()} |`,
    `| **Close Date** | ${deal.closeDate}${deal.closeDateFQ ? ` (${deal.closeDateFQ})` : ''} |`,
    `| **Owner** | ${deal.owner} |`,
  ];
  if (deal.accountExecutive) lines.push(`| **Account Executive** | ${deal.accountExecutive} |`);
  if (deal.salesConsultant) lines.push(`| **Sales Consultant** | ${deal.salesConsultant} |`);
  if (deal.seManager) lines.push(`| **SE Manager** | ${deal.seManager} |`);
  if (deal.forecastCategory) lines.push(`| **Forecast Category** | ${deal.forecastCategory} |`);
  if (deal.dealType) lines.push(`| **Deal Type** | ${deal.dealType} |`);
  if ((deal as Record<string, unknown>).competitors) lines.push(`| **Competitors** | ${(deal as Record<string, unknown>).competitors} |`);
  if (deal.partnersInvolved) lines.push(`| **Partners** | ${deal.partnersInvolved} |`);
  if (deal.region) lines.push(`| **Region** | ${deal.region} |`);
  if (deal.salesSegment) lines.push(`| **Segment** | ${deal.salesSegment} |`);
  if (deal.salesVertical) lines.push(`| **Vertical** | ${deal.salesVertical} |`);
  if (deal.accountRevenue) lines.push(`| **Account Revenue** | $${Number(deal.accountRevenue).toLocaleString()} |`);
  if (deal.accountEmployees) lines.push(`| **Account Employees** | ${Number(deal.accountEmployees).toLocaleString()} |`);
  if (deal.websiteDomain) lines.push(`| **Website** | ${deal.websiteDomain} |`);
  return lines.join('\n') + '\n';
}

const STEP_LABELS: Record<string, string> = {
  'deal-context': 'Deal Context',
  'tech-architecture': 'Technical Architecture',
  'risk-verdict': 'Risk & Verdict',
  'ai-ml': 'AI & ML Opportunity Assessment',
  'adoption': 'Adoption & Success',
};

const FIELD_LABELS: Record<string, string> = {
  'strategic-value': 'Strategic Value',
  'customer-goal': 'Customer Goal',
  'why-now': 'Why Now',
  'key-technical-stakeholders': 'Key Technical Stakeholders',
  'timeline': 'Timeline',
  'cloud-platform': 'Cloud Platform',
  'current-state': 'Current State Architecture',
  'target-state': 'Target State',
  'domo-layers': 'Domo Layers',
  'out-of-scope': 'Out of Scope',
  'why-domo': 'Why Domo',
  'top-risks': 'Top Risks',
  'key-assumption': 'Key Assumption',
  'verdict': 'Verdict',
  'partner-name': 'Partner Name',
  'partner-posture': 'Partner Posture',
  'ai-level': 'AI Level (Value Continuum)',
  'ai-signals': 'AI Opportunity Signals',
  'ai-problem': 'AI Problem Statement',
  'ai-data': 'Data Readiness',
  'ai-value': 'AI Value Proposition',
  'expected-users': 'Expected Users',
  'adoption-success': 'Adoption Success Criteria',
};

function formatTDRInputs(inputs: Record<string, Record<string, string>>): string {
  let md = `## TDR Discovery Inputs\n\n`;
  const stepOrder = ['deal-context', 'tech-architecture', 'risk-verdict', 'ai-ml', 'adoption'];

  for (const stepId of stepOrder) {
    const stepInputs = inputs[stepId];
    if (!stepInputs) continue;
    md += `### ${STEP_LABELS[stepId] || stepId}\n\n`;
    for (const [fieldId, value] of Object.entries(stepInputs)) {
      if (!value || value.toString().trim() === '') continue;
      const label = FIELD_LABELS[fieldId] || fieldId;
      let displayValue = value;
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) displayValue = parsed.join(', ');
      } catch { /* not JSON */ }
      md += `- **${label}:** ${displayValue}\n`;
    }
    md += '\n';
  }
  return md;
}

function formatGongContext(digest: GongDigestResponse | null): string {
  let md = `## Gong Call Intelligence\n\n`;
  if (!digest || !digest.success || !digest.digest) {
    md += `*No Gong transcript data available for this deal.*\n\n`;
    return md;
  }
  md += `**Calls Analyzed:** ${digest.callCount || 'N/A'}\n\n`;
  md += `### Digest Summary\n\n`;
  md += digest.digest + '\n\n';
  return md;
}

function formatEnrichmentContext(intel: AccountIntelligence | null): string {
  let md = `## Account Research (Perplexity)\n\n`;

  if (intel?.hasPerplexity && intel.perplexity) {
    const p = intel.perplexity;
    if (p.summary) md += p.summary + '\n\n';
    if (p.recentInitiatives?.length) {
      md += `### Business Initiatives\n`;
      p.recentInitiatives.forEach(i => md += `- ${i}\n`);
      md += '\n';
    }
    if (p.technologySignals?.length) {
      md += `### Technology Signals\n`;
      p.technologySignals.forEach(s => md += `- ${s}\n`);
      md += '\n';
    }
    if (p.competitiveLandscape?.length) {
      md += `### Competitive Landscape\n`;
      p.competitiveLandscape.forEach(c => md += `- ${c}\n`);
      md += '\n';
    }
    if (p.keyInsights?.length) {
      md += `### Key Insights\n`;
      p.keyInsights.forEach(k => md += `- ${k}\n`);
      md += '\n';
    }
    if (p.citations?.length) {
      md += `### Sources\n`;
      p.citations.forEach((c, i) => md += `${i + 1}. ${c}\n`);
      md += '\n';
    }
  } else {
    md += `*No Perplexity research available for this account.*\n\n`;
  }

  md += `## Account Enrichment (Sumble)\n\n`;
  if (intel?.hasSumble && intel.sumble) {
    const s = intel.sumble;
    if (s.technologies?.length) {
      md += `### Tech Stack (${s.technologiesFound || s.technologies.length} technologies)\n`;
      md += s.technologies.join(', ') + '\n\n';
    }
    if (s.techCategories && Object.keys(s.techCategories).length > 0) {
      md += `### Tech Categories\n`;
      for (const [cat, techs] of Object.entries(s.techCategories)) {
        md += `- **${cat}:** ${techs.join(', ')}\n`;
      }
      md += '\n';
    }
  }
  if (intel?.hasSumbleOrg && intel.sumbleOrg) {
    const o = intel.sumbleOrg;
    md += `### Org Profile\n`;
    if (o.industry) md += `- **Industry:** ${o.industry}\n`;
    if (o.totalEmployees) md += `- **Employees:** ${o.totalEmployees.toLocaleString()}\n`;
    if (o.hqCountry) md += `- **HQ:** ${o.hqState ? `${o.hqState}, ` : ''}${o.hqCountry}\n`;
    if (o.linkedinUrl) md += `- **LinkedIn:** ${o.linkedinUrl}\n`;
    md += '\n';
  }
  if (intel?.hasSumbleJobs && intel.sumbleJobs?.jobsSummary) {
    md += `### Hiring Signals (${intel.sumbleJobs.jobCount || 0} active roles)\n`;
    const jobs = intel.sumbleJobs.jobsSummary;
    if (Array.isArray(jobs)) {
      jobs.slice(0, 10).forEach((j: Record<string, unknown>) => {
        md += `- ${j.title || j.function || 'Role'}: ${j.technologies || ''}\n`;
      });
    }
    md += '\n';
  }
  if (intel?.hasSumblePeople && intel.sumblePeople?.peopleSummary) {
    md += `### Key People (${intel.sumblePeople.peopleCount || 0} identified)\n`;
    intel.sumblePeople.peopleSummary.slice(0, 10).forEach(p => {
      md += `- **${p.name}** — ${p.title}${p.department ? `, ${p.department}` : ''}${p.linkedinUrl ? ` ([LinkedIn](${p.linkedinUrl}))` : ''}\n`;
    });
    md += '\n';
  }

  if (!intel?.hasSumble && !intel?.hasSumbleOrg) {
    md += `*No Sumble enrichment available for this account.*\n\n`;
  }
  return md;
}

function formatCortexOutputs(
  brief: TDRBrief | null,
  extraction: StructuredExtractResult | null,
  actionPlan: ActionPlanResult | null,
): string {
  let md = `## AI-Synthesized Intelligence\n\n`;

  if (brief?.success && brief.brief) {
    md += `### TDR Brief\n\n${brief.brief}\n\n`;
  }

  if (extraction?.success && extraction.structured) {
    const s = extraction.structured;
    if (s.THESIS) md += `### Thesis\n\n${s.THESIS}\n\n`;
    if (s.NAMED_COMPETITORS?.length) {
      md += `### Named Competitors\n`;
      s.NAMED_COMPETITORS.forEach(c => md += `- ${c}\n`);
      md += '\n';
    }
    if (s.DOMO_USE_CASES?.length) {
      md += `### Domo Use Cases\n`;
      s.DOMO_USE_CASES.forEach(u => md += `- ${u}\n`);
      md += '\n';
    }
    if (s.NAMED_STAKEHOLDERS?.length) {
      md += `### Stakeholders\n\n`;
      md += `| Name | Role |\n|------|------|\n`;
      s.NAMED_STAKEHOLDERS.forEach(st => md += `| ${st.name} | ${st.role} |\n`);
      md += '\n';
    }
    if (s.RISK_CATEGORIES?.length) {
      md += `### Risk Categories\n`;
      s.RISK_CATEGORIES.forEach(r => md += `- ${r}\n`);
      md += '\n';
    }
    if (s.KEY_DIFFERENTIATORS?.length) {
      md += `### Key Differentiators\n`;
      s.KEY_DIFFERENTIATORS.forEach(d => md += `- ${d}\n`);
      md += '\n';
    }
    if (s.URGENCY_DRIVERS?.length) {
      md += `### Urgency Drivers\n`;
      s.URGENCY_DRIVERS.forEach(u => md += `- ${u}\n`);
      md += '\n';
    }
  }

  if (actionPlan?.success && actionPlan.actionPlan) {
    md += `### Action Plan\n\n${actionPlan.actionPlan}\n\n`;
  }

  if (!brief?.success && !extraction?.success && !actionPlan?.success) {
    md += `*No Cortex AI analysis available for this session.*\n\n`;
  }
  return md;
}

function formatAIContinuum(assessment: AIValueContinuumAssessment): string {
  let md = `## AI Value Continuum Assessment\n\n`;
  md += `**SE-Selected Level:** ${assessment.seSelectedLevel}\n`;
  if (assessment.gapDetected) {
    md += `\n> **GAP DETECTED:** The SE selected "${assessment.seSelectedLevel}" but deal signals suggest AI opportunities exist. See assessment below.\n`;
  }
  md += `\n**Assessment:** ${assessment.recommendation}\n\n`;

  if (assessment.assessedLevels.length > 0) {
    for (const level of assessment.assessedLevels) {
      md += `### Level ${level.level}: ${level.name} (Confidence: ${level.confidence})\n\n`;
      md += `**Evidence:**\n`;
      level.evidence.forEach(e => md += `- ${e}\n`);
      md += `\n**Recommended Domo Capabilities:**\n`;
      level.domoCapabilities.forEach(c => md += `- ${c}\n`);
      md += '\n';
    }
  } else {
    md += `*No AI opportunities detected in deal signals. Re-evaluate if customer discussions surface automation, prediction, or AI needs.*\n\n`;
  }
  return md;
}

// ─── Domo Layer Extraction ────────────────────────────────────────────────────

function extractDomoLayers(inputs: Record<string, Record<string, string>>): string[] {
  const raw = inputs['tech-architecture']?.['domo-layers'];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* not JSON, try comma-separated */ }
  if (raw.includes(',')) return raw.split(',').map(s => s.trim()).filter(Boolean);
  return [raw.trim()].filter(Boolean);
}

// ─── Main Recipe Generator ────────────────────────────────────────────────────

export async function generateRecipeMarkdown(
  deal: Deal,
  session: TDRSessionSummary | null,
  inputs: Record<string, Record<string, string>>,
): Promise<string> {
  console.log('[Recipe] Compiling recipe for deal:', deal.dealName);

  // Parallel context fetching
  const [intel, gongDigest, skills, brief, extraction, actionPlan] = await Promise.all([
    accountIntelService.getLatestIntel(deal.id).catch(() => null as AccountIntelligence | null),
    isDomoEnvironment()
      ? gongTranscripts.getDigest(deal.id).catch(() => null as GongDigestResponse | null)
      : Promise.resolve(null as GongDigestResponse | null),
    fetchAvailableSkills(),
    cortexAi.getLatestBrief(session?.id || '').catch(() => null as TDRBrief | null),
    cortexAi.getLatestExtraction(session?.id || '').catch(() => null as StructuredExtractResult | null),
    cortexAi.getLatestActionPlan(session?.id || '').catch(() => null as ActionPlanResult | null),
  ]);

  // AI Value Continuum Assessment
  const aiAssessment = assessAIValueContinuum(inputs, intel, gongDigest?.digest || null);

  // Build Asset Manifest
  const manifest: AssetManifestEntry[] = [];

  // 1. Universal assets (always included, critical priority)
  for (const asset of UNIVERSAL_ASSETS) {
    manifest.push({ ...asset, priority: 'critical', triggerReason: 'Universal — included for every deal' });
  }

  // 2. Layer-conditional assets
  const domoLayers = extractDomoLayers(inputs);
  for (const layer of domoLayers) {
    const asset = LAYER_ASSETS[layer];
    if (asset) {
      manifest.push({ ...asset, priority: 'recommended', triggerReason: `Domo Layer: ${layer}` });
    }
  }

  // 3. AI Value Continuum override — add L7 if AI detected but AI/ML layer not selected
  const aiLayerSelected = domoLayers.includes('AI / ML');
  if (!aiLayerSelected && aiAssessment.assessedLevels.length > 0) {
    manifest.push({
      ...LAYER_ASSETS['AI / ML'],
      priority: 'recommended',
      triggerReason: `Proactive AI assessment detected ${aiAssessment.assessedLevels.length} opportunity level(s)`,
    });
  }

  // 4. Signal-conditional assets
  const signalAssets = getSignalAssets(deal, inputs, extraction);
  manifest.push(...signalAssets);

  // 5. Security & Governance (layer or industry trigger)
  const govLayer = domoLayers.includes('Governance');
  const regulatedIndustry = intel?.sumbleOrg?.industry?.toLowerCase().match(/health|financ|bank|insur|pharma|govern/);
  if (govLayer || regulatedIndustry) {
    manifest.push({
      id: 'S8', name: 'Security & Governance Addendum',
      description: 'Data governance framework, RBAC/PDP design, compliance mapping.',
      outputFormat: 'Markdown (governance document)',
      audience: 'technical',
      skillRefs: [],
      contextPriority: ['TDR (top-risks)', 'Perplexity (compliance signals)', 'Sumble (org profile)'],
      constraints: ['Address relevant compliance: SOC2, HIPAA, GDPR as applicable'],
      priority: govLayer ? 'recommended' : 'optional',
      triggerReason: govLayer ? 'Governance Domo Layer selected' : `Regulated industry detected: ${intel?.sumbleOrg?.industry}`,
    });
  }

  // Assemble the recipe
  const timestamp = new Date().toISOString();
  let md = '';

  // ── Meta ──
  md += `# Asset Generation Recipe: ${deal.dealName}\n\n`;
  md += `## Meta\n\n`;
  md += `| Field | Value |\n|-------|-------|\n`;
  md += `| **Deal ID** | ${deal.id} |\n`;
  md += `| **Account** | ${deal.account} |\n`;
  md += `| **ACV** | $${deal.acv.toLocaleString()} |\n`;
  md += `| **Stage** | ${deal.stage} |\n`;
  md += `| **Generated** | ${timestamp} |\n`;
  md += `| **Recipe Version** | 2.0 |\n`;
  md += `| **Domo Layers** | ${domoLayers.length > 0 ? domoLayers.join(', ') : 'None specified'} |\n\n`;

  // ── System Instructions ──
  md += `## System Instructions\n\n`;
  md += `You are an expert Solutions Architect (SA) and Sales Engineer (SE) at Domo. Your task is to generate highly tailored, deal-specific sales assets for the deal described in this recipe.\n\n`;
  md += `**Quality Standards:**\n`;
  md += `- Every asset must be specific to THIS deal — reference the customer by name, cite their stated challenges, use their industry context\n`;
  md += `- Use the buyer's own language from Gong transcripts where available\n`;
  md += `- Technical assets must reference specific Domo capabilities with accurate technical detail\n`;
  md += `- Executive assets must be outcome-focused with quantifiable value where possible\n`;
  md += `- Internal assets (Deal Strategy Playbook) must NEVER be shared with the customer\n\n`;

  // ── Asset Manifest ──
  md += `## Asset Manifest\n\n`;
  md += `Generate the following ${manifest.length} assets in priority order:\n\n`;
  md += `| # | Asset | Priority | Trigger | Audience |\n`;
  md += `|---|-------|----------|---------|----------|\n`;
  for (const entry of manifest) {
    md += `| ${entry.id} | **${entry.name}** | ${entry.priority} | ${entry.triggerReason} | ${entry.audience} |\n`;
  }
  md += '\n';

  // Per-asset instructions
  md += `### Per-Asset Instructions\n\n`;
  for (const entry of manifest) {
    md += `#### ${entry.id}: ${entry.name}\n\n`;
    md += `- **Description:** ${entry.description}\n`;
    md += `- **Output Format:** ${entry.outputFormat}\n`;
    md += `- **Audience:** ${entry.audience}\n`;
    md += `- **Context Priority:** ${entry.contextPriority.join(' → ')}\n`;
    if (entry.skillRefs.length > 0) {
      md += `- **Agent Skills:** ${entry.skillRefs.map(s => `\`${s}\``).join(', ')}\n`;
    }
    if (entry.constraints.length > 0) {
      md += `- **Constraints:** ${entry.constraints.join('; ')}\n`;
    }
    md += '\n';
  }

  // ── AI Value Continuum Assessment ──
  md += formatAIContinuum(aiAssessment);

  // ── Deal Context ──
  md += `---\n\n# Deal Context\n\n`;
  md += formatCRMContext(deal);
  md += '\n';
  md += formatTDRInputs(inputs);
  md += formatGongContext(gongDigest);
  md += formatEnrichmentContext(intel);
  md += formatCortexOutputs(brief, extraction, actionPlan);

  // ── Available Agent Skills ──
  md += `## Available Agent Skills\n\n`;
  md += `Leverage skills from [\`stahura/domo-ai-vibe-rules\`](https://github.com/stahura/domo-ai-vibe-rules) where appropriate:\n\n`;
  md += `| Skill | Description |\n|-------|-------------|\n`;
  for (const skill of skills) {
    md += `| \`${skill.id}\` | ${skill.description} |\n`;
  }
  md += `| \`rules/core-platform-rule.md\` | Always-on Domo platform guardrails |\n`;
  md += `| \`rules/domo-gotchas.md\` | Common pitfalls and troubleshooting |\n`;
  md += '\n';

  // ── Constraints & Guardrails ──
  md += `## Constraints & Guardrails\n\n`;
  md += `- All generated assets are **CONFIDENTIAL** — for Domo internal and customer use only\n`;
  md += `- Do not fabricate customer quotes — only use language from Gong transcripts\n`;
  md += `- Do not invent metrics or benchmarks — use "estimated" or "[to be validated]" for unconfirmed numbers\n`;
  md += `- Technical diagrams should use Mermaid syntax for portability\n`;
  md += `- All Domo platform references must be accurate — when in doubt, consult the referenced Agent Skills\n`;
  md += `- The Deal Strategy Playbook (U4) is INTERNAL ONLY and must never be shared with the customer\n`;

  console.log(`[Recipe] Recipe compiled: ${manifest.length} assets, ${domoLayers.length} layers, AI assessment: ${aiAssessment.assessedLevels.length} levels`);
  return md;
}

// ─── Export Actions ───────────────────────────────────────────────────────────

export async function pushRecipeToGitHub(
  dealId: string,
  dealName: string,
  mdContent: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!isDomoEnvironment()) {
    console.log('[Recipe] Dev mode: simulating GitHub push');
    await new Promise(resolve => setTimeout(resolve, 500));
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return { success: true, url: `https://github.com/cassidythilton/tdr-asset-recipes/blob/main/recipes/${dealId}-${ts}.md` };
  }

  try {
    const domo = (window as unknown as { domo?: { post: (url: string, body?: unknown) => Promise<unknown> } }).domo;
    if (!domo) throw new Error('Domo SDK not available');

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${dealId}-${ts}.md`;

    console.log(`[Recipe] Pushing to GitHub: ${filename} (${(mdContent.length / 1024).toFixed(1)} KB)`);
    const raw = await domo.post('/domo/codeengine/v2/packages/pushRecipeToGitHub', {
      dealId,
      dealName,
      filename,
      content: mdContent,
    });

    console.log('[Recipe] GitHub CE response:', JSON.stringify(raw).substring(0, 500));
    const result = raw as Record<string, unknown>;
    const inner = (result.pushRecipeToGitHub || result) as Record<string, unknown>;
    if (!inner.success) {
      console.error('[Recipe] GitHub push returned error:', inner.error);
    }
    return {
      success: !!inner.success,
      url: inner.url as string | undefined,
      error: inner.error as string | undefined,
    };
  } catch (err) {
    console.error('[Recipe] GitHub push exception:', err);
    return { success: false, error: String(err) };
  }
}

export async function sendSlackNotification(
  dealName: string,
  acv: number,
  assetCount: number,
  githubUrl: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isDomoEnvironment()) {
    console.log('[Recipe] Dev mode: simulating Slack notification');
    await new Promise(resolve => setTimeout(resolve, 300));
    return { success: true };
  }

  try {
    const domo = (window as unknown as { domo?: { post: (url: string, body?: unknown) => Promise<unknown> } }).domo;
    if (!domo) throw new Error('Domo SDK not available');

    const raw = await domo.post('/domo/codeengine/v2/packages/notifyRecipeToSlack', {
      dealName,
      acv: String(acv),
      assetCount: String(assetCount),
      githubUrl,
      channel: '#tdr-channel',
    });

    const result = raw as Record<string, unknown>;
    const inner = (result.notifyRecipeToSlack || result) as Record<string, unknown>;
    return {
      success: !!inner.success,
      error: inner.error as string | undefined,
    };
  } catch (err) {
    console.error('[Recipe] Slack notification failed:', err);
    return { success: false, error: String(err) };
  }
}
