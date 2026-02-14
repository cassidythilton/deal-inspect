/**
 * ArchitectureDiagram — Interactive 5-layer system architecture diagram.
 *
 * Each layer is a pure SVG React component with nodes, edges, and labels.
 * Styled to match the app's dark purple/violet design language.
 * Brand logos placed selectively on key nodes for quick recognition.
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

// ─── Inline SVG brand logos (for embedding inside <svg>) ──────────────────────

/** Snowflake logo as inline SVG paths. Transform + scale to fit. */
function SnowflakeMark({ x, y, size = 14, color = '#2CB3EA' }: { x: number; y: number; size?: number; color?: string }) {
  const s = size / 191;
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`}>
      <path d="M119.375 0C123.77 0 127.333 3.563 127.333 7.958V41.652L155.072 25.009C158.841 22.748 163.73 23.97 165.991 27.739C168.253 31.508 167.03 36.396 163.261 38.658L123.47 62.533C121.011 64.008 117.949 64.046 115.454 62.634C112.959 61.221 111.417 58.576 111.417 55.708V7.958C111.417 3.563 114.98 0 119.375 0Z" fill={color}/>
      <path d="M75.553 128.366C78.048 129.779 79.59 132.425 79.589 135.292L79.587 183.041C79.587 187.437 76.024 191 71.628 191C67.233 190.999 63.67 187.436 63.671 183.041L63.672 149.348L35.935 165.991C32.166 168.252 27.278 167.03 25.016 163.261C22.755 159.493 23.977 154.604 27.746 152.342L67.537 128.467C69.995 126.992 73.058 126.954 75.553 128.366Z" fill={color}/>
      <path d="M79.587 7.959C79.587 3.563 76.024 0 71.629 0C67.233 0 63.67 3.563 63.67 7.958L63.669 41.652L35.933 25.009C32.164 22.748 27.276 23.97 25.014 27.738C22.753 31.507 23.975 36.396 27.744 38.657L67.532 62.532C69.991 64.008 73.053 64.046 75.548 62.634C78.043 61.221 79.585 58.576 79.586 55.709L79.587 7.959Z" fill={color}/>
      <path d="M115.45 128.366C117.945 126.954 121.007 126.992 123.465 128.467L163.257 152.342C167.026 154.603 168.248 159.492 165.986 163.261C163.725 167.03 158.837 168.252 155.068 165.991L127.33 149.347V183.041C127.33 187.437 123.766 191 119.371 191C114.976 191 111.413 187.437 111.413 183.041V135.291C111.413 132.424 112.954 129.779 115.45 128.366Z" fill={color}/>
      <path d="M12.054 64.802C8.285 62.541 3.396 63.763 1.135 67.532C-1.126 71.301 0.096 76.19 3.865 78.451L32.298 95.51L3.868 112.551C0.098 114.81-1.126 119.698 1.134 123.468C3.393 127.238 8.281 128.463 12.051 126.202L51.864 102.339C54.262 100.901 55.73 98.311 55.731 95.514C55.731 92.719 54.264 90.127 51.866 88.688L12.054 64.802Z" fill={color}/>
      <path d="M189.872 67.534C192.132 71.304 190.908 76.192 187.139 78.452L158.71 95.497L187.136 112.565C190.904 114.827 192.125 119.716 189.862 123.484C187.6 127.253 182.711 128.474 178.943 126.211L139.145 102.315C136.749 100.876 135.283 98.285 135.284 95.489C135.285 92.694 136.752 90.104 139.15 88.667L178.954 64.801C182.724 62.541 187.612 63.765 189.872 67.534Z" fill={color}/>
      <path fillRule="evenodd" clipRule="evenodd" d="M101.129 73.956C98.021 70.848 92.982 70.848 89.874 73.956L73.958 89.872C70.85 92.981 70.85 98.019 73.958 101.128L89.874 117.044C92.982 120.152 98.021 120.152 101.129 117.044L117.046 101.128C120.154 98.019 120.154 92.981 117.046 89.872L101.129 73.956ZM90.84 95.5L95.502 90.838L100.164 95.5L95.502 100.162L90.84 95.5Z" fill={color}/>
    </g>
  );
}

/** Cortex logo as inline SVG paths */
function CortexMark({ x, y, size = 14, color = '#06b6d4' }: { x: number; y: number; size?: number; color?: string }) {
  const s = size / 176;
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`}>
      <path d="M23.21 116.031L80.08 28.211L152.29 75.061L126.5 147.081L23.21 116.031Z" stroke={color} strokeWidth="8" strokeMiterlimit="10" fill="none"/>
      <circle cx="80.08" cy="28.21" r="23.21" fill={color}/>
      <circle cx="152.29" cy="75.061" r="23.21" fill={color}/>
      <circle cx="126.5" cy="147.08" r="23.21" fill={color}/>
      <circle cx="23.21" cy="116.03" r="23.21" fill={color}/>
    </g>
  );
}

/** Sumble logo — double "b" mark */
function SumbleMark({ x, y, size = 14, color = '#22c55e' }: { x: number; y: number; size?: number; color?: string }) {
  const s = size / 512;
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`} opacity={0.9}>
      <path fill={color} d="M409.99,369.25c-41.4,27.85-96.67,14.75-121.32-28.07c-17.06-29.64-22.53-58.12-20.1-92.57 c2.12-30.19,13.86-58.47,34.68-80.28c32.49-34.02,82.25-35.14,115.34-2.8c21.19,20.71,35.12,47.69,39.84,76.98 c3.82,23.68,0.75,46.69-6.39,69.34C444.65,335.32,430.69,355.33,409.99,369.25Z"/>
      <path fill={color} d="M193.99,369.25c-41.4,27.86-96.67,14.75-121.32-28.07c-17.06-29.64-22.53-58.12-20.1-92.58 c2.12-30.19,13.85-58.47,34.68-80.28c32.5-34.02,82.27-35.14,115.34-2.8c21.38,20.91,35.39,48.2,39.97,77.79 c3.66,23.68,0.49,46.69-6.76,69.28s-21.34,42.88-41.8,56.65Z"/>
    </g>
  );
}

/** Perplexity logo — angular geometric mark */
function PerplexityMark({ x, y, size = 14, color = '#EDEDED' }: { x: number; y: number; size?: number; color?: string }) {
  const s = size / 316;
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`}>
      <path fillRule="evenodd" clipRule="evenodd" fill={color}
        d="M37.01,0l89.98,82.9v-0.02V0.19h17.52v83.08L234.89,0v94.52H272v136.34h-36.99v84.17l-90.5-79.51v80.42h-17.52 v-79.11L37.11,316v-85.13H0V94.52h37.01V0z M113.79,111.83H17.52v101.74h19.57v-32.09L113.79,111.83z M54.62,189.15v88.24 l72.36-63.74v-90.23L54.62,189.15z M145.01,212.81v-89.48l72.39,65.73v41.8h0.09v45.62L145.01,212.81z M235.01,213.56h19.48V111.83 h-95.55l76.07,68.93L235.01,213.56L235.01,213.56z M217.38,94.52V39.8l-59.4,54.73h59.4V94.52z M113.92,94.52h-59.4V39.8 L113.92,94.52z"
      />
    </g>
  );
}

/** Domo "D" lettermark */
function DomoMark({ x, y, size = 14, color = '#a78bfa' }: { x: number; y: number; size?: number; color?: string }) {
  const s = size / 24;
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`}>
      <path fill={color} d="M5 3h8c4.97 0 9 4.03 9 9s-4.03 9-9 9H5V3zm3 3v12h5c3.31 0 6-2.69 6-6s-2.69-6-6-6H8z"/>
    </g>
  );
}

/** Slack hash mark */
function SlackMark({ x, y, size = 14, color = '#E01E5A' }: { x: number; y: number; size?: number; color?: string }) {
  const s = size / 24;
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`}>
      <path fill={color} d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.527 2.527 0 0 1 2.521 2.521 2.527 2.527 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z"/>
    </g>
  );
}

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

      {/* Intelligence Layer — Domo Code Engine */}
      <GroupBox x={60} y={155} w={700} h={90} label="Intelligence Layer — Domo Code Engine (25 Functions)" color={C.accentAmber} />
      <DomoMark x={747} y={153} size={12} color={C.accentAmber} />
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

      {/* Persistence Layer — Snowflake */}
      <GroupBox x={60} y={290} w={250} h={165} label="Persistence — Snowflake" color={C.accentBlue} />
      <SnowflakeMark x={275} y={288} size={14} />
      <Node x={80} y={316} w={210} h={36} label="TDR_SESSIONS" sublabel="Session state" color={C.accentBlue} />
      <Node x={80} y={360} w={210} h={36} label="TDR_STEP_INPUTS" sublabel="SE inputs" color={C.accentBlue} />
      <Node x={80} y={404} w={210} h={36} label="CORTEX_ANALYSIS_RESULTS" sublabel="AI cache" color={C.accentBlue} />

      {/* Cortex AI */}
      <GroupBox x={330} y={290} w={190} h={165} label="Cortex AI" color={C.accentCyan} />
      <CortexMark x={494} y={288} size={14} />
      <Node x={345} y={316} w={160} h={30} label="AI_COMPLETE" color={C.accentCyan} />
      <Node x={345} y={352} w={160} h={30} label="AI_CLASSIFY" color={C.accentCyan} />
      <Node x={345} y={388} w={160} h={30} label="AI_EMBED" color={C.accentCyan} />
      <Node x={345} y={424} w={160} h={30} label="Cortex Analyst" color={C.accentCyan} />

      {/* External APIs */}
      <GroupBox x={540} y={290} w={220} h={165} label="External APIs" color={C.accentGreen} />
      <SumbleMark x={561} y={320} size={12} color={C.accentGreen} />
      <Node x={580} y={316} w={165} h={36} label="Sumble" sublabel="4 endpoints" color={C.accentGreen} />
      <PerplexityMark x={561} y={364} size={12} color="#EDEDED" />
      <Node x={580} y={360} w={165} h={36} label="Perplexity" sublabel="Sonar / Sonar Pro" color={C.accentGreen} />
      <SlackMark x={563} y={408} size={12} color={C.accentRose} />
      <Node x={580} y={404} w={165} h={36} label="Slack" sublabel="Distribution" color={C.accentRose} />
    </svg>
  );
}

// ─── Layer 2: Data Model ──────────────────────────────────────────────────────

function DataModelDiagram() {
  return (
    <svg viewBox="0 0 820 520" className="w-full h-auto">
      <SvgDefs />
      <GroupBox x={20} y={10} w={780} h={500} label="TDR_APP.TDR_DATA — Snowflake Schema" color={C.accentBlue} />
      <SnowflakeMark x={775} y={8} size={16} />

      {/* Core session */}
      <Node x={310} y={40} w={200} h={45} label="TDR_SESSIONS" sublabel="PK: SESSION_ID" color={C.accentBlue} />

      {/* FK children */}
      <Arrow x1={350} y1={85} x2={130} y2={130} label="1:N" />
      <Arrow x1={410} y1={85} x2={410} y2={130} label="1:N" />
      <Arrow x1={470} y1={85} x2={690} y2={130} label="1:N" />

      <Node x={40} y={130} w={190} h={45} label="TDR_STEP_INPUTS" sublabel="FK: SESSION_ID" color={C.nodeBorder} />
      <Node x={310} y={130} w={200} h={45} label="TDR_CHAT_MESSAGES" sublabel="FK: SESSION_ID" color={C.nodeBorder} />
      <Node x={590} y={130} w={200} h={45} label="CORTEX_ANALYSIS_RESULTS" sublabel="FK: SESSION_ID" color={C.accentCyan} />
      <CortexMark x={770} y={140} size={12} />

      {/* Intel tables (keyed by OPPORTUNITY_ID) */}
      <Arrow x1={350} y1={85} x2={130} y2={250} label="" color={C.accentGreen + '60'} />
      <Arrow x1={470} y1={85} x2={560} y2={250} label="" color={C.accentGreen + '60'} />

      <Node x={40} y={230} w={220} h={55} label="ACCOUNT_INTEL_SUMBLE" sublabel="FK: OPPORTUNITY_ID\nTech, Org, Jobs, People" color={C.accentGreen} />
      <SumbleMark x={240} y={240} size={12} color={C.accentGreen} />
      <Node x={460} y={230} w={220} h={55} label="ACCOUNT_INTEL_PERPLEXITY" sublabel="FK: OPPORTUNITY_ID\nKey Insights, Citations" color={C.accentGreen} />
      <PerplexityMark x={660} y={240} size={12} color="#EDEDED" />

      {/* Distribution / Readout */}
      <Arrow x1={410} y1={85} x2={410} y2={340} label="" color={C.accentRose + '60'} />
      <Node x={280} y={340} w={130} h={45} label="TDR_READOUTS" sublabel="FK: SESSION_ID" color={C.accentRose} />
      <Node x={430} y={340} w={150} h={45} label="TDR_DISTRIBUTIONS" sublabel="FK: SESSION_ID" color={C.accentRose} />
      <SlackMark x={562} y={351} size={12} color={C.accentRose} />
      <Arrow x1={410} y1={340} x2={505} y2={340} label="" color={C.accentRose + '60'} />

      {/* Usage log */}
      <Node x={40} y={340} w={180} h={45} label="API_USAGE_LOG" sublabel="Service, Tokens, Credits" color={C.accentAmber} />

      {/* Analytics view */}
      <GroupBox x={180} y={420} w={460} h={70} label="Views" color={C.accentCyan} />
      <Node x={200} y={444} w={420} h={36} label="V_TDR_ANALYTICS" sublabel="Flattened: Sessions + Inputs + Structured Extracts" color={C.accentCyan} />

      {/* Arrow from sessions to view */}
      <Arrow x1={410} y1={385} x2={410} y2={444} label="" color={C.accentCyan + '60'} dashed />
    </svg>
  );
}

// ─── Layer 3: Cortex AI Model Map ─────────────────────────────────────────────

function CortexModelMap() {
  const models: { name: string; y: number; color: string; provider: string; features: string[] }[] = [
    { name: 'claude-4-sonnet', y: 40, color: C.nodeBorder, provider: 'cortex', features: ['TDR Brief', 'Action Plan', 'Chat (default)', 'NLQ to SQL', 'Structured Extract', 'Portfolio Insights'] },
    { name: 'claude-4-opus', y: 100, color: C.nodeBorder, provider: 'cortex', features: ['Chat (deep reasoning)', 'Complex analysis'] },
    { name: 'gpt-4.1 / o4-mini', y: 155, color: C.accentAmber, provider: 'cortex', features: ['Chat (alternatives)', 'General reasoning'] },
    { name: 'llama3.1-8b', y: 210, color: C.accentGreen, provider: 'cortex', features: ['AI_CLASSIFY', 'AI_EXTRACT', 'AI_SENTIMENT'] },
    { name: 'llama3.1-70b', y: 265, color: C.accentCyan, provider: 'cortex', features: ['AI_SUMMARIZE_AGG', 'AI_AGG'] },
    { name: 'arctic-embed-l-v2.0', y: 320, color: C.accentBlue, provider: 'cortex', features: ['AI_EMBED', 'Similar Deals'] },
    { name: 'sonar / sonar-pro', y: 380, color: C.accentRose, provider: 'perplexity', features: ['Research enrichment', 'Chat (cited answers)'] },
  ];

  return (
    <svg viewBox="0 0 820 440" className="w-full h-auto">
      <SvgDefs />
      {/* Provider labels at the top */}
      <CortexMark x={6} y={8} size={16} />
      <text x={26} y={18} fontSize={10} fontWeight={600} fill={C.accentCyan}>Snowflake Cortex</text>
      <SnowflakeMark x={130} y={6} size={16} />

      {models.map((m) => (
        <g key={m.name}>
          <Node x={40} y={m.y} w={180} h={42} label={m.name} color={m.color} />
          {/* Brand mark next to model node */}
          {m.provider === 'cortex' && <CortexMark x={16} y={m.y + 14} size={12} color={m.color} />}
          {m.provider === 'perplexity' && <PerplexityMark x={16} y={m.y + 14} size={12} color="#EDEDED" />}
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
      <SumbleMark x={290} y={88} size={14} color={C.accentGreen} />
      <Node x={40} y={120} w={130} h={36} label="Tech Stack" sublabel="/enrich" color={C.accentGreen} />
      <Node x={180} y={120} w={120} h={36} label="Organizations" sublabel="/organizations" color={C.accentGreen} />
      <Node x={40} y={170} w={130} h={36} label="Jobs" sublabel="/jobs" color={C.accentGreen} />
      <Node x={180} y={170} w={120} h={36} label="People" sublabel="/people" color={C.accentGreen} />

      {/* Sumble → Snowflake */}
      <Arrow x1={170} y1={220} x2={170} y2={260} label="persist" color={C.accentGreen + '80'} />
      <Node x={50} y={260} w={250} h={36} label="ACCOUNT_INTEL_SUMBLE" sublabel="Snowflake" color={C.accentBlue} />
      <SnowflakeMark x={282} y={266} size={12} />

      {/* Perplexity */}
      <GroupBox x={340} y={90} w={170} h={120} label="Perplexity API" color={C.accentRose} />
      <PerplexityMark x={480} y={88} size={14} color="#EDEDED" />
      <Node x={355} y={120} w={140} h={36} label="Sonar Pro" sublabel="Web research" color={C.accentRose} />
      <Node x={355} y={165} w={140} h={36} label="Citations" sublabel="Grounded sources" color={C.accentRose} />

      {/* Perplexity → Snowflake */}
      <Arrow x1={425} y1={210} x2={425} y2={260} label="persist" color={C.accentRose + '80'} />
      <Node x={330} y={260} w={200} h={36} label="ACCOUNT_INTEL_PERPLEXITY" sublabel="Snowflake" color={C.accentBlue} />
      <SnowflakeMark x={512} y={266} size={12} />

      {/* Filesets / KB */}
      <GroupBox x={540} y={90} w={260} h={120} label="Domo Filesets (KB)" color={C.accentAmber} />
      <DomoMark x={772} y={88} size={14} color={C.accentAmber} />
      <Node x={555} y={120} w={230} h={36} label="Fileset Query" sublabel="/domo/files/v1/filesets/{id}/query" color={C.accentAmber} />
      <Node x={555} y={165} w={230} h={36} label="Cortex Summarize" sublabel="AI_COMPLETE" color={C.accentCyan} />
      <CortexMark x={769} y={170} size={12} />

      {/* KB → Snowflake */}
      <Arrow x1={670} y1={210} x2={670} y2={260} label="cache" color={C.accentAmber + '80'} />
      <Node x={555} y={260} w={230} h={36} label="CORTEX_ANALYSIS_RESULTS" sublabel="type: kb_summary" color={C.accentBlue} />
      <SnowflakeMark x={767} y={266} size={12} />

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

      {/* Brand logos on relevant workflow steps */}
      <SnowflakeMark x={148} y={82} size={10} />
      <SumbleMark x={389} y={82} size={10} color={C.accentGreen} />
      <PerplexityMark x={412} y={82} size={10} color="#EDEDED" />
      <CortexMark x={626} y={82} size={10} />
      <SlackMark x={752} y={82} size={10} color={C.accentRose} />

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
