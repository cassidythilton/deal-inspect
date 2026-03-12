/**
 * ArchitectureDiagram — Interactive 5-layer system architecture diagram.
 *
 * Built with React Flow (@xyflow/react) + dagre for auto-layout.
 * Custom node components with Handle anchors for visible edge connections.
 *
 * Sprint 25: Documentation Hub
 */

import { useState, useCallback, useMemo, memo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { cn } from '@/lib/utils';
import { SnowflakeLogo, CortexLogo } from '@/components/CortexBranding';
import { SumbleIcon } from '@/components/icons/SumbleIcon';
import { PerplexityIcon } from '@/components/icons/PerplexityIcon';
import { DomoIcon } from '@/components/icons/DomoIcon';
import { SlackIcon } from '@/components/icons/SlackIcon';

// ─── Colours ──────────────────────────────────────────────────────────────────

const C = {
  violet: '#a78bfa',
  cyan: '#22d3ee',
  blue: '#60a5fa',
  green: '#4ade80',
  amber: '#fbbf24',
  rose: '#fb7185',
  slate: '#cbd5e1',
  muted: '#94a3b8',
};

// ─── Logos ─────────────────────────────────────────────────────────────────────

const LOGO: Record<string, React.ReactNode> = {
  snowflake: <SnowflakeLogo className="h-4 w-4 shrink-0" />,
  cortex: <CortexLogo className="h-4 w-4 shrink-0" />,
  sumble: <SumbleIcon className="h-4 w-4 shrink-0" style={{ color: '#4ade80' }} />,
  perplexity: <PerplexityIcon className="h-4 w-4 shrink-0" style={{ color: '#e2e8f0' }} />,
  domo: <DomoIcon className="h-4 w-4 shrink-0" style={{ color: '#c4b5fd' }} />,
  slack: <SlackIcon className="h-4 w-4 shrink-0" />,
};

// ─── Custom Node with Handles ─────────────────────────────────────────────────

type ArchData = {
  label: string;
  sublabel?: string;
  color?: string;
  logo?: string;
  tier?: 'group' | 'primary' | 'secondary';
  w?: number;
  h?: number;
  direction?: 'TB' | 'LR';
};

const ArchNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as ArchData;
  const color = d.color ?? C.violet;
  const LogoEl = d.logo ? LOGO[d.logo] ?? null : null;
  const tier = d.tier ?? 'primary';
  const dir = d.direction ?? 'TB';

  // Determine handle positions based on layout direction
  const sourcePos = dir === 'TB' ? Position.Bottom : Position.Right;
  const targetPos = dir === 'TB' ? Position.Top : Position.Left;

  const handleStyle = { background: color, border: 'none', width: 6, height: 6, opacity: 0.6 };

  // Group / header node
  if (tier === 'group') {
    return (
      <>
        <Handle type="target" position={targetPos} style={handleStyle} />
        <div
          className="flex items-center gap-2 rounded-lg px-4 py-2 border-2 border-dashed"
          style={{ borderColor: color, background: color + '18' }}
        >
          {LogoEl}
          <div>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
              {d.label}
            </span>
            {d.sublabel && (
              <span className="block text-[10px] mt-0.5" style={{ color: color + 'cc' }}>
                {d.sublabel}
              </span>
            )}
          </div>
        </div>
        <Handle type="source" position={sourcePos} style={handleStyle} />
      </>
    );
  }

  // Secondary (small leaf)
  if (tier === 'secondary') {
    return (
      <>
        <Handle type="target" position={targetPos} style={handleStyle} />
        <div
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 border"
          style={{ borderColor: color + 'aa', background: '#1e1735' }}
        >
          {LogoEl}
          <span className="text-[11px] font-medium" style={{ color }}>
            {d.label}
          </span>
        </div>
        <Handle type="source" position={sourcePos} style={handleStyle} />
      </>
    );
  }

  // Primary node (default)
  return (
    <>
      <Handle type="target" position={targetPos} style={handleStyle} />
      <div
        className="rounded-lg px-4 py-3 border-2 shadow-lg"
        style={{
          borderColor: color,
          background: '#1e1735',
          boxShadow: `0 0 16px ${color}22`,
        }}
      >
        <div className="flex items-center gap-2.5">
          {LogoEl}
          <div>
            <p className="text-[13px] font-semibold leading-tight" style={{ color: '#f1f5f9' }}>
              {d.label}
            </p>
            {d.sublabel && (
              <p className="text-[11px] leading-tight mt-0.5" style={{ color: C.muted }}>
                {d.sublabel}
              </p>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={sourcePos} style={handleStyle} />
    </>
  );
});
ArchNode.displayName = 'ArchNode';

const nodeTypes = { arch: ArchNode };

// ─── Dagre auto-layout ────────────────────────────────────────────────────────

function layoutGraph(
  rawNodes: Node[],
  rawEdges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
  opts?: { nodeSep?: number; rankSep?: number },
) {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: opts?.nodeSep ?? 60,
    ranksep: opts?.rankSep ?? 80,
    marginx: 40,
    marginy: 40,
  });

  rawNodes.forEach((nd) => {
    const d = nd.data as any;
    g.setNode(nd.id, { width: d.w ?? 200, height: d.h ?? 60 });
  });
  rawEdges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  // Inject direction into node data so Handle knows source/target positions
  const nodes = rawNodes.map((nd) => {
    const { x, y } = g.node(nd.id);
    const d = nd.data as any;
    const w = d.w ?? 200;
    const h = d.h ?? 60;
    return {
      ...nd,
      position: { x: x - w / 2, y: y - h / 2 },
      data: { ...d, direction },
    };
  });

  return { nodes, edges: rawEdges };
}

// ─── Edge helper ──────────────────────────────────────────────────────────────

function edge(
  src: string,
  tgt: string,
  opts?: { color?: string; label?: string; animated?: boolean; dashed?: boolean },
): Edge {
  const c = opts?.color ?? C.violet;
  return {
    id: `${src}→${tgt}`,
    source: src,
    target: tgt,
    type: 'smoothstep',
    animated: opts?.animated ?? false,
    label: opts?.label,
    style: {
      stroke: c,
      strokeWidth: 2,
      strokeDasharray: opts?.dashed ? '6 4' : undefined,
    },
    labelStyle: { fill: '#e2e8f0', fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: '#0d0919', fillOpacity: 0.95 },
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 4,
    markerEnd: { type: MarkerType.ArrowClosed, color: c, width: 16, height: 12 },
  };
}

// ─── Node helper ──────────────────────────────────────────────────────────────

function nd(
  id: string,
  label: string,
  opts?: { sub?: string; color?: string; logo?: string; tier?: 'group' | 'primary' | 'secondary'; w?: number; h?: number },
): Node {
  return {
    id,
    type: 'arch',
    position: { x: 0, y: 0 },
    data: {
      label,
      sublabel: opts?.sub,
      color: opts?.color ?? C.violet,
      logo: opts?.logo,
      tier: opts?.tier ?? 'primary',
      w: opts?.w ?? 200,
      h: opts?.h ?? 60,
    } as any,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 1: System Overview
// ═══════════════════════════════════════════════════════════════════════════════

function buildOverview() {
  const nodes = [
    // Experience Layer
    nd('exp', 'EXPERIENCE LAYER', { sub: 'React SPA — Vite + Shadcn/ui', color: C.violet, tier: 'group', w: 240, h: 52 }),
    nd('cmd', 'Command Center', { sub: 'Deal grid, metrics, scoring', color: C.violet, w: 210, h: 56 }),
    nd('ws', 'TDR Workspace', { sub: '5-step technical review', color: C.violet, w: 210, h: 56 }),
    nd('intel', 'Intelligence Panel', { sub: '4-zone enrichment display', color: C.violet, w: 210, h: 56 }),
    nd('analytics', 'Analytics + NLQ', { sub: 'Charts and natural-language queries', color: C.violet, w: 230, h: 56 }),
    nd('docs', 'Documentation Hub', { sub: 'Architecture and reference', color: C.violet, w: 210, h: 56 }),

    // Code Engine
    nd('ce', 'DOMO CODE ENGINE', { sub: '25 server-side functions (API keys stay here)', color: C.amber, logo: 'domo', tier: 'group', w: 330, h: 52 }),
    nd('grpA', 'Group A: Persistence', { sub: '8 functions — CRUD for sessions, inputs, chat', color: C.amber, w: 270, h: 56 }),
    nd('grpB', 'Group B: Intelligence', { sub: '5 functions — Sumble + Perplexity orchestration', color: C.green, w: 290, h: 56 }),
    nd('grpC', 'Group C: Cortex AI', { sub: '8 functions — LLM briefs, classify, embed, analyst', color: C.cyan, logo: 'cortex', w: 300, h: 56 }),
    nd('grpD', 'Group D: Chat + Distribution', { sub: '4 functions — multi-provider chat, Slack', color: C.rose, w: 280, h: 56 }),

    // Persistence
    nd('sf', 'SNOWFLAKE PERSISTENCE', { sub: '10 tables + 1 analytics view + ML model', color: C.blue, logo: 'snowflake', tier: 'group', w: 320, h: 52 }),
    nd('sessions', 'TDR_SESSIONS', { sub: 'Session lifecycle + scoring', color: C.blue, logo: 'snowflake', w: 220, h: 56 }),
    nd('inputs', 'TDR_STEP_INPUTS', { sub: 'SE answers per step', color: C.blue, w: 200, h: 56 }),
    nd('cache', 'CORTEX_ANALYSIS_RESULTS', { sub: 'AI output cache (24h TTL)', color: C.cyan, logo: 'cortex', w: 240, h: 56 }),

    // Cortex AI
    nd('cx', 'CORTEX AI', { sub: 'In-database LLM functions', color: C.cyan, logo: 'cortex', tier: 'group', w: 220, h: 52 }),
    nd('complete', 'AI_COMPLETE', { sub: 'Claude 4 Sonnet / Opus', color: C.cyan, w: 190, h: 56 }),
    nd('classify', 'AI_CLASSIFY', { sub: 'llama3.1-8b', color: C.cyan, w: 160, h: 56 }),
    nd('embed', 'AI_EMBED + Search', { sub: 'arctic-embed-l-v2.0', color: C.cyan, logo: 'snowflake', w: 190, h: 56 }),
    nd('analyst', 'Cortex Analyst', { sub: 'NLQ-to-SQL for analytics', color: C.cyan, w: 200, h: 56 }),

    // ML Pipeline
    nd('ml', 'ML PIPELINE', { sub: 'Snowflake-native model training + scoring', color: C.violet, logo: 'snowflake', tier: 'group', w: 320, h: 52 }),
    nd('mlmodel', 'ML.CLASSIFICATION', { sub: 'Propensity-to-close — weekly retrain', color: C.violet, logo: 'cortex', w: 260, h: 56 }),
    nd('predictions', 'DEAL_PREDICTIONS', { sub: '6,500+ deals scored nightly', color: C.violet, logo: 'snowflake', w: 240, h: 56 }),
    nd('domoai', 'Domo AI', { sub: 'Field enhancement + tech extraction', color: C.amber, logo: 'domo', w: 240, h: 56 }),

    // External APIs
    nd('ext', 'EXTERNAL APIS', { color: C.green, tier: 'group', w: 160, h: 44 }),
    nd('sumble', 'Sumble', { sub: 'Firmographic + technographic', color: C.green, logo: 'sumble', w: 210, h: 56 }),
    nd('pplx', 'Perplexity', { sub: 'Web research with citations', color: C.rose, logo: 'perplexity', w: 220, h: 56 }),
    nd('slack', 'Slack', { sub: 'Readout distribution', color: C.rose, logo: 'slack', w: 180, h: 56 }),
  ];

  const edges = [
    // Experience → Code Engine
    edge('cmd', 'ce', { color: C.amber, label: 'API calls' }),
    edge('ws', 'ce', { color: C.amber }),
    edge('intel', 'ce', { color: C.amber }),
    edge('analytics', 'ce', { color: C.amber }),
    // CE → groups
    edge('ce', 'grpA', { color: C.amber }),
    edge('ce', 'grpB', { color: C.green }),
    edge('ce', 'grpC', { color: C.cyan }),
    edge('ce', 'grpD', { color: C.rose }),
    // Groups → downstream
    edge('grpA', 'sf', { color: C.blue, label: 'Snowflake SQL' }),
    edge('sf', 'sessions', { color: C.blue }),
    edge('sf', 'inputs', { color: C.blue }),
    edge('sf', 'cache', { color: C.cyan }),
    edge('grpC', 'cx', { color: C.cyan, label: 'Cortex functions' }),
    edge('cx', 'complete', { color: C.cyan }),
    edge('cx', 'classify', { color: C.cyan }),
    edge('cx', 'embed', { color: C.cyan }),
    edge('cx', 'analyst', { color: C.cyan }),
    edge('grpB', 'ext', { color: C.green, label: 'REST APIs' }),
    edge('ext', 'sumble', { color: C.green }),
    edge('ext', 'pplx', { color: C.rose }),
    edge('grpD', 'slack', { color: C.rose, label: 'Webhook' }),
    // ML Pipeline
    edge('sf', 'ml', { color: C.violet, label: 'training data' }),
    edge('ml', 'mlmodel', { color: C.violet }),
    edge('mlmodel', 'predictions', { color: C.violet, label: 'nightly score' }),
    edge('predictions', 'cmd', { color: C.violet, dashed: true, label: 'propensity scores' }),
    // Domo AI
    edge('ce', 'domoai', { color: C.amber, label: 'LLM API' }),
  ];

  return layoutGraph(nodes, edges, 'LR', { nodeSep: 40, rankSep: 80 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 2: Data Model
// ═══════════════════════════════════════════════════════════════════════════════

function buildDataModel() {
  const nodes = [
    nd('sessions', 'TDR_SESSIONS', { sub: 'PK: SESSION_ID  |  Status, scores, timestamps', color: C.blue, logo: 'snowflake', w: 280, h: 60 }),
    nd('inputs', 'TDR_STEP_INPUTS', { sub: 'FK: SESSION_ID  |  Step answers from SE', color: C.violet, w: 260, h: 60 }),
    nd('chat', 'TDR_CHAT_MESSAGES', { sub: 'FK: SESSION_ID  |  Multi-provider chat log', color: C.violet, w: 260, h: 60 }),
    nd('cortex', 'CORTEX_ANALYSIS_RESULTS', { sub: 'FK: SESSION_ID  |  Cached AI outputs (24h TTL)', color: C.cyan, logo: 'cortex', w: 300, h: 60 }),
    nd('sumble', 'ACCOUNT_INTEL_SUMBLE', { sub: 'FK: OPPORTUNITY_ID  |  Tech stack, org, jobs, people', color: C.green, logo: 'sumble', w: 300, h: 60 }),
    nd('pplx', 'ACCOUNT_INTEL_PERPLEXITY', { sub: 'FK: OPPORTUNITY_ID  |  Research + citations', color: C.green, logo: 'perplexity', w: 300, h: 60 }),
    nd('readouts', 'TDR_READOUTS', { sub: 'FK: SESSION_ID  |  Generated PDF snapshots', color: C.rose, w: 250, h: 60 }),
    nd('dist', 'TDR_DISTRIBUTIONS', { sub: 'FK: SESSION_ID  |  Slack delivery receipts', color: C.rose, logo: 'slack', w: 260, h: 60 }),
    nd('usage', 'API_USAGE_LOG', { sub: 'Service, model, tokens, credits, latency', color: C.amber, w: 260, h: 60 }),
    nd('view', 'V_TDR_ANALYTICS (view)', { sub: 'Flattened join: sessions + inputs + cortex extracts', color: C.cyan, w: 310, h: 60 }),
    nd('predictions', 'DEAL_PREDICTIONS', { sub: 'ML propensity scores + SHAP factors (nightly)', color: C.violet, logo: 'snowflake', w: 300, h: 60 }),
    nd('mlmodel', 'ML.CLASSIFICATION', { sub: 'Snowflake ML — AUC 0.997, weekly retrain', color: C.violet, logo: 'cortex', w: 280, h: 60 }),
  ];

  const edges = [
    edge('sessions', 'inputs', { color: C.violet, label: '1 : N' }),
    edge('sessions', 'chat', { color: C.violet, label: '1 : N' }),
    edge('sessions', 'cortex', { color: C.cyan, label: '1 : N' }),
    edge('sessions', 'sumble', { color: C.green }),
    edge('sessions', 'pplx', { color: C.green }),
    edge('sessions', 'readouts', { color: C.rose, label: '1 : N' }),
    edge('readouts', 'dist', { color: C.rose, label: '1 : N' }),
    edge('sessions', 'usage', { color: C.amber, dashed: true }),
    edge('sessions', 'view', { color: C.cyan, dashed: true, label: 'materialized join' }),
    edge('inputs', 'view', { color: C.cyan, dashed: true }),
    edge('cortex', 'view', { color: C.cyan, dashed: true }),
    edge('mlmodel', 'predictions', { color: C.violet, label: 'nightly score' }),
  ];

  return layoutGraph(nodes, edges, 'LR', { nodeSep: 40, rankSep: 80 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 3: Cortex AI Model Map
// ═══════════════════════════════════════════════════════════════════════════════

function buildCortexMap() {
  const nodes = [
    nd('cortex', 'Snowflake Cortex AI', { sub: 'In-database LLM functions', color: C.cyan, logo: 'cortex', tier: 'group', w: 230, h: 52 }),
    nd('sonnet', 'claude-4-sonnet', { sub: 'Primary generation — briefs, action plans, chat', color: C.violet, w: 280, h: 60 }),
    nd('opus', 'claude-4-opus', { sub: 'Deep reasoning — complex analysis', color: C.violet, w: 240, h: 60 }),
    nd('gpt', 'gpt-4.1 / o4-mini', { sub: 'Alternative reasoning models', color: C.amber, w: 230, h: 60 }),
    nd('llama8b', 'llama3.1-8b', { sub: 'Lightweight — classification + extraction', color: C.green, w: 260, h: 60 }),
    nd('domoai', 'Domo AI (text/chat)', { sub: 'TDR field enhancement + tech extraction', color: C.amber, logo: 'domo', w: 280, h: 60 }),
    nd('mlclass', 'ML.CLASSIFICATION', { sub: 'Propensity-to-close model (AUC 0.997)', color: C.violet, logo: 'snowflake', w: 280, h: 60 }),
    nd('llama70b', 'llama3.1-70b', { sub: 'Mid-tier — summarization', color: C.cyan, w: 220, h: 60 }),
    nd('arctic', 'arctic-embed-l-v2.0', { sub: 'Semantic embeddings for similarity search', color: C.blue, logo: 'snowflake', w: 280, h: 60 }),
    // Features
    nd('f-brief', 'TDR Brief', { color: C.violet, tier: 'secondary', w: 110, h: 36 }),
    nd('f-action', 'Action Plan', { color: C.violet, tier: 'secondary', w: 120, h: 36 }),
    nd('f-chat', 'TDR Chat', { color: C.violet, tier: 'secondary', w: 110, h: 36 }),
    nd('f-nlq', 'NLQ to SQL', { color: C.amber, tier: 'secondary', w: 110, h: 36 }),
    nd('f-classify', 'AI_CLASSIFY', { color: C.green, tier: 'secondary', w: 120, h: 36 }),
    nd('f-extract', 'AI_EXTRACT', { color: C.green, tier: 'secondary', w: 120, h: 36 }),
    nd('f-summarize', 'AI_SUMMARIZE', { color: C.cyan, tier: 'secondary', w: 130, h: 36 }),
    nd('f-embed', 'Similar Deals', { color: C.blue, tier: 'secondary', w: 120, h: 36 }),
    // Perplexity
    nd('pplx', 'Perplexity', { sub: 'Web-grounded search', color: C.rose, logo: 'perplexity', tier: 'group', w: 190, h: 52 }),
    nd('sonar', 'sonar / sonar-pro', { sub: 'Citations + real-time research', color: C.rose, w: 240, h: 60 }),
    nd('f-research', 'Web Research', { color: C.rose, tier: 'secondary', w: 120, h: 36 }),
    nd('f-cited', 'Cited Chat', { color: C.rose, tier: 'secondary', w: 110, h: 36 }),
    // Domo AI
    nd('domoai', 'Domo AI', { sub: 'Chat provider fallback', color: C.amber, logo: 'domo', tier: 'group', w: 180, h: 52 }),
    nd('f-domochat', 'Domo Chat', { color: C.amber, tier: 'secondary', w: 110, h: 36 }),
  ];

  const edges = [
    edge('cortex', 'sonnet', { color: C.violet, label: 'AI_COMPLETE' }),
    edge('cortex', 'opus', { color: C.violet }),
    edge('cortex', 'gpt', { color: C.amber }),
    edge('cortex', 'llama8b', { color: C.green, label: 'AI_CLASSIFY / AI_EXTRACT' }),
    edge('cortex', 'llama70b', { color: C.cyan, label: 'AI_SUMMARIZE_AGG' }),
    edge('cortex', 'arctic', { color: C.blue, label: 'AI_EMBED' }),
    edge('sonnet', 'f-brief', { color: C.violet }),
    edge('sonnet', 'f-action', { color: C.violet }),
    edge('sonnet', 'f-chat', { color: C.violet }),
    edge('gpt', 'f-nlq', { color: C.amber }),
    edge('llama8b', 'f-classify', { color: C.green }),
    edge('llama8b', 'f-extract', { color: C.green }),
    edge('llama70b', 'f-summarize', { color: C.cyan }),
    edge('arctic', 'f-embed', { color: C.blue }),
    edge('pplx', 'sonar', { color: C.rose }),
    edge('sonar', 'f-research', { color: C.rose }),
    edge('sonar', 'f-cited', { color: C.rose }),
    edge('domoai', 'f-domochat', { color: C.amber }),
  ];

  return layoutGraph(nodes, edges, 'LR', { nodeSep: 35, rankSep: 80 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 4: Enrichment Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

function buildEnrichment() {
  const nodes = [
    nd('trigger', 'SE clicks "Enrich All"', { sub: 'Intelligence Panel — triggers 3 parallel pipelines', color: C.violet, w: 300, h: 60 }),
    // Sumble
    nd('sumble-api', 'SUMBLE API', { sub: '4 parallel calls', color: C.green, logo: 'sumble', tier: 'group', w: 190, h: 52 }),
    nd('tech', 'Tech Stack', { sub: 'GET /enrich', color: C.green, w: 160, h: 54 }),
    nd('org', 'Organizations', { sub: 'GET /organizations', color: C.green, w: 160, h: 54 }),
    nd('jobs', 'Jobs', { sub: 'GET /jobs', color: C.green, w: 120, h: 54 }),
    nd('people', 'People', { sub: 'GET /people', color: C.green, w: 120, h: 54 }),
    nd('sf-sumble', 'ACCOUNT_INTEL_SUMBLE', { sub: 'Persist to Snowflake', color: C.blue, logo: 'snowflake', w: 230, h: 56 }),
    // Perplexity
    nd('pplx-api', 'PERPLEXITY API', { color: C.rose, logo: 'perplexity', tier: 'group', w: 190, h: 52 }),
    nd('sonar', 'Sonar Pro', { sub: 'Web research + strategic context', color: C.rose, w: 230, h: 54 }),
    nd('citations', 'Citations', { sub: 'Grounded source URLs', color: C.rose, w: 170, h: 54 }),
    nd('sf-pplx', 'ACCOUNT_INTEL_PERPLEXITY', { sub: 'Persist to Snowflake', color: C.blue, logo: 'snowflake', w: 250, h: 56 }),
    // KB
    nd('kb-api', 'DOMO FILESETS (KB)', { color: C.amber, logo: 'domo', tier: 'group', w: 210, h: 52 }),
    nd('fquery', 'Fileset Query', { sub: 'GET /domo/files/v1/...', color: C.amber, w: 200, h: 54 }),
    nd('summarize', 'Cortex Summarize', { sub: 'AI_COMPLETE over file content', color: C.cyan, logo: 'cortex', w: 240, h: 54 }),
    nd('sf-kb', 'CORTEX_ANALYSIS_RESULTS', { sub: 'type: kb_summary — cached 24h', color: C.blue, logo: 'snowflake', w: 260, h: 56 }),
    // Merge
    nd('panel', 'Intelligence Panel', { sub: 'All 3 sources rendered to SE in real-time', color: C.violet, w: 290, h: 60 }),
  ];

  const edges = [
    edge('trigger', 'sumble-api', { color: C.green, label: 'parallel' }),
    edge('trigger', 'pplx-api', { color: C.rose, label: 'parallel' }),
    edge('trigger', 'kb-api', { color: C.amber, label: 'parallel' }),
    edge('sumble-api', 'tech', { color: C.green }),
    edge('sumble-api', 'org', { color: C.green }),
    edge('sumble-api', 'jobs', { color: C.green }),
    edge('sumble-api', 'people', { color: C.green }),
    edge('tech', 'sf-sumble', { color: C.blue, label: 'persist' }),
    edge('org', 'sf-sumble', { color: C.blue }),
    edge('jobs', 'sf-sumble', { color: C.blue }),
    edge('people', 'sf-sumble', { color: C.blue }),
    edge('pplx-api', 'sonar', { color: C.rose }),
    edge('pplx-api', 'citations', { color: C.rose }),
    edge('sonar', 'sf-pplx', { color: C.blue, label: 'persist' }),
    edge('citations', 'sf-pplx', { color: C.blue }),
    edge('kb-api', 'fquery', { color: C.amber }),
    edge('fquery', 'summarize', { color: C.cyan, label: 'AI_COMPLETE' }),
    edge('summarize', 'sf-kb', { color: C.blue, label: 'cache' }),
    edge('sf-sumble', 'panel', { color: C.violet, label: 'display' }),
    edge('sf-pplx', 'panel', { color: C.violet }),
    edge('sf-kb', 'panel', { color: C.violet }),
  ];

  return layoutGraph(nodes, edges, 'LR', { nodeSep: 35, rankSep: 80 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 5: ML Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

function buildMLPipeline() {
  const nodes = [
    // Data Sources
    nd('src', 'TRAINING DATA', { sub: 'Historical closed deals from Snowflake', color: C.blue, logo: 'snowflake', tier: 'group', w: 280, h: 52 }),
    nd('opps', 'Forecast Opportunities', { sub: '65 columns — ACV, stage, competitors, firmographics', color: C.blue, w: 300, h: 56 }),
    nd('outcomes', 'Historical Outcomes', { sub: 'Won / Lost labels for supervised learning', color: C.blue, w: 260, h: 56 }),

    // Feature Engineering
    nd('feat', 'FEATURE ENGINEERING', { sub: 'Leakage-free feature set', color: C.amber, tier: 'group', w: 260, h: 52 }),
    nd('f1', 'DAYS_IN_PIPELINE', { sub: 'Deal age from creation to present', color: C.amber, w: 240, h: 50 }),
    nd('f2', 'STAGE_NUMBER', { sub: 'Ordinal sales stage (1–8)', color: C.amber, w: 210, h: 50 }),
    nd('f3', 'ACV', { sub: 'Annual contract value', color: C.amber, w: 160, h: 50 }),
    nd('f4', 'NUM_COMPETITORS', { sub: 'Known competitive threats', color: C.amber, w: 210, h: 50 }),
    nd('f5', 'QUARTER_END_PROXIMITY', { sub: 'Days to fiscal quarter close', color: C.amber, w: 240, h: 50 }),
    nd('f6', 'FORECAST_CATEGORY', { sub: 'Pipeline / Best Case / Commit', color: C.amber, w: 230, h: 50 }),
    nd('f7', 'HAS_PARTNER + DEAL_TYPE', { sub: 'Partner engaged, New Logo vs Upsell', color: C.amber, w: 260, h: 50 }),

    // Model
    nd('model', 'SNOWFLAKE ML.CLASSIFICATION', { sub: 'Gradient boosted trees — trains on historical deals', color: C.violet, logo: 'cortex', tier: 'group', w: 340, h: 52 }),
    nd('train', 'Model Training', { sub: 'Weekly retrain via Snowflake Task', color: C.violet, logo: 'snowflake', w: 250, h: 56 }),
    nd('eval', 'Evaluation', { sub: 'AUC 0.997 · F1 97.7% · Won F1 92.3%', color: C.cyan, w: 260, h: 56 }),
    nd('shap', 'SHAP Factors', { sub: 'Top 5 factors per deal with direction + magnitude', color: C.cyan, w: 290, h: 56 }),

    // Scoring
    nd('score', 'BATCH SCORING', { sub: 'Nightly — all open pipeline deals', color: C.green, tier: 'group', w: 240, h: 52 }),
    nd('predict', 'DEAL_PREDICTIONS', { sub: '6,500+ deals scored — propensity + quadrant + factors', color: C.green, logo: 'snowflake', w: 340, h: 56 }),

    // Downstream
    nd('domo', 'DOMO SYNC', { sub: 'Magic ETL LEFT JOIN to opportunitiesmagic', color: C.amber, logo: 'domo', tier: 'group', w: 310, h: 52 }),
    nd('table', 'Command Center', { sub: 'Win % column, Deal Priority, quadrant pills', color: C.violet, w: 280, h: 56 }),
    nd('scatter', 'Deal Positioning', { sub: 'Propensity × TDR Score scatter plot', color: C.violet, w: 260, h: 56 }),
    nd('panel', 'Intelligence Panel', { sub: 'Deal Priority hero, SHAP expandable, propensity card', color: C.violet, w: 310, h: 56 }),
  ];

  const edges = [
    edge('src', 'opps', { color: C.blue }),
    edge('src', 'outcomes', { color: C.blue }),
    edge('opps', 'feat', { color: C.amber, label: 'select features' }),
    edge('outcomes', 'feat', { color: C.amber }),
    edge('feat', 'f1', { color: C.amber }),
    edge('feat', 'f2', { color: C.amber }),
    edge('feat', 'f3', { color: C.amber }),
    edge('feat', 'f4', { color: C.amber }),
    edge('feat', 'f5', { color: C.amber }),
    edge('feat', 'f6', { color: C.amber }),
    edge('feat', 'f7', { color: C.amber }),
    edge('f1', 'model', { color: C.violet }),
    edge('f2', 'model', { color: C.violet }),
    edge('f3', 'model', { color: C.violet }),
    edge('f4', 'model', { color: C.violet }),
    edge('f5', 'model', { color: C.violet }),
    edge('f6', 'model', { color: C.violet }),
    edge('f7', 'model', { color: C.violet }),
    edge('model', 'train', { color: C.violet }),
    edge('train', 'eval', { color: C.cyan, label: 'metrics' }),
    edge('train', 'shap', { color: C.cyan, label: 'explain' }),
    edge('train', 'score', { color: C.green, label: 'nightly task' }),
    edge('score', 'predict', { color: C.green }),
    edge('predict', 'domo', { color: C.amber, label: 'Domo dataset sync' }),
    edge('domo', 'table', { color: C.violet, label: 'UI' }),
    edge('domo', 'scatter', { color: C.violet }),
    edge('domo', 'panel', { color: C.violet }),
  ];

  return layoutGraph(nodes, edges, 'TB', { nodeSep: 30, rankSep: 60 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 6: User Workflow
// ═══════════════════════════════════════════════════════════════════════════════

function buildWorkflow() {
  const nodes = [
    nd('s1', '1. Deal Selection', { sub: 'Command Center grid', color: C.violet, w: 180, h: 56 }),
    nd('s2', '2. Open TDR', { sub: 'Creates Snowflake session', color: C.violet, logo: 'snowflake', w: 200, h: 56 }),
    nd('s3', '3. SE Inputs', { sub: '4 required + 1 optional (5-step framework)', color: C.amber, w: 240, h: 56 }),
    nd('ver', 'TDR Versioning', { sub: 'Start New Iteration, previousSessions', color: C.violet, w: 210, h: 56 }),
    nd('s4', '4. Enrichment', { sub: 'Sumble + Perplexity + KB', color: C.green, logo: 'sumble', w: 210, h: 56 }),
    nd('s5', '5. AI Analysis', { sub: 'Cortex briefs + extracts', color: C.cyan, logo: 'cortex', w: 200, h: 56 }),
    nd('s6', '6. Action Plan', { sub: 'AI-synthesized recommendations', color: C.cyan, w: 220, h: 56 }),
    nd('s7', '7. Readout + Share', { sub: 'PDF generation + Slack delivery', color: C.rose, logo: 'slack', w: 230, h: 56 }),
    nd('chat', 'TDR Chat', { sub: 'Available anytime — 3 AI providers', color: C.violet, w: 220, h: 56 }),
    nd('kb', 'KB Search', { sub: 'Fileset query + Cortex summarize', color: C.amber, logo: 'domo', w: 230, h: 56 }),
  ];

  const edges = [
    edge('s1', 's2', { color: C.violet }),
    edge('s2', 's3', { color: C.violet }),
    edge('s2', 'ver', { color: C.violet, dashed: true, label: 'new iteration' }),
    edge('ver', 's3', { color: C.violet, dashed: true }),
    edge('s3', 's4', { color: C.green, label: 'auto or manual' }),
    edge('s4', 's5', { color: C.cyan }),
    edge('s5', 's6', { color: C.cyan }),
    edge('s6', 's7', { color: C.rose }),
    edge('s3', 'chat', { color: C.violet, dashed: true, label: 'anytime' }),
    edge('s3', 'kb', { color: C.amber, dashed: true, label: 'anytime' }),
  ];

  return layoutGraph(nodes, edges, 'LR', { nodeSep: 50, rankSep: 90 });
}

// ─── Layer definitions ────────────────────────────────────────────────────────

type LayerDef = {
  id: string;
  label: string;
  description: string;
  build: () => { nodes: Node[]; edges: Edge[] };
  height: number;
};

const LAYERS: LayerDef[] = [
  { id: 'overview', label: 'System Overview', description: 'Full architecture: UI → Code Engine → Snowflake + ML Pipeline + External APIs', build: buildOverview, height: 720 },
  { id: 'datamodel', label: 'Data Model', description: 'Snowflake tables, foreign keys, and the analytics view', build: buildDataModel, height: 520 },
  { id: 'cortex', label: 'Cortex AI Models', description: 'Which models power which features (Cortex, Perplexity, Domo AI)', build: buildCortexMap, height: 580 },
  { id: 'enrichment', label: 'Enrichment Pipeline', description: 'Three parallel data flows: Sumble, Perplexity, and Knowledge Base', build: buildEnrichment, height: 620 },
  { id: 'ml', label: 'ML Pipeline', description: 'Propensity-to-close: training data → features → model → scoring → UI', build: buildMLPipeline, height: 780 },
  { id: 'workflow', label: 'User Workflow', description: 'End-to-end SE journey from deal selection to Slack readout', build: buildWorkflow, height: 420 },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function ArchitectureDiagram() {
  const [activeLayer, setActiveLayer] = useState('overview');
  const layer = LAYERS.find((l) => l.id === activeLayer) ?? LAYERS[0];
  const { nodes, edges } = useMemo(() => layer.build(), [layer]);

  const onInit = useCallback((instance: any) => {
    requestAnimationFrame(() => {
      instance.fitView({ padding: 0.12, duration: 300 });
    });
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-200 leading-relaxed">
        Interactive architecture diagram. Select a layer below to explore system components,
        data flows, and integration points. Pan and zoom to navigate.
      </p>

      {/* Layer selector */}
      <div className="flex flex-wrap gap-2">
        {LAYERS.map((l) => (
          <button
            key={l.id}
            onClick={() => setActiveLayer(l.id)}
            className={cn(
              'rounded-full px-4 py-2 text-xs font-medium transition-all border',
              activeLayer === l.id
                ? 'bg-violet-500/25 text-violet-200 border-violet-400/60 shadow-md shadow-violet-500/10'
                : 'bg-transparent text-slate-300 border-white/10 hover:text-white hover:border-white/20'
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-400 pl-1">{layer.description}</p>

      {/* React Flow canvas */}
      <div
        className="rounded-xl border border-white/[0.08] overflow-hidden"
        style={{ height: layer.height, background: '#0d0919' }}
      >
        <ReactFlow
          key={activeLayer}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={onInit}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.25}
          maxZoom={2.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          zoomOnScroll
          colorMode="dark"
          defaultEdgeOptions={{
            type: 'smoothstep',
            style: { strokeWidth: 2 },
          }}
        >
          <Background color="#7c3aed12" gap={24} size={1} />
          <Controls
            showInteractive={false}
            position="bottom-left"
            className="!bg-[#1e1735] !border-violet-500/30 !shadow-lg !shadow-black/40 [&>button]:!bg-[#1e1735] [&>button]:!border-violet-500/20 [&>button]:!text-slate-300 [&>button:hover]:!bg-violet-500/15"
          />
        </ReactFlow>
      </div>

      <p className="text-[11px] text-slate-500 italic">
        Drag to pan. Scroll to zoom. Use controls (bottom-left) to fit view.
      </p>
    </div>
  );
}
