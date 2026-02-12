/**
 * CortexBranding — Sprint 22: Snowflake & Cortex brand assets
 *
 * Inline SVG components for Snowflake and Cortex logos so any
 * Snowflake professional immediately recognises the platform.
 * Blue variants for active/accent use, gray for muted/disabled.
 */

import React from 'react';

// ─── Snowflake Logo (blue #2CB3EA) ───────────────────────────────────────────

export function SnowflakeLogo({ className = 'h-4 w-4', color }: { className?: string; color?: string }) {
  const fill = color || '#2CB3EA';
  return (
    <svg className={className} viewBox="0 0 191 191" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M119.375 0C123.77 0 127.333 3.563 127.333 7.958V41.652L155.072 25.009C158.841 22.748 163.73 23.97 165.991 27.739C168.253 31.508 167.03 36.396 163.261 38.658L123.47 62.533C121.011 64.008 117.949 64.046 115.454 62.634C112.959 61.221 111.417 58.576 111.417 55.708V7.958C111.417 3.563 114.98 0 119.375 0Z" fill={fill}/>
      <path d="M75.553 128.366C78.048 129.779 79.59 132.425 79.589 135.292L79.587 183.041C79.587 187.437 76.024 191 71.628 191C67.233 190.999 63.67 187.436 63.671 183.041L63.672 149.348L35.935 165.991C32.166 168.252 27.278 167.03 25.016 163.261C22.755 159.493 23.977 154.604 27.746 152.342L67.537 128.467C69.995 126.992 73.058 126.954 75.553 128.366Z" fill={fill}/>
      <path d="M79.587 7.959C79.587 3.563 76.024 0 71.629 0C67.233 0 63.67 3.563 63.67 7.958L63.669 41.652L35.933 25.009C32.164 22.748 27.276 23.97 25.014 27.738C22.753 31.507 23.975 36.396 27.744 38.657L67.532 62.532C69.991 64.008 73.053 64.046 75.548 62.634C78.043 61.221 79.585 58.576 79.586 55.709L79.587 7.959Z" fill={fill}/>
      <path d="M115.45 128.366C117.945 126.954 121.007 126.992 123.465 128.467L163.257 152.342C167.026 154.603 168.248 159.492 165.986 163.261C163.725 167.03 158.837 168.252 155.068 165.991L127.33 149.347V183.041C127.33 187.437 123.766 191 119.371 191C114.976 191 111.413 187.437 111.413 183.041V135.291C111.413 132.424 112.954 129.779 115.45 128.366Z" fill={fill}/>
      <path d="M12.054 64.802C8.285 62.541 3.396 63.763 1.135 67.532C-1.126 71.301 0.096 76.19 3.865 78.451L32.298 95.51L3.868 112.551C0.098 114.81-1.126 119.698 1.134 123.468C3.393 127.238 8.281 128.463 12.051 126.202L51.864 102.339C54.262 100.901 55.73 98.311 55.731 95.514C55.731 92.719 54.264 90.127 51.866 88.688L12.054 64.802Z" fill={fill}/>
      <path d="M189.872 67.534C192.132 71.304 190.908 76.192 187.139 78.452L158.71 95.497L187.136 112.565C190.904 114.827 192.125 119.716 189.862 123.484C187.6 127.253 182.711 128.474 178.943 126.211L139.145 102.315C136.749 100.876 135.283 98.285 135.284 95.489C135.285 92.694 136.752 90.104 139.15 88.667L178.954 64.801C182.724 62.541 187.612 63.765 189.872 67.534Z" fill={fill}/>
      <path fillRule="evenodd" clipRule="evenodd" d="M101.129 73.956C98.021 70.848 92.982 70.848 89.874 73.956L73.958 89.872C70.85 92.981 70.85 98.019 73.958 101.128L89.874 117.044C92.982 120.152 98.021 120.152 101.129 117.044L117.046 101.128C120.154 98.019 120.154 92.981 117.046 89.872L101.129 73.956ZM90.84 95.5L95.502 90.838L100.164 95.5L95.502 100.162L90.84 95.5Z" fill={fill}/>
    </svg>
  );
}

// ─── Snowflake Logo (gray) ──────────────────────────────────────────────────

export function SnowflakeLogoGray({ className = 'h-4 w-4' }: { className?: string }) {
  return <SnowflakeLogo className={className} color="#6C6C6C" />;
}

// ─── Cortex Logo (blue #2CB3EA) ─────────────────────────────────────────────

export function CortexLogo({ className = 'h-4 w-4', color }: { className?: string; color?: string }) {
  const stroke = color || '#2CB3EA';
  const fill = color || '#2CB3EA';
  return (
    <svg className={className} viewBox="0 0 176 171" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.21 116.031L80.08 28.211L152.29 75.061L126.5 147.081L23.21 116.031Z" stroke={stroke} strokeWidth="8" strokeMiterlimit="10"/>
      <path d="M80.08 51.42C92.899 51.42 103.29 41.029 103.29 28.21C103.29 15.392 92.899 5 80.08 5C67.262 5 56.87 15.392 56.87 28.21C56.87 41.029 67.262 51.42 80.08 51.42Z" fill="currentColor" stroke={stroke} strokeWidth="10" strokeMiterlimit="10" className="fill-[#1B1630]"/>
      <circle cx="152.29" cy="75.061" r="23.21" fill={fill}/>
      <circle cx="126.5" cy="147.08" r="23.21" fill={fill}/>
      <circle cx="23.21" cy="116.03" r="23.21" fill={fill}/>
    </svg>
  );
}

// ─── Cortex Logo (gray) ────────────────────────────────────────────────────

export function CortexLogoGray({ className = 'h-4 w-4' }: { className?: string }) {
  return <CortexLogo className={className} color="#6C6C6C" />;
}

// ─── Combo Badge: "Powered by Snowflake Cortex" ─────────────────────────────

export function PoweredByCortexBadge({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center justify-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
        <SnowflakeLogo className="h-3.5 w-3.5" />
        <CortexLogo className="h-3.5 w-3.5" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-[#0d2a3a]/60 border border-cyan-500/15 px-2.5 py-1.5 transition-all hover:border-cyan-500/30 hover:bg-[#0d2a3a]/80">
      <SnowflakeLogo className="h-3.5 w-3.5 shrink-0" />
      <div className="flex flex-col leading-none">
        <span className="text-[9px] font-medium text-cyan-400/80 tracking-wide">POWERED BY</span>
        <span className="text-[10px] font-semibold text-cyan-300/90 tracking-tight">Snowflake Cortex</span>
      </div>
      <CortexLogo className="h-3.5 w-3.5 shrink-0" />
    </div>
  );
}

// ─── Inline Cortex pill (for section headers) ───────────────────────────────

export function CortexPill({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/15 px-1.5 py-0.5 text-[9px] font-medium text-cyan-400 ${className}`}>
      <CortexLogo className="h-2.5 w-2.5" />
      {label || 'Cortex AI'}
    </span>
  );
}

// ─── Inline Snowflake pill (for section headers) ─────────────────────────────

export function SnowflakePill({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/15 px-1.5 py-0.5 text-[9px] font-medium text-cyan-400 ${className}`}>
      <SnowflakeLogo className="h-2.5 w-2.5" />
      {label || 'Snowflake'}
    </span>
  );
}

// ─── Cortex Loading Spinner ─────────────────────────────────────────────────

export function CortexSpinner({ text = 'Cortex AI processing…', className = '' }: { text?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-cyan-400 ${className}`}>
      <CortexLogo className="h-3.5 w-3.5 animate-pulse" />
      <span className="text-2xs">{text}</span>
    </div>
  );
}

