/**
 * ArchitectureDiagram — Interactive 5-layer system architecture diagram.
 *
 * Built with React Flow (@xyflow/react) + dagre for auto-layout.
 * Custom node components embed brand logos inside properly styled cards.
 *
 * Sprint 25: Documentation Hub
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Position,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { cn } from '@/lib/utils';
import { SnowflakeLogo, CortexLogo } from '@/components/CortexBranding';
import { SumbleIcon } from '@/components/icons/SumbleIcon';
import { PerplexityIcon } from '@/components/icons/PerplexityIcon';
import { DomoIcon } from '@/components/icons/DomoIcon';
import { SlackIcon } from '@/components/icons/SlackIcon';

// ─── Dagre auto-layout helper ─────────────────────────────────────────────────

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
  nodeSep = 40,
  rankSep = 60,
) {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: nodeSep, ranksep: rankSep });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: node.data.w ?? 180, height: node.data.h ?? 52 });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layouted = nodes.map((node) => {
    const pos = g.node(node.id);
    const w = node.data.w ?? 180;
    const h = node.data.h ?? 52;
    return {
      ...node,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
    };
  });

  return { nodes: layouted, edges };
}

// ─── Colour palette ───────────────────────────────────────────────────────────

const P = {
  violet: '#7c3aed',
  cyan: '#06b6d4',
  blue: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#94a3b8',
  muted: '#475569',
};

// ─── Custom Node Components ───────────────────────────────────────────────────

type ArchNodeData = {
  label: string;
  sublabel?: string;
  color?: string;
  logo?: 'snowflake' | 'cortex' | 'sumble' | 'perplexity' | 'domo' | 'slack';
  isGroup?: boolean;
  w?: number;
  h?: number;
};

const LOGO_MAP: Record<string, React.ReactNode> = {
  snowflake: <SnowflakeLogo className="h-3.5 w-3.5 shrink-0" />,
  cortex: <CortexLogo className="h-3.5 w-3.5 shrink-0" />,
  sumble: <SumbleIcon className="h-3.5 w-3.5 shrink-0" style={{ color: '#22c55e' }} />,
  perplexity: <PerplexityIcon className="h-3.5 w-3.5 shrink-0" style={{ color: '#EDEDED' }} />,
  domo: <DomoIcon className="h-3.5 w-3.5 shrink-0" style={{ color: '#a78bfa' }} />,
  slack: <SlackIcon className="h-3.5 w-3.5 shrink-0" style={{ color: '#E01E5A' }} />,
};

function ArchNode({ data }: { data: ArchNodeData }) {
  const color = data.color ?? P.violet;
  const LogoEl = data.logo ? LOGO_MAP[data.logo] : null;

  if (data.isGroup) {
    return (
      <div
        className="rounded-lg px-3 py-1.5 border border-dashed"
        style={{ borderColor: color + '60', background: color + '08' }}
      >
        <div className="flex items-center gap-1.5">
          {LogoEl}
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: color }}>
            {data.label}
          </span>
        </div>
        {data.sublabel && (
          <span className="text-[8px] block mt-0.5" style={{ color: color + 'aa' }}>
            {data.sublabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg px-3 py-2 border shadow-lg shadow-black/20"
      style={{
        background: '#1B1630',
        borderColor: color + '70',
        minWidth: 100,
      }}
    >
      <div className="flex items-center gap-2">
        {LogoEl}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-100 leading-tight truncate">
            {data.label}
          </p>
          {data.sublabel && (
            <p className="text-[9px] text-slate-400 leading-tight mt-0.5 truncate">
              {data.sublabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Register custom node types (must be stable reference outside render)
const nodeTypes = { arch: ArchNode };

// ─── Shared edge defaults ─────────────────────────────────────────────────────

function makeEdge(
  source: string,
  target: string,
  opts?: { color?: string; label?: string; animated?: boolean; dashed?: boolean },
): Edge {
  const color = opts?.color ?? P.violet + '60';
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: 'default',
    animated: opts?.animated ?? false,
    label: opts?.label,
    style: {
      stroke: color,
      strokeWidth: 1.5,
      strokeDasharray: opts?.dashed ? '6 3' : undefined,
    },
    labelStyle: { fill: '#94a3b8', fontSize: 9, fontWeight: 500 },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 10 },
  };
}

// ─── Layer 1: System Overview ─────────────────────────────────────────────────

function buildOverview() {
  const nodes: Node[] = [
    // Experience Layer
    { id: 'exp-group', type: 'arch', data: { label: 'Experience Layer', sublabel: 'React SPA (Vite + Shadcn/ui)', color: P.violet, isGroup: true, w: 140, h: 36 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'cmd', type: 'arch', data: { label: 'Command Center', sublabel: 'Deal Grid + Metrics', color: P.violet, w: 150, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'ws', type: 'arch', data: { label: 'TDR Workspace', sublabel: '9-Step Review', color: P.violet, w: 140, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'intel', type: 'arch', data: { label: 'Intelligence', sublabel: '4-Zone Panel', color: P.violet, w: 130, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'analytics', type: 'arch', data: { label: 'Analytics', sublabel: 'NLQ + Charts', color: P.violet, w: 120, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'docs', type: 'arch', data: { label: 'Documentation', sublabel: 'Arch + Reference', color: P.violet, w: 130, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },

    // Code Engine Layer
    { id: 'ce-group', type: 'arch', data: { label: 'Domo Code Engine', sublabel: '25 Functions', color: P.amber, isGroup: true, logo: 'domo', w: 160, h: 36 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'grpA', type: 'arch', data: { label: 'Group A: Persistence', sublabel: '8 functions', color: P.amber, w: 160, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'grpB', type: 'arch', data: { label: 'Group B: Intel', sublabel: '5 functions', color: P.amber, w: 140, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'grpC', type: 'arch', data: { label: 'Group C: Cortex AI', sublabel: '8 functions', color: P.amber, logo: 'cortex', w: 160, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'grpD', type: 'arch', data: { label: 'Group D: Chat', sublabel: '4 functions', color: P.amber, w: 140, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },

    // Persistence Layer
    { id: 'sf-group', type: 'arch', data: { label: 'Snowflake', sublabel: 'Persistence', color: P.blue, isGroup: true, logo: 'snowflake', w: 120, h: 36 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'sessions', type: 'arch', data: { label: 'TDR_SESSIONS', sublabel: 'Session state', color: P.blue, logo: 'snowflake', w: 160, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'inputs', type: 'arch', data: { label: 'TDR_STEP_INPUTS', sublabel: 'SE inputs', color: P.blue, w: 150, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'cache', type: 'arch', data: { label: 'CORTEX_ANALYSIS_RESULTS', sublabel: 'AI cache', color: P.cyan, logo: 'cortex', w: 200, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },

    // Cortex AI
    { id: 'cx-group', type: 'arch', data: { label: 'Cortex AI', color: P.cyan, isGroup: true, logo: 'cortex', w: 100, h: 36 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'complete', type: 'arch', data: { label: 'AI_COMPLETE', color: P.cyan, w: 120, h: 38 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'classify', type: 'arch', data: { label: 'AI_CLASSIFY', color: P.cyan, w: 120, h: 38 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'embed', type: 'arch', data: { label: 'AI_EMBED', color: P.cyan, w: 120, h: 38 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'analyst', type: 'arch', data: { label: 'Cortex Analyst', color: P.cyan, w: 120, h: 38 } as ArchNodeData, position: { x: 0, y: 0 } },

    // External APIs
    { id: 'ext-group', type: 'arch', data: { label: 'External APIs', color: P.green, isGroup: true, w: 110, h: 36 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'sumble', type: 'arch', data: { label: 'Sumble', sublabel: '4 endpoints', color: P.green, logo: 'sumble', w: 130, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'pplx', type: 'arch', data: { label: 'Perplexity', sublabel: 'Sonar / Sonar Pro', color: P.rose, logo: 'perplexity', w: 150, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'slack', type: 'arch', data: { label: 'Slack', sublabel: 'Distribution', color: P.rose, logo: 'slack', w: 120, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
  ];

  const edges: Edge[] = [
    // Experience → Code Engine
    makeEdge('cmd', 'ce-group', { color: P.amber + '50' }),
    makeEdge('ws', 'ce-group', { color: P.amber + '50' }),
    makeEdge('intel', 'ce-group', { color: P.amber + '50' }),
    makeEdge('analytics', 'ce-group', { color: P.amber + '50' }),
    // CE groups → downstream
    makeEdge('ce-group', 'grpA', { color: P.amber + '40' }),
    makeEdge('ce-group', 'grpB', { color: P.amber + '40' }),
    makeEdge('ce-group', 'grpC', { color: P.amber + '40' }),
    makeEdge('ce-group', 'grpD', { color: P.amber + '40' }),
    // Persistence
    makeEdge('grpA', 'sf-group', { color: P.blue + '60' }),
    makeEdge('sf-group', 'sessions', { color: P.blue + '40' }),
    makeEdge('sf-group', 'inputs', { color: P.blue + '40' }),
    makeEdge('sf-group', 'cache', { color: P.cyan + '40' }),
    // Cortex AI
    makeEdge('grpC', 'cx-group', { color: P.cyan + '60' }),
    makeEdge('cx-group', 'complete', { color: P.cyan + '40' }),
    makeEdge('cx-group', 'classify', { color: P.cyan + '40' }),
    makeEdge('cx-group', 'embed', { color: P.cyan + '40' }),
    makeEdge('cx-group', 'analyst', { color: P.cyan + '40' }),
    // External APIs
    makeEdge('grpB', 'ext-group', { color: P.green + '60' }),
    makeEdge('ext-group', 'sumble', { color: P.green + '40' }),
    makeEdge('ext-group', 'pplx', { color: P.rose + '40' }),
    makeEdge('grpD', 'slack', { color: P.rose + '60' }),
  ];

  return getLayoutedElements(nodes, edges, 'TB', 50, 50);
}

// ─── Layer 2: Data Model ──────────────────────────────────────────────────────

function buildDataModel() {
  const nodes: Node[] = [
    { id: 'sessions', type: 'arch', data: { label: 'TDR_SESSIONS', sublabel: 'PK: SESSION_ID', color: P.blue, logo: 'snowflake', w: 170, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'inputs', type: 'arch', data: { label: 'TDR_STEP_INPUTS', sublabel: 'FK: SESSION_ID', color: P.violet, w: 160, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'chat', type: 'arch', data: { label: 'TDR_CHAT_MESSAGES', sublabel: 'FK: SESSION_ID', color: P.violet, w: 170, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'cortex', type: 'arch', data: { label: 'CORTEX_ANALYSIS_RESULTS', sublabel: 'FK: SESSION_ID', color: P.cyan, logo: 'cortex', w: 200, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'sumble', type: 'arch', data: { label: 'ACCOUNT_INTEL_SUMBLE', sublabel: 'FK: OPPORTUNITY_ID', color: P.green, logo: 'sumble', w: 190, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'pplx', type: 'arch', data: { label: 'ACCOUNT_INTEL_PERPLEXITY', sublabel: 'FK: OPPORTUNITY_ID', color: P.green, logo: 'perplexity', w: 210, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'readouts', type: 'arch', data: { label: 'TDR_READOUTS', sublabel: 'FK: SESSION_ID', color: P.rose, w: 140, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'dist', type: 'arch', data: { label: 'TDR_DISTRIBUTIONS', sublabel: 'FK: SESSION_ID', color: P.rose, logo: 'slack', w: 170, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'usage', type: 'arch', data: { label: 'API_USAGE_LOG', sublabel: 'Service, Tokens, Credits', color: P.amber, w: 160, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'view', type: 'arch', data: { label: 'V_TDR_ANALYTICS', sublabel: 'Flattened: Sessions + Inputs + Extracts', color: P.cyan, w: 260, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
  ];

  const edges: Edge[] = [
    makeEdge('sessions', 'inputs', { label: '1:N', color: P.violet + '60' }),
    makeEdge('sessions', 'chat', { label: '1:N', color: P.violet + '60' }),
    makeEdge('sessions', 'cortex', { label: '1:N', color: P.cyan + '60' }),
    makeEdge('sessions', 'sumble', { color: P.green + '50' }),
    makeEdge('sessions', 'pplx', { color: P.green + '50' }),
    makeEdge('sessions', 'readouts', { color: P.rose + '50' }),
    makeEdge('readouts', 'dist', { color: P.rose + '50' }),
    makeEdge('sessions', 'view', { color: P.cyan + '40', dashed: true }),
    makeEdge('inputs', 'view', { color: P.cyan + '40', dashed: true }),
    makeEdge('cortex', 'view', { color: P.cyan + '40', dashed: true }),
  ];

  return getLayoutedElements(nodes, edges, 'TB', 60, 60);
}

// ─── Layer 3: Cortex AI Model Map ─────────────────────────────────────────────

function buildCortexMap() {
  const nodes: Node[] = [
    { id: 'cortex-hub', type: 'arch', data: { label: 'Snowflake Cortex AI', sublabel: 'In-database LLM functions', color: P.cyan, logo: 'cortex', isGroup: true, w: 190, h: 36 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'sonnet', type: 'arch', data: { label: 'claude-4-sonnet', sublabel: 'Primary generation model', color: P.violet, w: 160, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'opus', type: 'arch', data: { label: 'claude-4-opus', sublabel: 'Deep reasoning', color: P.violet, w: 150, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'gpt', type: 'arch', data: { label: 'gpt-4.1 / o4-mini', sublabel: 'Alt. reasoning', color: P.amber, w: 150, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'llama8b', type: 'arch', data: { label: 'llama3.1-8b', sublabel: 'Classification + Extraction', color: P.green, w: 170, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'llama70b', type: 'arch', data: { label: 'llama3.1-70b', sublabel: 'Summarization', color: P.cyan, w: 150, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'arctic', type: 'arch', data: { label: 'arctic-embed-l-v2.0', sublabel: 'Semantic embeddings', color: P.blue, logo: 'snowflake', w: 170, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },

    // Features
    { id: 'f-brief', type: 'arch', data: { label: 'TDR Brief', color: P.violet, w: 100, h: 34 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'f-action', type: 'arch', data: { label: 'Action Plan', color: P.violet, w: 100, h: 34 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'f-chat', type: 'arch', data: { label: 'TDR Chat', color: P.violet, w: 100, h: 34 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'f-nlq', type: 'arch', data: { label: 'NLQ to SQL', color: P.amber, w: 100, h: 34 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'f-classify', type: 'arch', data: { label: 'AI_CLASSIFY', color: P.green, w: 100, h: 34 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'f-extract', type: 'arch', data: { label: 'AI_EXTRACT', color: P.green, w: 100, h: 34 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'f-summarize', type: 'arch', data: { label: 'AI_SUMMARIZE', color: P.cyan, w: 110, h: 34 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'f-embed', type: 'arch', data: { label: 'Similar Deals', color: P.blue, w: 110, h: 34 } as ArchNodeData, position: { x: 0, y: 0 } },

    // Perplexity (separate provider)
    { id: 'pplx-hub', type: 'arch', data: { label: 'Perplexity', sublabel: 'Web-grounded search', color: P.rose, logo: 'perplexity', isGroup: true, w: 150, h: 36 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'sonar', type: 'arch', data: { label: 'sonar / sonar-pro', sublabel: 'Citations + research', color: P.rose, w: 160, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'f-research', type: 'arch', data: { label: 'Research', color: P.rose, w: 90, h: 34 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'f-cited', type: 'arch', data: { label: 'Cited Chat', color: P.rose, w: 90, h: 34 } as ArchNodeData, position: { x: 0, y: 0 } },
  ];

  const edges: Edge[] = [
    makeEdge('cortex-hub', 'sonnet', { color: P.violet + '50' }),
    makeEdge('cortex-hub', 'opus', { color: P.violet + '50' }),
    makeEdge('cortex-hub', 'gpt', { color: P.amber + '50' }),
    makeEdge('cortex-hub', 'llama8b', { color: P.green + '50' }),
    makeEdge('cortex-hub', 'llama70b', { color: P.cyan + '50' }),
    makeEdge('cortex-hub', 'arctic', { color: P.blue + '50' }),
    // Model → feature
    makeEdge('sonnet', 'f-brief', { color: P.violet + '30' }),
    makeEdge('sonnet', 'f-action', { color: P.violet + '30' }),
    makeEdge('sonnet', 'f-chat', { color: P.violet + '30' }),
    makeEdge('sonnet', 'f-nlq', { color: P.amber + '30' }),
    makeEdge('llama8b', 'f-classify', { color: P.green + '30' }),
    makeEdge('llama8b', 'f-extract', { color: P.green + '30' }),
    makeEdge('llama70b', 'f-summarize', { color: P.cyan + '30' }),
    makeEdge('arctic', 'f-embed', { color: P.blue + '30' }),
    // Perplexity
    makeEdge('pplx-hub', 'sonar', { color: P.rose + '50' }),
    makeEdge('sonar', 'f-research', { color: P.rose + '30' }),
    makeEdge('sonar', 'f-cited', { color: P.rose + '30' }),
  ];

  return getLayoutedElements(nodes, edges, 'LR', 30, 80);
}

// ─── Layer 4: Enrichment Pipeline ─────────────────────────────────────────────

function buildEnrichment() {
  const nodes: Node[] = [
    { id: 'trigger', type: 'arch', data: { label: 'SE clicks "Enrich All"', sublabel: 'Intelligence Panel', color: P.violet, w: 180, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },

    // Sumble branch
    { id: 'sumble-group', type: 'arch', data: { label: 'Sumble API', sublabel: '4 parallel calls', color: P.green, isGroup: true, logo: 'sumble', w: 140, h: 36 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'tech', type: 'arch', data: { label: 'Tech Stack', sublabel: '/enrich', color: P.green, w: 120, h: 44 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'org', type: 'arch', data: { label: 'Organizations', sublabel: '/organizations', color: P.green, w: 120, h: 44 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'jobs', type: 'arch', data: { label: 'Jobs', sublabel: '/jobs', color: P.green, w: 100, h: 44 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'people', type: 'arch', data: { label: 'People', sublabel: '/people', color: P.green, w: 100, h: 44 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'sf-sumble', type: 'arch', data: { label: 'ACCOUNT_INTEL_SUMBLE', sublabel: 'Snowflake', color: P.blue, logo: 'snowflake', w: 190, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },

    // Perplexity branch
    { id: 'pplx-group', type: 'arch', data: { label: 'Perplexity API', color: P.rose, isGroup: true, logo: 'perplexity', w: 130, h: 36 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'sonar', type: 'arch', data: { label: 'Sonar Pro', sublabel: 'Web research', color: P.rose, w: 130, h: 44 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'citations', type: 'arch', data: { label: 'Citations', sublabel: 'Grounded sources', color: P.rose, w: 130, h: 44 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'sf-pplx', type: 'arch', data: { label: 'ACCOUNT_INTEL_PERPLEXITY', sublabel: 'Snowflake', color: P.blue, logo: 'snowflake', w: 210, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },

    // KB branch
    { id: 'kb-group', type: 'arch', data: { label: 'Domo Filesets (KB)', color: P.amber, isGroup: true, logo: 'domo', w: 150, h: 36 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'fquery', type: 'arch', data: { label: 'Fileset Query', sublabel: '/domo/files/v1/...', color: P.amber, w: 150, h: 44 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'summarize', type: 'arch', data: { label: 'Cortex Summarize', sublabel: 'AI_COMPLETE', color: P.cyan, logo: 'cortex', w: 160, h: 44 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'sf-kb', type: 'arch', data: { label: 'CORTEX_ANALYSIS_RESULTS', sublabel: 'type: kb_summary', color: P.blue, logo: 'snowflake', w: 200, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },

    // Merge
    { id: 'panel', type: 'arch', data: { label: 'Intelligence Panel', sublabel: 'Rendered to SE in real-time', color: P.violet, w: 190, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
  ];

  const edges: Edge[] = [
    makeEdge('trigger', 'sumble-group', { color: P.green + '60' }),
    makeEdge('trigger', 'pplx-group', { color: P.rose + '60' }),
    makeEdge('trigger', 'kb-group', { color: P.amber + '60' }),
    // Sumble
    makeEdge('sumble-group', 'tech', { color: P.green + '40' }),
    makeEdge('sumble-group', 'org', { color: P.green + '40' }),
    makeEdge('sumble-group', 'jobs', { color: P.green + '40' }),
    makeEdge('sumble-group', 'people', { color: P.green + '40' }),
    makeEdge('tech', 'sf-sumble', { label: 'persist', color: P.blue + '50' }),
    makeEdge('org', 'sf-sumble', { color: P.blue + '40' }),
    // Perplexity
    makeEdge('pplx-group', 'sonar', { color: P.rose + '40' }),
    makeEdge('pplx-group', 'citations', { color: P.rose + '40' }),
    makeEdge('sonar', 'sf-pplx', { label: 'persist', color: P.blue + '50' }),
    // KB
    makeEdge('kb-group', 'fquery', { color: P.amber + '40' }),
    makeEdge('fquery', 'summarize', { color: P.cyan + '50' }),
    makeEdge('summarize', 'sf-kb', { label: 'cache', color: P.blue + '50' }),
    // All → Panel
    makeEdge('sf-sumble', 'panel', { color: P.violet + '40' }),
    makeEdge('sf-pplx', 'panel', { color: P.violet + '40' }),
    makeEdge('sf-kb', 'panel', { color: P.violet + '40' }),
  ];

  return getLayoutedElements(nodes, edges, 'TB', 40, 55);
}

// ─── Layer 5: User Workflow ───────────────────────────────────────────────────

function buildWorkflow() {
  const nodes: Node[] = [
    { id: 's1', type: 'arch', data: { label: '1. Deal Selection', sublabel: 'Command Center', color: P.violet, w: 140, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 's2', type: 'arch', data: { label: '2. Open TDR', sublabel: 'Create Session', color: P.violet, logo: 'snowflake', w: 140, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 's3', type: 'arch', data: { label: '3. SE Inputs', sublabel: '5 Required Steps', color: P.amber, w: 140, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 's4', type: 'arch', data: { label: '4. Enrichment', sublabel: 'Sumble + Perplexity', color: P.green, logo: 'sumble', w: 150, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 's5', type: 'arch', data: { label: '5. AI Analysis', sublabel: 'Brief + Extract', color: P.cyan, logo: 'cortex', w: 140, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 's6', type: 'arch', data: { label: '6. Action Plan', sublabel: 'Cortex Synthesis', color: P.cyan, w: 140, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 's7', type: 'arch', data: { label: '7. Readout', sublabel: 'PDF + Slack', color: P.rose, logo: 'slack', w: 130, h: 48 } as ArchNodeData, position: { x: 0, y: 0 } },

    // Parallel activities
    { id: 'chat', type: 'arch', data: { label: 'TDR Chat', sublabel: '3 providers', color: P.violet, w: 120, h: 44 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'kb', type: 'arch', data: { label: 'KB Search', sublabel: 'Fileset + Cortex', color: P.amber, logo: 'domo', w: 130, h: 44 } as ArchNodeData, position: { x: 0, y: 0 } },
    { id: 'optional', type: 'arch', data: { label: 'Optional Steps', sublabel: '4 deep-dive sections', color: P.muted, w: 140, h: 44 } as ArchNodeData, position: { x: 0, y: 0 } },
  ];

  const edges: Edge[] = [
    makeEdge('s1', 's2', { color: P.violet + '60' }),
    makeEdge('s2', 's3', { color: P.violet + '60' }),
    makeEdge('s3', 's4', { color: P.green + '60' }),
    makeEdge('s4', 's5', { color: P.cyan + '60' }),
    makeEdge('s5', 's6', { color: P.cyan + '60' }),
    makeEdge('s6', 's7', { color: P.rose + '60' }),
    // Parallel
    makeEdge('s3', 'chat', { color: P.violet + '30', dashed: true }),
    makeEdge('s3', 'kb', { color: P.amber + '30', dashed: true }),
    makeEdge('s3', 'optional', { color: P.muted + '30', dashed: true }),
  ];

  return getLayoutedElements(nodes, edges, 'LR', 30, 70);
}

// ─── Layer definitions ────────────────────────────────────────────────────────

type LayerDef = {
  id: string;
  label: string;
  build: () => { nodes: Node[]; edges: Edge[] };
  direction: 'TB' | 'LR';
  height: number;
};

const LAYERS: LayerDef[] = [
  { id: 'overview', label: 'System Overview', build: buildOverview, direction: 'TB', height: 700 },
  { id: 'datamodel', label: 'Data Model', build: buildDataModel, direction: 'TB', height: 520 },
  { id: 'cortex', label: 'Cortex AI Models', build: buildCortexMap, direction: 'LR', height: 620 },
  { id: 'enrichment', label: 'Enrichment Pipeline', build: buildEnrichment, direction: 'TB', height: 700 },
  { id: 'workflow', label: 'User Workflow', build: buildWorkflow, direction: 'LR', height: 400 },
];

// ─── Main export ──────────────────────────────────────────────────────────────

export function ArchitectureDiagram() {
  const [activeLayer, setActiveLayer] = useState('overview');

  const layer = LAYERS.find((l) => l.id === activeLayer) ?? LAYERS[0];

  const { nodes, edges } = useMemo(() => layer.build(), [layer]);

  const onInit = useCallback((instance: any) => {
    setTimeout(() => instance.fitView({ padding: 0.15 }), 50);
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-200 leading-relaxed">
        Interactive architecture diagram powered by React Flow. Click a layer to explore
        data flows through Snowflake, Cortex AI, enrichment providers, and the React frontend.
        Pan, zoom, and drag to explore.
      </p>

      {/* Layer pill switcher */}
      <div className="flex flex-wrap gap-1.5">
        {LAYERS.map((l) => (
          <button
            key={l.id}
            onClick={() => setActiveLayer(l.id)}
            className={cn(
              'rounded-full px-3 py-1.5 text-[11px] font-medium transition-all border',
              activeLayer === l.id
                ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                : 'bg-transparent text-slate-300 border-white/[0.08] hover:text-white hover:border-white/[0.15]'
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* React Flow viewport */}
      <div
        className="rounded-xl border border-white/[0.08] overflow-hidden"
        style={{ height: layer.height, background: '#0f0b1a' }}
      >
        <ReactFlow
          key={activeLayer}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={onInit}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          zoomOnScroll
          colorMode="dark"
        >
          <Background color="#7c3aed15" gap={20} size={1} />
          <Controls
            showInteractive={false}
            className="!bg-[#1B1630] !border-violet-500/20 !shadow-lg !shadow-black/30 [&>button]:!bg-[#1B1630] [&>button]:!border-violet-500/20 [&>button]:!text-slate-300 [&>button:hover]:!bg-violet-500/10"
          />
          <MiniMap
            nodeColor="#7c3aed40"
            maskColor="#0f0b1aee"
            className="!bg-[#1B1630] !border-violet-500/20"
            pannable
            zoomable
          />
        </ReactFlow>
      </div>

      <p className="text-[11px] text-slate-400 italic">
        Drag to pan, scroll to zoom. All nodes represent live components in the deployed system.
      </p>
    </div>
  );
}
