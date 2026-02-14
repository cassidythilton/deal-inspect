/**
 * ArchitectureDiagram — Interactive 5-layer system architecture diagram.
 *
 * Each layer is a pure SVG React component with nodes, edges, and labels.
 * Styled to match the app's dark purple/violet design language.
 *
 * Sprint 25: Documentation Hub
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';

// ─── Colour constants ─────────────────────────────────────────────────────────

const C = {
  bg: '#0f0b1a',
  nodeFill: '#1B1630',
  nodeBorder: '#7c3aed',       // violet-600
  nodeText: '#e2e8f0',         // slate-200
  nodeSubtext: '#cbd5e1',      // slate-300
  edgeStroke: '#7c3aed60',
  edgePulse: '#a78bfa',
  accentBlue: '#3b82f6',
  accentCyan: '#06b6d4',
  accentGreen: '#22c55e',
  accentAmber: '#f59e0b',
  accentRose: '#f43f5e',
  groupBorder: '#2a2540',
  groupFill: '#14102480',
};

// ─── Shared SVG helpers ───────────────────────────────────────────────────────

function Node({
  x, y, w, h, label, sublabel, color = C.nodeBorder, icon,
}: {
  x: number; y: number; w: number; h: number;
  label: string; sublabel?: string; color?: string; icon?: string;
}) {
  return (
    <g>
      <rect
        x={x} y={y} width={w} height={h} rx={8}
        fill={C.nodeFill} stroke={color} strokeWidth={1.5}
        filter="url(#glow)"
      />
      {icon && (
        <text x={x + 12} y={y + (sublabel ? h / 2 - 2 : h / 2 + 1)} fontSize={12} fill={color}>
          {icon}
        </text>
      )}
      <text
        x={icon ? x + 28 : x + w / 2}
        y={y + (sublabel ? h / 2 - 3 : h / 2 + 1)}
        fontSize={11} fontWeight={600} fill={C.nodeText}
        textAnchor={icon ? 'start' : 'middle'}
        dominantBaseline="middle"
      >
        {label}
      </text>
      {sublabel && (
        <text
          x={icon ? x + 28 : x + w / 2}
          y={y + h / 2 + 12}
          fontSize={9} fill={C.nodeSubtext}
          textAnchor={icon ? 'start' : 'middle'}
          dominantBaseline="middle"
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}

function GroupBox({
  x, y, w, h, label, color = C.groupBorder,
}: {
  x: number; y: number; w: number; h: number; label: string; color?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={C.groupFill} stroke={color} strokeWidth={1} strokeDasharray="4 2" />
      <text x={x + 12} y={y + 16} fontSize={9} fontWeight={700} fill={color} textTransform="uppercase" letterSpacing={1}>
        {label}
      </text>
    </g>
  );
}

function Arrow({
  x1, y1, x2, y2, label, color = C.edgeStroke, dashed = false,
}: {
  x1: number; y1: number; x2: number; y2: number; label?: string; color?: string; dashed?: boolean;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Bezier for smooth curves
  const dx = x2 - x1;
  const dy = y2 - y1;
  const isVertical = Math.abs(dy) > Math.abs(dx);
  const cp1x = isVertical ? x1 : mx;
  const cp1y = isVertical ? my : y1;
  const cp2x = isVertical ? x2 : mx;
  const cp2y = isVertical ? my : y2;

  return (
    <g>
      <path
        d={`M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`}
        fill="none" stroke={color} strokeWidth={1.5}
        strokeDasharray={dashed ? '6 3' : undefined}
        markerEnd="url(#arrowhead)"
      />
      {label && (
        <text x={mx} y={my - 6} fontSize={8} fill={C.nodeSubtext} textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}

function SvgDefs() {
  return (
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={C.edgePulse} opacity={0.7} />
      </marker>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
  );
}

// ─── Layer 1: System Overview ─────────────────────────────────────────────────

function SystemOverview() {
  return (
    <svg viewBox="0 0 820 480" className="w-full h-auto">
      <SvgDefs />
      {/* Experience Layer */}
      <GroupBox x={60} y={20} w={700} h={90} label="Experience Layer — React SPA (Vite + Shadcn/ui)" color={C.nodeBorder} />
      <Node x={80} y={46} w={120} h={48} label="Command Center" sublabel="Deal Grid + Metrics" />
      <Node x={215} y={46} w={120} h={48} label="TDR Workspace" sublabel="9-Step Review" />
      <Node x={350} y={46} w={120} h={48} label="Intelligence" sublabel="4-Zone Panel" />
      <Node x={485} y={46} w={110} h={48} label="Analytics" sublabel="NLQ + Charts" />
      <Node x={610} y={46} w={130} h={48} label="Documentation" sublabel="Arch + Reference" />

      {/* Arrows down */}
      <Arrow x1={410} y1={110} x2={410} y2={155} />

      {/* Intelligence Layer */}
      <GroupBox x={60} y={155} w={700} h={90} label="Intelligence Layer — Domo Code Engine (25 Functions)" color={C.accentAmber} />
      <Node x={80} y={181} w={155} h={48} label="Group A: Persistence" sublabel="8 functions" color={C.accentAmber} />
      <Node x={250} y={181} w={155} h={48} label="Group B: Intel" sublabel="5 functions" color={C.accentAmber} />
      <Node x={420} y={181} w={155} h={48} label="Group C: Cortex AI" sublabel="8 functions" color={C.accentAmber} />
      <Node x={590} y={181} w={155} h={48} label="Group D: Chat" sublabel="4 functions" color={C.accentAmber} />

      {/* Arrows down */}
      <Arrow x1={158} y1={245} x2={158} y2={290} color={C.accentBlue + '60'} />
      <Arrow x1={410} y1={245} x2={410} y2={290} color={C.accentCyan + '60'} />
      <Arrow x1={328} y1={245} x2={260} y2={290} color={C.accentBlue + '60'} />
      <Arrow x1={497} y1={245} x2={560} y2={290} color={C.accentGreen + '60'} />
      <Arrow x1={668} y1={245} x2={700} y2={290} color={C.accentRose + '60'} />

      {/* Persistence Layer */}
      <GroupBox x={60} y={290} w={250} h={165} label="Persistence — Snowflake" color={C.accentBlue} />
      <Node x={80} y={316} w={210} h={36} label="TDR_SESSIONS" sublabel="Session state" color={C.accentBlue} />
      <Node x={80} y={360} w={210} h={36} label="TDR_STEP_INPUTS" sublabel="SE inputs" color={C.accentBlue} />
      <Node x={80} y={404} w={210} h={36} label="CORTEX_ANALYSIS_RESULTS" sublabel="AI cache" color={C.accentBlue} />

      {/* Cortex AI */}
      <GroupBox x={330} y={290} w={190} h={165} label="Cortex AI" color={C.accentCyan} />
      <Node x={345} y={316} w={160} h={30} label="AI_COMPLETE" color={C.accentCyan} />
      <Node x={345} y={352} w={160} h={30} label="AI_CLASSIFY" color={C.accentCyan} />
      <Node x={345} y={388} w={160} h={30} label="AI_EMBED" color={C.accentCyan} />
      <Node x={345} y={424} w={160} h={30} label="Cortex Analyst" color={C.accentCyan} />

      {/* External APIs */}
      <GroupBox x={540} y={290} w={220} h={165} label="External APIs" color={C.accentGreen} />
      <Node x={555} y={316} w={190} h={36} label="Sumble" sublabel="4 endpoints" color={C.accentGreen} />
      <Node x={555} y={360} w={190} h={36} label="Perplexity" sublabel="Sonar / Sonar Pro" color={C.accentGreen} />
      <Node x={555} y={404} w={190} h={36} label="Slack" sublabel="Distribution" color={C.accentRose} />
    </svg>
  );
}

// ─── Layer 2: Data Model ──────────────────────────────────────────────────────

function DataModelDiagram() {
  return (
    <svg viewBox="0 0 820 520" className="w-full h-auto">
      <SvgDefs />
      <GroupBox x={20} y={10} w={780} h={500} label="TDR_APP.TDR_DATA — Snowflake Schema" color={C.accentBlue} />

      {/* Core session */}
      <Node x={310} y={40} w={200} h={45} label="TDR_SESSIONS" sublabel="PK: SESSION_ID" color={C.accentBlue} />

      {/* FK children */}
      <Arrow x1={350} y1={85} x2={130} y2={130} label="1:N" />
      <Arrow x1={410} y1={85} x2={410} y2={130} label="1:N" />
      <Arrow x1={470} y1={85} x2={690} y2={130} label="1:N" />

      <Node x={40} y={130} w={190} h={45} label="TDR_STEP_INPUTS" sublabel="FK: SESSION_ID" color={C.nodeBorder} />
      <Node x={310} y={130} w={200} h={45} label="TDR_CHAT_MESSAGES" sublabel="FK: SESSION_ID" color={C.nodeBorder} />
      <Node x={590} y={130} w={200} h={45} label="CORTEX_ANALYSIS_RESULTS" sublabel="FK: SESSION_ID" color={C.accentCyan} />

      {/* Intel tables (keyed by OPPORTUNITY_ID) */}
      <Arrow x1={350} y1={85} x2={130} y2={250} label="" color={C.accentGreen + '60'} />
      <Arrow x1={470} y1={85} x2={560} y2={250} label="" color={C.accentGreen + '60'} />

      <Node x={40} y={230} w={220} h={55} label="ACCOUNT_INTEL_SUMBLE" sublabel="FK: OPPORTUNITY_ID\nTech, Org, Jobs, People" color={C.accentGreen} />
      <Node x={460} y={230} w={220} h={55} label="ACCOUNT_INTEL_PERPLEXITY" sublabel="FK: OPPORTUNITY_ID\nKey Insights, Citations" color={C.accentGreen} />

      {/* Distribution / Readout */}
      <Arrow x1={410} y1={85} x2={410} y2={340} label="" color={C.accentRose + '60'} />
      <Node x={280} y={340} w={130} h={45} label="TDR_READOUTS" sublabel="FK: SESSION_ID" color={C.accentRose} />
      <Node x={430} y={340} w={150} h={45} label="TDR_DISTRIBUTIONS" sublabel="FK: SESSION_ID" color={C.accentRose} />
      <Arrow x1={410} y1={340} x2={505} y2={340} label="" color={C.accentRose + '60'} />

      {/* Usage log */}
      <Node x={40} y={340} w={180} h={45} label="API_USAGE_LOG" sublabel="Service, Tokens, Credits" color={C.accentAmber} />

      {/* Analytics view */}
      <GroupBox x={180} y={420} w={460} h={70} label="Views" color={C.accentCyan} />
      <Node x={200} y={444} w={420} h={36} label="V_TDR_ANALYTICS" sublabel="Flattened: Sessions + Inputs + Structured Extracts → NLQ-ready" color={C.accentCyan} />

      {/* Arrow from sessions to view */}
      <Arrow x1={410} y1={385} x2={410} y2={444} label="" color={C.accentCyan + '60'} dashed />
    </svg>
  );
}

// ─── Layer 3: Cortex AI Model Map ─────────────────────────────────────────────

function CortexModelMap() {
  const models: { name: string; y: number; color: string; features: string[] }[] = [
    { name: 'claude-4-sonnet', y: 40, color: C.nodeBorder, features: ['TDR Brief', 'Action Plan', 'Chat (default)', 'NLQ → SQL', 'Structured Extract', 'Portfolio Insights'] },
    { name: 'claude-4-opus', y: 100, color: C.nodeBorder, features: ['Chat (deep reasoning)', 'Complex analysis'] },
    { name: 'gpt-4.1 / o4-mini', y: 155, color: C.accentAmber, features: ['Chat (alternatives)', 'General reasoning'] },
    { name: 'llama3.1-8b', y: 210, color: C.accentGreen, features: ['AI_CLASSIFY', 'AI_EXTRACT', 'AI_SENTIMENT'] },
    { name: 'llama3.1-70b', y: 265, color: C.accentCyan, features: ['AI_SUMMARIZE_AGG', 'AI_AGG'] },
    { name: 'arctic-embed-l-v2.0', y: 320, color: C.accentBlue, features: ['AI_EMBED → Similar Deals', 'Semantic search'] },
    { name: 'sonar / sonar-pro', y: 380, color: C.accentRose, features: ['Research enrichment', 'Chat (cited answers)'] },
  ];

  return (
    <svg viewBox="0 0 820 440" className="w-full h-auto">
      <SvgDefs />
      {models.map((m) => (
        <g key={m.name}>
          <Node x={40} y={m.y} w={180} h={42} label={m.name} color={m.color} />
          {m.features.map((f, fi) => {
            const fx = 290 + fi * 85;
            const fy = m.y + 6;
            return (
              <g key={fi}>
                <Arrow x1={220} y1={m.y + 21} x2={fx} y2={fy + 14} color={m.color + '50'} />
                <rect x={fx} y={fy} width={78} height={26} rx={5} fill={m.color + '15'} stroke={m.color + '40'} strokeWidth={1} />
                <text x={fx + 39} y={fy + 14} fontSize={8} fill={C.nodeText} textAnchor="middle" dominantBaseline="middle">
                  {f}
                </text>
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

// ─── Layer 4: Enrichment Pipeline ─────────────────────────────────────────────

function EnrichmentPipeline() {
  return (
    <svg viewBox="0 0 820 400" className="w-full h-auto">
      <SvgDefs />

      {/* Trigger */}
      <Node x={310} y={15} w={200} h={40} label="SE clicks 'Enrich All'" sublabel="Intelligence Panel" color={C.nodeBorder} />

      {/* Fan out */}
      <Arrow x1={340} y1={55} x2={120} y2={100} />
      <Arrow x1={410} y1={55} x2={410} y2={100} />
      <Arrow x1={480} y1={55} x2={700} y2={100} />

      {/* Sumble */}
      <GroupBox x={20} y={90} w={300} h={220} label="Sumble API (4 parallel calls)" color={C.accentGreen} />
      <Node x={40} y={120} w={130} h={36} label="Tech Stack" sublabel="/enrich" color={C.accentGreen} />
      <Node x={180} y={120} w={120} h={36} label="Organizations" sublabel="/organizations" color={C.accentGreen} />
      <Node x={40} y={170} w={130} h={36} label="Jobs" sublabel="/jobs" color={C.accentGreen} />
      <Node x={180} y={170} w={120} h={36} label="People" sublabel="/people" color={C.accentGreen} />

      {/* Sumble → Snowflake */}
      <Arrow x1={170} y1={220} x2={170} y2={260} label="persist" color={C.accentGreen + '80'} />
      <Node x={50} y={260} w={250} h={36} label="ACCOUNT_INTEL_SUMBLE" sublabel="Snowflake" color={C.accentBlue} />

      {/* Perplexity */}
      <GroupBox x={340} y={90} w={170} h={120} label="Perplexity API" color={C.accentRose} />
      <Node x={355} y={120} w={140} h={36} label="Sonar Pro" sublabel="Web research" color={C.accentRose} />
      <Node x={355} y={165} w={140} h={36} label="Citations" sublabel="Grounded sources" color={C.accentRose} />

      {/* Perplexity → Snowflake */}
      <Arrow x1={425} y1={210} x2={425} y2={260} label="persist" color={C.accentRose + '80'} />
      <Node x={330} y={260} w={200} h={36} label="ACCOUNT_INTEL_PERPLEXITY" sublabel="Snowflake" color={C.accentBlue} />

      {/* Filesets / KB */}
      <GroupBox x={540} y={90} w={260} h={120} label="Domo Filesets (KB)" color={C.accentAmber} />
      <Node x={555} y={120} w={230} h={36} label="Fileset Query" sublabel="/domo/files/v1/filesets/{id}/query" color={C.accentAmber} />
      <Node x={555} y={165} w={230} h={36} label="Cortex Summarize" sublabel="AI_COMPLETE → KB summary" color={C.accentCyan} />

      {/* KB → Snowflake */}
      <Arrow x1={670} y1={210} x2={670} y2={260} label="cache" color={C.accentAmber + '80'} />
      <Node x={555} y={260} w={230} h={36} label="CORTEX_ANALYSIS_RESULTS" sublabel="type: kb_summary" color={C.accentBlue} />

      {/* All merge to Intelligence Panel */}
      <Arrow x1={170} y1={296} x2={410} y2={350} color={C.nodeBorder + '60'} />
      <Arrow x1={425} y1={296} x2={410} y2={350} color={C.nodeBorder + '60'} />
      <Arrow x1={670} y1={296} x2={410} y2={350} color={C.nodeBorder + '60'} />
      <Node x={310} y={345} w={200} h={40} label="Intelligence Panel" sublabel="Rendered to SE in real-time" color={C.nodeBorder} />
    </svg>
  );
}

// ─── Layer 5: User Workflow ───────────────────────────────────────────────────

function UserWorkflow() {
  const steps = [
    { label: 'Deal Selection', sub: 'Command Center', x: 20, color: C.nodeBorder },
    { label: 'Open TDR', sub: 'Create Session', x: 140, color: C.nodeBorder },
    { label: 'SE Inputs', sub: '5 Required Steps', x: 260, color: C.accentAmber },
    { label: 'Enrichment', sub: 'Sumble + Perplexity', x: 380, color: C.accentGreen },
    { label: 'AI Analysis', sub: 'Brief + Extract', x: 500, color: C.accentCyan },
    { label: 'Action Plan', sub: 'Cortex Synthesis', x: 620, color: C.accentCyan },
    { label: 'Readout', sub: 'PDF + Slack', x: 740, color: C.accentRose },
  ];

  return (
    <svg viewBox="0 0 880 240" className="w-full h-auto">
      <SvgDefs />

      {/* Workflow steps */}
      {steps.map((s, i) => (
        <g key={i}>
          {/* Step node */}
          <rect x={s.x} y={40} width={110} height={55} rx={8} fill={C.nodeFill} stroke={s.color} strokeWidth={1.5} filter="url(#glow)" />
          <text x={s.x + 55} y={60} fontSize={10} fontWeight={600} fill={C.nodeText} textAnchor="middle">{s.label}</text>
          <text x={s.x + 55} y={76} fontSize={8} fill={C.nodeSubtext} textAnchor="middle">{s.sub}</text>
          {/* Step number */}
          <circle cx={s.x + 55} cy={25} r={10} fill={s.color} opacity={0.8} />
          <text x={s.x + 55} y={25} fontSize={9} fontWeight={700} fill="#fff" textAnchor="middle" dominantBaseline="central">{i + 1}</text>
          {/* Arrow to next */}
          {i < steps.length - 1 && (
            <Arrow x1={s.x + 110} y1={67} x2={steps[i + 1].x} y2={67} color={s.color + '60'} />
          )}
        </g>
      ))}

      {/* Parallel activities */}
      <GroupBox x={260} y={120} w={480} h={100} label="Parallel: Chat + KB Search + Optional Steps" color={C.groupBorder} />
      <Node x={280} y={148} w={130} h={36} label="TDR Chat" sublabel="3 providers" color={C.nodeBorder} />
      <Node x={425} y={148} w={130} h={36} label="KB Search" sublabel="Fileset + Cortex" color={C.accentAmber} />
      <Node x={570} y={148} w={150} h={36} label="Optional Steps" sublabel="4 deep-dive sections" color={C.nodeSubtext} />

      {/* Arrows up to main flow */}
      <Arrow x1={345} y1={148} x2={315} y2={95} color={C.groupBorder} dashed />
      <Arrow x1={490} y1={148} x2={555} y2={95} color={C.groupBorder} dashed />
    </svg>
  );
}

// ─── Layer definitions ────────────────────────────────────────────────────────

const LAYERS = [
  { id: 'overview', label: 'System Overview', component: SystemOverview },
  { id: 'datamodel', label: 'Data Model', component: DataModelDiagram },
  { id: 'cortex', label: 'Cortex AI', component: CortexModelMap },
  { id: 'enrichment', label: 'Enrichment', component: EnrichmentPipeline },
  { id: 'workflow', label: 'Workflow', component: UserWorkflow },
] as const;

// ─── Main export ──────────────────────────────────────────────────────────────

export function ArchitectureDiagram() {
  const [activeLayer, setActiveLayer] = useState<string>('overview');

  const ActiveComponent = LAYERS.find((l) => l.id === activeLayer)?.component ?? SystemOverview;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-200 leading-relaxed">
        Interactive architecture diagram showing 5 views of the system. Click a layer to explore
        how data flows through Snowflake, Cortex AI, enrichment providers, and the React frontend.
      </p>

      {/* Layer pill switcher */}
      <div className="flex flex-wrap gap-1.5">
        {LAYERS.map((layer) => (
          <button
            key={layer.id}
            onClick={() => setActiveLayer(layer.id)}
            className={cn(
              'rounded-full px-3 py-1.5 text-[11px] font-medium transition-all border',
              activeLayer === layer.id
                ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                : 'bg-transparent text-slate-300 border-white/[0.08] hover:text-white hover:border-white/[0.15]'
            )}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {/* Diagram viewport */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0f0b1a] p-4 overflow-x-auto">
        <ActiveComponent />
      </div>

      <p className="text-[11px] text-slate-400 italic">
        All nodes represent live components in the deployed system. Solid arrows = runtime data flow. Dashed arrows = optional/parallel paths.
      </p>
    </div>
  );
}

