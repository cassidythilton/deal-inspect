/**
 * TDRReadoutDocument — React-PDF document for the executive TDR readout.
 *
 * Uses @react-pdf/renderer to generate a polished, branded PDF
 * that captures the entire TDR lifecycle as the canonical artifact of record.
 *
 * Sprint 13: TDR Readout PDF Engine
 * Sprint 15: PDF Cleanup — dedup, humanize labels, branding, action plan section
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Svg,
  Path,
  Circle,
} from '@react-pdf/renderer';
import type { ReadoutPayload, ReadoutTheme } from './readoutTypes';
import { DEFAULT_THEME } from './readoutTypes';

// ─── Font Configuration ──────────────────────────────────────────────────────
// Use built-in Helvetica font family — no network download, no woff2 subsetting,
// no DataView overflow. Helvetica is embedded in every PDF reader and looks clean.

Font.registerHyphenationCallback((word) => [word]); // Disable hyphenation to avoid glyph issues

const PDF_FONT = 'Helvetica';

// ─── Humanization Maps ──────────────────────────────────────────────────────
// Convert raw step/field IDs from Snowflake into professional display labels.

const STEP_LABELS: Record<string, string> = {
  'context': 'Deal Context & Stakes',
  'decision': 'Business Decision',
  'current-arch': 'Architecture',
  'domo-role': "Domo's Composable Role",
  'risk': 'Risk & Verdict',
  'target-arch': 'Target Architecture Detail',
  'partner': 'Partner & AI Implications',
  'ai-strategy': 'AI Strategy & Data Science',
  'usage': 'Usage & Adoption',
  'thesis': 'Domo Thesis',
};

const FIELD_LABELS: Record<string, string> = {
  // Context
  'strategic-value': 'Strategic Value',
  'why-now': 'Why This Deal Matters Now',
  'key-stakeholders': 'Key Stakeholders',
  // Decision
  'customer-goal': 'Customer Decision',
  'success-criteria': 'Success Criteria',
  'timeline': 'Decision Timeline',
  // Architecture
  'system-of-record': 'System of Record',
  'cloud-platform': 'Cloud / Data Platform',
  'arch-truth': 'Architectural Truth',
  'target-change': 'What Changes in Target State',
  'pain-points': 'Pain Points',
  // Domo Role
  'entry-layer': 'Entry Layer',
  'in-scope': 'In-Scope Layers',
  'out-of-scope': 'Out of Scope',
  'why-composition': 'Why This Composition Works Now',
  // Risk
  'top-risks': 'Top Technical Risks',
  'key-assumption': 'Key Assumption',
  'verdict': 'Verdict',
  // Target Arch Detail
  'proposed-solution': 'Proposed Solution Detail',
  'integration-points': 'Integration Points',
  'data-flow': 'Data Flow',
  // Partner
  'partner-name': 'Key Partner',
  'partner-posture': 'Partner Posture',
  'compute-alignment': 'Where Does Compute Execute?',
  // AI Strategy
  'ai-reality': 'AI Reality Check',
  'autonomous-decision': 'Autonomous Decision Potential',
  // Usage
  'user-count': 'Expected Users',
  'adoption-plan': 'Adoption Plan',
  'success-metrics': 'Success Metrics',
  // Thesis
  'domo-thesis': 'Why Domo Belongs',
};

function humanizeStepId(stepId: string): string {
  return STEP_LABELS[stepId] || stepId
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function humanizeFieldId(fieldId: string): string {
  return FIELD_LABELS[fieldId] || fieldId
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Step ordering for consistent PDF output
const STEP_ORDER = [
  'context', 'decision', 'current-arch', 'domo-role', 'risk',
  'thesis', 'target-arch', 'partner', 'ai-strategy', 'usage',
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (theme: ReadoutTheme) =>
  StyleSheet.create({
    page: {
      fontFamily: PDF_FONT,
      fontSize: 10,
      color: '#433650',
      paddingTop: 60,
      paddingBottom: 50,
      paddingHorizontal: 44,
    },
    // Cover page
    coverPage: {
      fontFamily: PDF_FONT,
      backgroundColor: theme.secondaryColor,
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: 60,
    },
    coverAppName: {
      fontSize: 9,
      fontWeight: 700,
      color: '#94a3b8',
      letterSpacing: 3,
      textTransform: 'uppercase',
      marginBottom: 28,
    },
    coverLabel: {
      fontSize: 11,
      fontWeight: 600,
      color: '#9CB8E3',             // Domo blue — matches Domo brand
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    coverTitle: {
      fontSize: 32,
      fontWeight: 700,
      color: '#ffffff',
      marginBottom: 6,
    },
    coverSubtitle: {
      fontSize: 16,
      fontWeight: 400,
      color: '#94a3b8',
      marginBottom: 40,
    },
    coverMeta: {
      flexDirection: 'row',
      gap: 30,
      marginTop: 20,
    },
    coverMetaItem: {
      fontSize: 9,
      color: '#94a3b8',
    },
    coverMetaValue: {
      fontSize: 12,
      fontWeight: 600,
      color: '#ffffff',
      marginTop: 3,
    },
    coverConfidential: {
      position: 'absolute',
      bottom: 40,
      left: 60,
      right: 60,
      fontSize: 8,
      color: '#475569',
      textAlign: 'center',
      borderTopWidth: 1,
      borderTopColor: '#334155',
      paddingTop: 10,
    },
    coverPoweredBy: {
      position: 'absolute',
      bottom: 62,
      left: 60,
      right: 60,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    poweredByText: {
      fontSize: 7,
      color: '#64748b',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    poweredByBrand: {
      fontSize: 8,
      fontWeight: 600,
      color: '#94a3b8',
    },
    // Header/Footer
    header: {
      position: 'absolute',
      top: 20,
      left: 44,
      right: 44,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: 7,
      color: '#94a3b8',
      borderBottomWidth: 0.5,
      borderBottomColor: '#e2e8f0',
      paddingBottom: 6,
    },
    headerBrand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    footer: {
      position: 'absolute',
      bottom: 20,
      left: 44,
      right: 44,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 7,
      color: '#94a3b8',
      borderTopWidth: 0.5,
      borderTopColor: '#e2e8f0',
      paddingTop: 6,
    },
    // Sections
    sectionTitle: {
      fontSize: 14,
      fontWeight: 700,
      color: theme.primaryColor,
      marginBottom: 10,
      paddingBottom: 4,
      borderBottomWidth: 2,
      borderBottomColor: theme.primaryColor,
    },
    sectionSubtitle: {
      fontSize: 11,
      fontWeight: 600,
      color: '#334155',
      marginBottom: 6,
      marginTop: 10,
    },
    stepHeader: {
      fontSize: 11,
      fontWeight: 700,
      color: '#1e293b',
      marginBottom: 6,
      paddingBottom: 3,
      paddingLeft: 8,
      borderLeftWidth: 3,
      borderLeftColor: theme.primaryColor,
    },
    fieldLabel: {
      fontSize: 8,
      fontWeight: 700,
      color: '#6929C4',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    fieldValue: {
      fontSize: 10,
      lineHeight: 1.5,
      color: '#374151',
      marginBottom: 8,
    },
    bodyText: {
      fontSize: 10,
      lineHeight: 1.5,
      color: '#374151',
      marginBottom: 6,
    },
    smallText: {
      fontSize: 8,
      color: '#6b7280',
      marginBottom: 4,
    },
    // Numbered section headers within executive summary
    numberedHeader: {
      fontSize: 11,
      fontWeight: 700,
      color: '#1e293b',
      marginTop: 10,
      marginBottom: 4,
    },
    // Tables
    table: {
      marginVertical: 8,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: '#f1f5f9',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: '#e2e8f0',
    },
    tableHeaderCell: {
      fontSize: 8,
      fontWeight: 600,
      color: '#475569',
      textTransform: 'uppercase',
      padding: 6,
      flex: 1,
    },
    tableCell: {
      fontSize: 9,
      color: '#374151',
      padding: 6,
      flex: 1,
    },
    // Tags (default — used for non-categorized tags)
    tag: {
      fontSize: 8,
      color: '#475569',
      backgroundColor: '#f1f5f9',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 3,
      marginRight: 4,
      marginBottom: 4,
    },
    tagRow: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      marginVertical: 4,
    },
    // Cards
    card: {
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 4,
      padding: 10,
      marginBottom: 8,
    },
    // Lists
    listItem: {
      flexDirection: 'row',
      marginBottom: 3,
    },
    bullet: {
      width: 8,
      fontSize: 10,
      color: theme.primaryColor,
    },
    listText: {
      fontSize: 10,
      lineHeight: 1.5,
      color: '#374151',
      flex: 1,
    },
    // Score
    scoreBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: 8,
    },
    scoreBadge: {
      fontSize: 20,
      fontWeight: 700,
      color: '#ffffff',
      backgroundColor: theme.primaryColor,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 6,
    },
    emptySection: {
      fontSize: 9,
      color: '#9ca3af',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: '#fafafa',
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#f0f0f0',
    },
    // Divider
    sectionDivider: {
      borderBottomWidth: 0.5,
      borderBottomColor: '#e2e8f0',
      marginVertical: 16,
    },
    // AI attribution badge
    aiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#f0f9ff',
      borderWidth: 1,
      borderColor: '#bae6fd',
      borderRadius: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginTop: 4,
    },
    aiBadgeText: {
      fontSize: 7,
      color: '#0284c7',
      fontWeight: 600,
    },
  });

// ─── Helper: Text sanitizer for PDF-safe rendering ──────────────────────────
// Normalizes Unicode characters to ASCII equivalents to prevent font subsetting
// crashes (DataView RangeError) when glyphs aren't in the built-in font table.

function sanitize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")   // smart single quotes -> '
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')    // smart double quotes -> "
    .replace(/\u2026/g, '...')                        // ellipsis
    .replace(/\u2013/g, '-')                          // en dash
    .replace(/\u2014/g, '--')                         // em dash
    .replace(/\u2192/g, '->')                         // right arrow
    .replace(/\u2190/g, '<-')                         // left arrow
    .replace(/\u2022/g, '-')                          // bullet (we render our own)
    .replace(/\u00BD/g, '1/2')                        // fraction half
    .replace(/\u00B0/g, ' deg')                       // degree
    .replace(/\u2122/g, '(TM)')                       // trademark
    .replace(/\u00A9/g, '(c)')                        // copyright
    .replace(/\u00AE/g, '(R)')                        // registered
    .replace(/\u00B7/g, '-')                          // middle dot
    .replace(/\u2212/g, '-')                          // minus sign
    .replace(/\u00D7/g, 'x')                          // multiplication sign
    .replace(/[^\x20-\x7E\n\r\t]/g, '');             // strip any remaining non-ASCII
}

// ─── Helper: Format date ────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

/** Safely convert any value to a renderable, sanitized string */
function safeString(val: unknown): string {
  if (val === null || val === undefined) return '--';
  if (typeof val === 'string') return sanitize(val);
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(safeString).join(', ');
  if (typeof val === 'object') {
    try { return sanitize(JSON.stringify(val)); } catch { return '[object]'; }
  }
  return String(val);
}

/** Shorthand: sanitize a string for direct use in <Text> */
const s = (text: string) => sanitize(text);

/** Check if a value is a flat array of strings (safe for tag rendering) */
function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every(item => typeof item === 'string');
}

// ─── Helper: Normalize AI-generated content ────────────────────────────────
// Cortex and other LLMs often return content with literal \n escapes,
// wrapping quotes, and markdown artifacts. Clean it all up.

function normalizeContent(text: string): string {
  let out = text;
  // Strip wrapping double-quotes (JSON string artifacts)
  if (out.startsWith('"') && out.endsWith('"')) {
    out = out.slice(1, -1);
  }
  // Convert literal \n to actual newlines (JSON-escaped newlines from Snowflake)
  out = out.replace(/\\n/g, '\n');
  // Convert literal \t to spaces
  out = out.replace(/\\t/g, '  ');
  // Strip escaped quotes
  out = out.replace(/\\"/g, '"');
  return out.trim();
}

// ─── Helper: Group inputs by step (with frontend dedup) ─────────────────────
// Deduplicates inputs: for each (stepId, fieldId) pair, keeps only the latest
// entry (by savedAt). This acts as a safety net — the backend SQL also deduplicates,
// but this ensures clean rendering even if the CE hasn't been redeployed yet.

function groupInputsByStep(inputs: ReadoutPayload['inputs']): Map<string, { fieldId: string; value: string }[]> {
  // 1. Dedup: keep only latest entry per (stepId, fieldId)
  const latest = new Map<string, ReadoutPayload['inputs'][0]>();
  for (const input of inputs) {
    const key = `${input.stepId}::${input.fieldId}`;
    const existing = latest.get(key);
    if (!existing || (input.savedAt && existing.savedAt && input.savedAt > existing.savedAt)) {
      latest.set(key, input);
    }
  }
  const deduped = Array.from(latest.values());

  // 2. Group by step
  const map = new Map<string, { fieldId: string; value: string }[]>();
  for (const input of deduped) {
    if (!input.value || !input.value.trim()) continue; // Skip empty values
    if (!map.has(input.stepId)) map.set(input.stepId, []);
    map.get(input.stepId)!.push({ fieldId: input.fieldId, value: input.value });
  }

  // 3. Sort by STEP_ORDER
  const sorted = new Map<string, { fieldId: string; value: string }[]>();
  for (const stepId of STEP_ORDER) {
    if (map.has(stepId)) sorted.set(stepId, map.get(stepId)!);
  }
  // Append any steps not in STEP_ORDER
  for (const [stepId, fields] of map.entries()) {
    if (!sorted.has(stepId)) sorted.set(stepId, fields);
  }
  return sorted;
}

// ─── Helper: render multiline text with markdown-like parsing ───────────────

function MultilineText({ text, styles }: { text: string; styles: ReturnType<typeof createStyles> }) {
  const sanitized = sanitize(text);
  const paragraphs = sanitized.split('\n\n').filter(Boolean);
  return (
    <>
      {paragraphs.map((para, i) => {
        const trimPara = para.trim();

        // Markdown heading: ## Title or ### Title (strip # chars)
        const mdHeadingMatch = trimPara.match(/^#{1,4}\s+(.+?)(?:\n(.*))?$/s);
        if (mdHeadingMatch) {
          const title = mdHeadingMatch[1].replace(/\*\*/g, '').trim();
          const body = mdHeadingMatch[2]?.trim();
          return (
            <View key={i}>
              <Text style={styles.sectionSubtitle}>{title}</Text>
              {body && <MultilineBody text={body} styles={styles} />}
            </View>
          );
        }

        // Bold numbered header: **1. Title** or **N. Title** followed by content
        const boldNumberedMatch = trimPara.match(/^\*\*(\d+)\.\s+(.+?)\*\*(.*)$/s);
        if (boldNumberedMatch) {
          const title = boldNumberedMatch[2].trim();
          const body = boldNumberedMatch[3]?.trim();
          return (
            <View key={i}>
              <Text style={styles.numberedHeader}>{boldNumberedMatch[1]}. {title}</Text>
              {body && <MultilineBody text={body} styles={styles} />}
            </View>
          );
        }

        // Numbered section header: "1. Title" (plain or with markdown)
        const numberedMatch = trimPara.match(/^(\d+)\.\s+(.+?)(?:\n(.*))?$/s);
        if (numberedMatch) {
          const title = numberedMatch[2].replace(/\*\*/g, '').trim();
          const body = numberedMatch[3]?.trim();
          return (
            <View key={i}>
              <Text style={styles.numberedHeader}>{numberedMatch[1]}. {title}</Text>
              {body && <MultilineBody text={body} styles={styles} />}
            </View>
          );
        }

        // Bold header detection: **Title** content
        const boldMatch = trimPara.match(/^\*\*(.*?)\*\*(.*)$/s);
        if (boldMatch) {
          return (
            <View key={i}>
              <Text style={styles.sectionSubtitle}>{boldMatch[1]}</Text>
              {boldMatch[2].trim() && <MultilineBody text={boldMatch[2].trim()} styles={styles} />}
            </View>
          );
        }

        // Paragraph with embedded bullet list
        if (trimPara.includes('\n- ') || trimPara.includes('\n* ')) {
          return <MultilineBody key={i} text={trimPara} styles={styles} />;
        }

        return <Text key={i} style={styles.bodyText}>{trimPara.replace(/\*\*/g, '')}</Text>;
      })}
    </>
  );
}

/** Render a body block that may contain inline bullet lists and numbered sub-items */
function MultilineBody({ text, styles }: { text: string; styles: ReturnType<typeof createStyles> }) {
  const lines = text.split('\n');
  return (
    <View>
      {lines.map((line, j) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // Bullet list item: "- text" or "* text"
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.slice(2).replace(/\*\*/g, '');
          return (
            <View key={j} style={styles.listItem}>
              <Text style={styles.bullet}>-</Text>
              <Text style={styles.listText}>{content}</Text>
            </View>
          );
        }

        // Numbered sub-item: "1. text", "2. text"
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          const content = numMatch[2].replace(/\*\*/g, '');
          return (
            <View key={j} style={styles.listItem}>
              <Text style={[styles.bullet, { width: 14 }]}>{numMatch[1]}.</Text>
              <Text style={styles.listText}>{content}</Text>
            </View>
          );
        }

        // Plain body text — strip bold markers
        return <Text key={j} style={styles.bodyText}>{trimmed.replace(/\*\*/g, '')}</Text>;
      })}
    </View>
  );
}

// ─── SVG Logos for PDF (react-pdf Svg components) ────────────────────────────
// Derived from the official brand SVG files for accurate representation.

/** Official Snowflake crystal logo (from snowflake 2.svg, viewBox 191x191) */
function SnowflakeLogo({ size = 16, color = '#2CB3EA' }: { size?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 191 191" width={size} height={size}>
      <Path d="M119.375 0C123.77 0 127.333 3.563 127.333 7.958V41.652L155.072 25.009C158.841 22.748 163.73 23.97 165.991 27.739C168.253 31.508 167.03 36.396 163.261 38.658L123.47 62.533C121.011 64.008 117.949 64.046 115.454 62.634C112.959 61.221 111.417 58.576 111.417 55.708V7.958C111.417 3.563 114.98 0 119.375 0Z" fill={color} />
      <Path d="M75.553 128.366C78.048 129.779 79.59 132.425 79.589 135.292L79.587 183.041C79.587 187.437 76.024 191 71.628 191C67.233 191 63.67 187.436 63.671 183.041L63.672 149.348L35.935 165.991C32.166 168.252 27.278 167.03 25.016 163.261C22.755 159.493 23.977 154.604 27.746 152.342L67.537 128.467C69.995 126.992 73.058 126.954 75.553 128.366Z" fill={color} />
      <Path d="M79.587 7.959C79.587 3.563 76.024 0 71.629 0C67.233 0 63.67 3.563 63.67 7.958L63.669 41.652L35.933 25.009C32.164 22.748 27.276 23.97 25.014 27.738C22.753 31.507 23.975 36.396 27.744 38.657L67.532 62.532C69.991 64.008 73.053 64.046 75.548 62.634C78.043 61.221 79.585 58.576 79.586 55.709L79.587 7.959Z" fill={color} />
      <Path d="M115.45 128.366C117.945 126.954 121.007 126.992 123.465 128.467L163.257 152.342C167.026 154.603 168.248 159.492 165.986 163.261C163.725 167.03 158.837 168.252 155.068 165.991L127.33 149.347V183.041C127.33 187.437 123.766 191 119.371 191C114.976 191 111.413 187.437 111.413 183.041V135.291C111.413 132.424 112.954 129.779 115.45 128.366Z" fill={color} />
      <Path d="M12.054 64.802C8.285 62.541 3.396 63.763 1.135 67.532C-1.126 71.301 0.096 76.19 3.865 78.451L32.298 95.51L3.868 112.551C0.098 114.81 -1.126 119.698 1.134 123.468C3.393 127.238 8.281 128.463 12.051 126.202L51.864 102.339C54.262 100.901 55.73 98.311 55.731 95.514C55.731 92.719 54.264 90.127 51.866 88.688L12.054 64.802Z" fill={color} />
      <Path d="M189.872 67.534C192.132 71.304 190.908 76.192 187.139 78.452L158.71 95.497L187.136 112.565C190.904 114.827 192.125 119.716 189.862 123.484C187.6 127.253 182.711 128.474 178.943 126.211L139.145 102.315C136.749 100.876 135.283 98.285 135.284 95.489C135.285 92.694 136.752 90.104 139.15 88.667L178.954 64.801C182.724 62.541 187.612 63.765 189.872 67.534Z" fill={color} />
      <Path fillRule="evenodd" d="M101.129 73.956C98.021 70.848 92.982 70.848 89.874 73.956L73.958 89.872C70.85 92.981 70.85 98.019 73.958 101.128L89.874 117.044C92.982 120.152 98.021 120.152 101.129 117.044L117.046 101.128C120.154 98.019 120.154 92.981 117.046 89.872L101.129 73.956ZM90.84 95.5L95.502 90.838L100.164 95.5L95.502 100.162L90.84 95.5Z" fill={color} />
    </Svg>
  );
}

/** Official Cortex logo — pentagon with node circles (from cortex_logo.svg, viewBox 176x171) */
function CortexLogo({ size = 16, color = '#2CB3EA' }: { size?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 176 171" width={size} height={size * (171 / 176)}>
      {/* Pentagon wireframe */}
      <Path d="M23.21 116.031L80.08 28.211L152.29 75.061L126.5 147.081L23.21 116.031Z" stroke={color} strokeWidth={8} fill="none" />
      {/* Top node (open circle) */}
      <Circle cx={80.08} cy={28.21} r={23.21} fill="#ffffff" stroke={color} strokeWidth={10} />
      {/* Right node */}
      <Circle cx={152.29} cy={75.06} r={23.21} fill={color} />
      {/* Bottom-right node */}
      <Circle cx={126.5} cy={147.08} r={23.21} fill={color} />
      {/* Left node */}
      <Circle cx={23.21} cy={116.03} r={23.21} fill={color} />
    </Svg>
  );
}

/** Deal Inspect shield icon */
function ShieldIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z"
        fill="none"
        stroke="#6929C4"
        strokeWidth={1.5}
      />
      <Path
        d="M10 14l-2-2 1.41-1.41L10 11.17l3.59-3.59L15 9l-5 5z"
        fill="#6929C4"
      />
    </Svg>
  );
}

/** Domo "D" logo */
function DomoIcon({ size = 14, color = '#9CB8E3' }: { size?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 76 76" width={size} height={size}>
      <Path
        d="M76 76H0V47.46H6.64C9.61 47.46 12.28 46.18 14.12 44.15C15.28 42.87 16.1 41.28 16.46 39.53C17.39 44.05 21.43 47.46 26.28 47.46C31.13 47.46 35.17 44.05 36.1 39.52V47.46H39.42V35.61L46.12 42.24L52.79 35.61V47.46H56.16V39.52C57.09 44.05 61.13 47.46 65.98 47.46C71.51 47.46 76 43.03 76 37.55C76 32.08 71.52 27.64 65.98 27.64C61.13 27.64 57.09 31.05 56.16 35.58V27.64L46.12 37.55L36.1 27.64V35.58C35.17 31.05 31.13 27.64 26.28 27.64C21.43 27.64 17.38 31.05 16.46 35.58C16.1 33.82 15.28 32.24 14.12 30.95C12.28 28.92 9.61 27.64 6.64 27.64H0V0H76V76ZM26.28 30.93C29.97 30.93 32.96 33.9 32.96 37.55C32.96 41.2 29.97 44.17 26.28 44.17C22.59 44.17 19.59 41.2 19.59 37.55C19.59 33.9 22.59 30.93 26.28 30.93ZM65.98 30.93C69.67 30.93 72.67 33.9 72.67 37.55C72.67 41.2 69.67 44.17 65.98 44.17C62.29 44.17 59.3 41.2 59.3 37.55C59.3 33.9 62.29 30.93 65.98 30.93ZM7.08 30.95C10.57 31.17 13.33 34.04 13.33 37.55C13.33 41.06 10.57 43.93 7.08 44.15H3.32V30.95H7.08Z"
        fill={color}
      />
    </Svg>
  );
}

// ─── Header & Footer ────────────────────────────────────────────────────────

function PageHeader({ accountName, styles }: { accountName: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerBrand}>
        <ShieldIcon size={10} />
        <Text style={{ fontWeight: 700, color: '#6929C4', fontSize: 7 }}>DEAL INSPECT</Text>
        <Text style={{ color: '#cbd5e1', fontSize: 7 }}> | </Text>
        <Text>{s(accountName)}</Text>
      </View>
      <Text>CONFIDENTIAL</Text>
    </View>
  );
}

function PageFooter({ generatedAt, styles }: { generatedAt: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.footer} fixed>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <DomoIcon size={8} color="#94a3b8" />
        <Text style={{ fontSize: 6.5, color: '#cbd5e1' }}>+</Text>
        <SnowflakeLogo size={8} color="#94a3b8" />
        <CortexLogo size={8} color="#94a3b8" />
        <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>Powered by Snowflake Cortex</Text>
      </View>
      <Text render={({ pageNumber, totalPages }) => `${formatDate(generatedAt)}  |  Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

// ─── SE / AE Quick Actions Extraction ────────────────────────────────────────
// Parses the action plan prose to extract role-specific quick actions for the
// visual summary card at the top of the action plan section.

// ─── Tech category colors for PDF (matches UI TECH_CATEGORY_STYLES) ─────────
// Maps category keys to { bg, text } hex values matching Tailwind palette.

const PDF_TECH_CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  CRM:    { bg: '#fff7ed', text: '#c2410c' },   // orange
  BI:     { bg: '#eff6ff', text: '#1d4ed8' },   // blue
  DW:     { bg: '#f5f3ff', text: '#6d28d9' },   // violet
  ETL:    { bg: '#fffbeb', text: '#b45309' },   // amber
  Cloud:  { bg: '#ecfeff', text: '#0e7490' },   // cyan
  ML:     { bg: '#ecfdf5', text: '#047857' },   // emerald
  ERP:    { bg: '#eef2ff', text: '#4338ca' },   // indigo
  DevOps: { bg: '#fff1f2', text: '#be123c' },   // rose
  Other:  { bg: '#f1f5f9', text: '#475569' },   // slate
};

function getCategoryColor(category: string): { bg: string; text: string } {
  return PDF_TECH_CATEGORY_COLORS[category] || PDF_TECH_CATEGORY_COLORS.Other;
}

/** Capitalize the first character of a string */
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function extractQuickActions(content: string): { se: string[]; ae: string[]; timeline: string[] } {
  const se: string[] = [];
  const ae: string[] = [];
  const timeline: string[] = [];

  // Match "SE should/must/needs to..." and "AE should/must/needs to..." patterns
  const sentences = content.split(/[.!]\s+/);
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed || trimmed.length < 20) continue;

    // Extract SE actions — capitalize first letter after stripping role prefix
    const seMatch = trimmed.match(/\b(?:SE|Solutions Engineer|the SE)\s+(?:should|must|needs? to|will)\s+(.{20,})/i);
    if (seMatch && se.length < 4) {
      const action = capitalize(seMatch[0].replace(/^(?:the\s+)?SE\s+/i, '').trim());
      se.push(action);
    }

    // Extract AE actions — capitalize first letter after stripping role prefix
    const aeMatch = trimmed.match(/\b(?:AE|Account Executive|the AE)\s+(?:should|must|needs? to|will)\s+(.{20,})/i);
    if (aeMatch && ae.length < 4) {
      const action = capitalize(aeMatch[0].replace(/^(?:the\s+)?AE\s+/i, '').trim());
      ae.push(action);
    }

    // Extract timeline items — strip role prefix for cleaner display
    const timeMatch = trimmed.match(/\b(?:within\s+(?:one|two|three|1|2|3)\s+weeks?|immediately|this\s+week|next\s+(?:week|meeting)|two\s+weeks?|30[\s-]day)/i);
    if (timeMatch && timeline.length < 3) {
      // Clean up: strip leading "The SE/AE" for timeline context
      let timeItem = trimmed.replace(/^(?:the\s+)?(?:SE|AE)\s+/i, '');
      timeItem = capitalize(timeItem);
      if (timeItem.length > 130) timeItem = timeItem.substring(0, 127) + '...';
      timeline.push(timeItem);
    }
  }

  return { se, ae, timeline };
}

/** Renders the SE/AE Quick Actions card at the top of the action plan section */
function ActionPlanQuickActions({ content, styles }: { content: string; styles: ReturnType<typeof createStyles> }) {
  const { se, ae, timeline } = extractQuickActions(content);

  if (se.length === 0 && ae.length === 0) return null;

  return (
    <View style={{
      backgroundColor: '#f0f4ff',
      borderWidth: 1,
      borderColor: '#c7d2fe',
      borderRadius: 6,
      padding: 12,
      marginBottom: 12,
    }} wrap={false}>
      <Text style={{ fontSize: 10, fontWeight: 700, color: '#3730a3', marginBottom: 8, letterSpacing: 0.5 }}>
        QUICK REFERENCE — PRESCRIBED NEXT ACTIONS
      </Text>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        {/* SE Column */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6929C4' }} />
            <Text style={{ fontSize: 8, fontWeight: 700, color: '#6929C4', letterSpacing: 0.5 }}>SE MUST DO</Text>
          </View>
          {se.length > 0 ? se.map((action, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={{ width: 12, fontSize: 8, color: '#6929C4', fontWeight: 700 }}>{i + 1}.</Text>
              <Text style={{ fontSize: 8, lineHeight: 1.4, color: '#374151', flex: 1 }}>{sanitize(action)}</Text>
            </View>
          )) : (
            <Text style={{ fontSize: 8, color: '#9ca3af' }}>See full plan below</Text>
          )}
        </View>

        {/* AE Column */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563eb' }} />
            <Text style={{ fontSize: 8, fontWeight: 700, color: '#2563eb', letterSpacing: 0.5 }}>AE MUST DO</Text>
          </View>
          {ae.length > 0 ? ae.map((action, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={{ width: 12, fontSize: 8, color: '#2563eb', fontWeight: 700 }}>{i + 1}.</Text>
              <Text style={{ fontSize: 8, lineHeight: 1.4, color: '#374151', flex: 1 }}>{sanitize(action)}</Text>
            </View>
          )) : (
            <Text style={{ fontSize: 8, color: '#9ca3af' }}>See full plan below</Text>
          )}
        </View>
      </View>

      {/* Timeline strip */}
      {timeline.length > 0 && (
        <View style={{ marginTop: 8, borderTopWidth: 0.5, borderTopColor: '#c7d2fe', paddingTop: 6 }}>
          <Text style={{ fontSize: 7, fontWeight: 700, color: '#4338ca', letterSpacing: 0.5, marginBottom: 3 }}>KEY DEADLINES</Text>
          {timeline.map((t, i) => (
            <Text key={i} style={{ fontSize: 7.5, color: '#4b5563', lineHeight: 1.4 }}>- {sanitize(t)}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Document ──────────────────────────────────────────────────────────

interface TDRReadoutDocumentProps {
  payload: ReadoutPayload;
  theme?: ReadoutTheme;
}

export function TDRReadoutDocument({ payload, theme = DEFAULT_THEME }: TDRReadoutDocumentProps) {
  const styles = createStyles(theme);
  const {
    session, inputs, sumble, perplexity, brief, classifiedFindings,
    extractedEntities, chatHighlights, orgProfile, hiringSignals, keyPeople,
    actionPlan,
  } = payload;
  const inputsByStep = groupInputsByStep(inputs);

  // Dynamic section numbering
  let sectionNum = 0;
  const nextSection = () => ++sectionNum;

  return (
    <Document title={`TDR Readout - ${s(session.accountName)}`} author="Deal Inspect" subject="Technical Deal Review">
      {/* ── Cover Page ── */}
      <Page size="A4" style={styles.coverPage}>
        {/* App brand */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 32 }}>
          <ShieldIcon size={18} />
          <Text style={styles.coverAppName}>DEAL INSPECT</Text>
        </View>

        <Text style={styles.coverLabel}>Technical Deal Review</Text>
        <Text style={styles.coverTitle}>{s(session.accountName)}</Text>
        <Text style={styles.coverSubtitle}>
          {s(session.stage)} {session.outcome ? `- ${s(session.outcome)}` : ''} | Iteration #{session.iteration}
        </Text>

        <View style={styles.coverMeta}>
          <View>
            <Text style={styles.coverMetaItem}>ACV</Text>
            <Text style={styles.coverMetaValue}>{formatCurrency(session.acv)}</Text>
          </View>
          <View>
            <Text style={styles.coverMetaItem}>Stage</Text>
            <Text style={styles.coverMetaValue}>{s(session.stage)}</Text>
          </View>
          <View>
            <Text style={styles.coverMetaItem}>Status</Text>
            <Text style={styles.coverMetaValue}>{s(session.status)}</Text>
          </View>
          <View>
            <Text style={styles.coverMetaItem}>Iteration</Text>
            <Text style={styles.coverMetaValue}>#{session.iteration}</Text>
          </View>
        </View>

        <View style={[styles.coverMeta, { marginTop: 20 }]}>
          <View>
            <Text style={styles.coverMetaItem}>Owner</Text>
            <Text style={styles.coverMetaValue}>{s(session.owner)}</Text>
          </View>
          <View>
            <Text style={styles.coverMetaItem}>Created</Text>
            <Text style={styles.coverMetaValue}>{formatDate(session.createdAt)}</Text>
          </View>
          {session.outcome && (
            <View>
              <Text style={styles.coverMetaItem}>Outcome</Text>
              <Text style={styles.coverMetaValue}>{s(session.outcome)}</Text>
            </View>
          )}
        </View>

        {/* Platform logos */}
        <View style={styles.coverPoweredBy}>
          <DomoIcon size={14} color="#64748b" />
          <Text style={styles.poweredByText}>Built on Domo</Text>
          <Text style={{ color: '#475569', fontSize: 7, marginHorizontal: 4 }}>|</Text>
          <SnowflakeLogo size={12} color="#64748b" />
          <CortexLogo size={12} color="#64748b" />
          <Text style={styles.poweredByText}>Powered by Snowflake Cortex</Text>
        </View>

        <Text style={styles.coverConfidential}>
          {s(theme.confidentialityLabel)} - {formatDate(payload.generatedAt)} - Do not distribute without authorization
        </Text>
      </Page>

      {/* ── Executive Summary ── */}
      <Page size="A4" style={styles.page} wrap>
        <PageHeader accountName={session.accountName} styles={styles} />
        <PageFooter generatedAt={payload.generatedAt} styles={styles} />

        <Text style={styles.sectionTitle}>{nextSection()}. Executive Summary</Text>
        {brief ? (
          <>
            <MultilineText text={normalizeContent(brief.content)} styles={styles} />
            <View style={styles.aiBadge}>
              <CortexLogo size={9} />
              <Text style={styles.aiBadgeText}>
                Generated via Snowflake Cortex ({s(brief.modelUsed)}) - {formatDate(brief.createdAt)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.emptySection}>TDR brief not yet generated. Generate a brief from the TDR Workspace to populate this section.</Text>
        )}
      </Page>

      {/* ── Strategic Action Plan (Section 2 — the centerpiece) ── */}
      {actionPlan && actionPlan.content && (
        <Page size="A4" style={styles.page} wrap>
          <PageHeader accountName={session.accountName} styles={styles} />
          <PageFooter generatedAt={payload.generatedAt} styles={styles} />

          <Text style={styles.sectionTitle}>{nextSection()}. Prescribed Action Plan</Text>

          {/* SE / AE Quick Actions Card */}
          <ActionPlanQuickActions content={normalizeContent(actionPlan.content)} styles={styles} />

          <View style={styles.sectionDivider} />

          {/* Full Action Plan */}
          <Text style={[styles.sectionSubtitle, { marginTop: 0, marginBottom: 8 }]}>Full Action Plan</Text>
          <MultilineText text={normalizeContent(actionPlan.content)} styles={styles} />

          <View style={styles.aiBadge}>
            <CortexLogo size={9} />
            <Text style={styles.aiBadgeText}>
              Synthesized via Snowflake Cortex ({s(actionPlan.modelUsed)}) - {formatDate(actionPlan.createdAt)}
            </Text>
          </View>
          <Text style={[styles.smallText, { marginTop: 4 }]}>
            Sources: TDR inputs, Sumble enrichment, Perplexity research, Knowledge Base, Cortex AI chat, classified findings
          </Text>
        </Page>
      )}

      {/* ── Deal Context & Stakes (TDR Step Inputs) ── */}
      <Page size="A4" style={styles.page} wrap>
        <PageHeader accountName={session.accountName} styles={styles} />
        <PageFooter generatedAt={payload.generatedAt} styles={styles} />

        <Text style={styles.sectionTitle}>{nextSection()}. Deal Context & Stakes</Text>
        {inputsByStep.size > 0 ? (
          <>
            {Array.from(inputsByStep.entries()).map(([stepId, fields]) => (
              <View key={stepId} style={styles.card} wrap={false}>
                <Text style={styles.stepHeader}>{humanizeStepId(stepId)}</Text>
                {fields.map((f, j) => (
                  <View key={j} style={{ marginBottom: 6 }}>
                    <Text style={styles.fieldLabel}>{humanizeFieldId(f.fieldId)}</Text>
                    <Text style={styles.fieldValue}>{s(normalizeContent(f.value))}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.emptySection}>No TDR step inputs recorded yet.</Text>
        )}
      </Page>

      {/* ── Account Intelligence ── */}
      <Page size="A4" style={styles.page} wrap>
        <PageHeader accountName={session.accountName} styles={styles} />
        <PageFooter generatedAt={payload.generatedAt} styles={styles} />

        <Text style={styles.sectionTitle}>{nextSection()}. Account Intelligence</Text>

        {/* Org Profile */}
        {orgProfile && (
          <View style={styles.card} wrap={false}>
            <Text style={styles.sectionSubtitle}>Organization Profile</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { fontWeight: 600 }]}>Industry</Text>
                <Text style={styles.tableCell}>{s(orgProfile.industry || '--')}</Text>
                <Text style={[styles.tableCell, { fontWeight: 600 }]}>Employees</Text>
                <Text style={styles.tableCell}>{orgProfile.totalEmployees?.toLocaleString() || '--'}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { fontWeight: 600 }]}>Location</Text>
                <Text style={styles.tableCell}>{s([orgProfile.hqState, orgProfile.hqCountry].filter(Boolean).join(', ') || '--')}</Text>
                <Text style={[styles.tableCell, { fontWeight: 600 }]}>Source</Text>
                <Text style={styles.tableCell}>Sumble - {formatDate(orgProfile.pulledAt)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tech Stack */}
        {sumble && (
          <View style={styles.card} wrap={false}>
            <Text style={styles.sectionSubtitle}>Technology Stack</Text>
            {(() => {
              // Prefer categorized display (matches UI layout with category labels)
              const cats = sumble.techCategories && typeof sumble.techCategories === 'object'
                ? Object.entries(sumble.techCategories as Record<string, unknown>).filter(
                    ([, v]) => isStringArray(v) && (v as string[]).length > 0
                  )
                : [];

              if (cats.length > 0) {
                return (
                  <View>
                    {cats.map(([cat, techs]) => {
                      const color = getCategoryColor(cat);
                      return (
                        <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                          <Text style={{ fontSize: 7.5, color: '#64748b', width: 55, fontWeight: 600 }}>{sanitize(cat)}</Text>
                          <View style={styles.tagRow}>
                            {(techs as string[]).map((tech, i) => (
                              <Text key={i} style={[styles.tag, { backgroundColor: color.bg, color: color.text }]}>
                                {sanitize(tech)}
                              </Text>
                            ))}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              }

              // Fallback: flat list with default styling
              if (isStringArray(sumble.technologies) && sumble.technologies.length > 0) {
                return (
                  <View style={styles.tagRow}>
                    {sumble.technologies.map((tech: string, i: number) => (
                      <Text key={i} style={styles.tag}>{sanitize(tech)}</Text>
                    ))}
                  </View>
                );
              }

              return <Text style={styles.emptySection}>No technology data available.</Text>;
            })()}
            <Text style={styles.smallText}>Source: Sumble - {formatDate(sumble.pulledAt)}</Text>
          </View>
        )}

        {/* Perplexity Research */}
        {perplexity && (
          <View style={styles.card} wrap={false}>
            <Text style={styles.sectionSubtitle}>Research Summary</Text>
            <Text style={styles.bodyText}>{s(normalizeContent(perplexity.summary))}</Text>

            {isStringArray(perplexity.recentInitiatives) && perplexity.recentInitiatives.length > 0 && (
              <>
                <Text style={[styles.sectionSubtitle, { fontSize: 10 }]}>Recent Initiatives</Text>
                {perplexity.recentInitiatives.map((item, i) => (
                  <View key={i} style={styles.listItem}>
                    <Text style={styles.bullet}>-</Text>
                    <Text style={styles.listText}>{safeString(item)}</Text>
                  </View>
                ))}
              </>
            )}

            {isStringArray(perplexity.competitiveLandscape) && perplexity.competitiveLandscape.length > 0 && (
              <>
                <Text style={[styles.sectionSubtitle, { fontSize: 10 }]}>Competitive Landscape</Text>
                {perplexity.competitiveLandscape.map((item, i) => (
                  <View key={i} style={styles.listItem}>
                    <Text style={styles.bullet}>-</Text>
                    <Text style={styles.listText}>{safeString(item)}</Text>
                  </View>
                ))}
              </>
            )}

            {isStringArray(perplexity.citations) && perplexity.citations.length > 0 && (
              <>
                <Text style={[styles.sectionSubtitle, { fontSize: 10 }]}>Citations</Text>
                {perplexity.citations.map((url, i) => (
                  <Text key={i} style={[styles.smallText, { color: '#2563eb' }]}>{safeString(url)}</Text>
                ))}
              </>
            )}

            <Text style={styles.smallText}>Source: Perplexity - {formatDate(perplexity.pulledAt)}</Text>
          </View>
        )}

        {!sumble && !perplexity && !orgProfile && (
          <Text style={styles.emptySection}>No account intelligence gathered yet. Use the Intelligence panel to enrich and research.</Text>
        )}
      </Page>

      {/* ── Risk Assessment & Classified Findings ── */}
      <Page size="A4" style={styles.page} wrap>
        <PageHeader accountName={session.accountName} styles={styles} />
        <PageFooter generatedAt={payload.generatedAt} styles={styles} />

        <Text style={styles.sectionTitle}>{nextSection()}. Risk Assessment & Classified Findings</Text>

        {classifiedFindings?.findings && classifiedFindings.findings.length > 0 ? (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Finding</Text>
              <Text style={styles.tableHeaderCell}>Category</Text>
            </View>
            {classifiedFindings.findings.map((f, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{s(f.finding)}</Text>
                <Text style={styles.tableCell}>{s(f.category.replace(/_/g, ' '))}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptySection}>No classified findings available. Run Classify Findings from the Intelligence panel.</Text>
        )}

        {/* Extracted Entities */}
        <View style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>{nextSection()}. Extracted Entities</Text>

        {extractedEntities ? (
          <View>
            {isStringArray(extractedEntities.competitors) && extractedEntities.competitors.length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <Text style={[styles.smallText, { fontWeight: 600 }]}>Competitors</Text>
                <View style={styles.tagRow}>
                  {extractedEntities.competitors.map((c, i) => <Text key={i} style={styles.tag}>{safeString(c)}</Text>)}
                </View>
              </View>
            )}
            {isStringArray(extractedEntities.technologies) && extractedEntities.technologies.length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <Text style={[styles.smallText, { fontWeight: 600 }]}>Technologies</Text>
                <View style={styles.tagRow}>
                  {extractedEntities.technologies.map((t, i) => <Text key={i} style={styles.tag}>{safeString(t)}</Text>)}
                </View>
              </View>
            )}
            {isStringArray(extractedEntities.executives) && extractedEntities.executives.length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <Text style={[styles.smallText, { fontWeight: 600 }]}>Key Executives</Text>
                <View style={styles.tagRow}>
                  {extractedEntities.executives.map((e, i) => <Text key={i} style={styles.tag}>{safeString(e)}</Text>)}
                </View>
              </View>
            )}
            {isStringArray(extractedEntities.timelines) && extractedEntities.timelines.length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <Text style={[styles.smallText, { fontWeight: 600 }]}>Timelines</Text>
                {extractedEntities.timelines.map((t, i) => (
                  <View key={i} style={styles.listItem}>
                    <Text style={styles.bullet}>-</Text>
                    <Text style={styles.listText}>{safeString(t)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.emptySection}>No entity extraction performed yet. Run Extract Entities from the Intelligence panel.</Text>
        )}

        {/* Hiring & People Signals */}
        {(hiringSignals || keyPeople) && (
          <>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionTitle}>{nextSection()}. Hiring & People Signals</Text>

            {hiringSignals && (
              <View style={styles.card}>
                <Text style={styles.sectionSubtitle}>Hiring Signals - {hiringSignals.jobCount} active data/tech roles</Text>
                <Text style={styles.smallText}>Source: Sumble - {formatDate(hiringSignals.pulledAt)}</Text>
              </View>
            )}

            {keyPeople && (
              <View style={styles.card}>
                <Text style={styles.sectionSubtitle}>Key People - {keyPeople.peopleCount} relevant contacts identified</Text>
                <Text style={styles.smallText}>Source: Sumble - {formatDate(keyPeople.pulledAt)}</Text>
              </View>
            )}
          </>
        )}
      </Page>

      {/* ── AI Chat Highlights ── */}
      {chatHighlights.length > 0 && (
        <Page size="A4" style={styles.page} wrap>
          <PageHeader accountName={session.accountName} styles={styles} />
          <PageFooter generatedAt={payload.generatedAt} styles={styles} />

          <Text style={styles.sectionTitle}>{nextSection()}. AI Chat Highlights</Text>
          <Text style={styles.smallText}>Selected recent exchanges from the TDR inline chat.</Text>

          {chatHighlights.map((msg, i) => (
            <View key={i} style={[styles.card, { backgroundColor: msg.role === 'user' ? '#f0f4ff' : '#f8fafc' }]} wrap={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={[styles.smallText, { fontWeight: 600, color: msg.role === 'user' ? '#3b82f6' : '#6929C4' }]}>
                  {msg.role === 'user' ? 'User' : `AI (${s(msg.provider)}/${s(msg.model)})`}
                </Text>
                <Text style={styles.smallText}>{formatDate(msg.createdAt)}</Text>
              </View>
              <Text style={styles.bodyText}>{s(normalizeContent(msg.content))}</Text>
            </View>
          ))}
        </Page>
      )}

      {/* ── Generation Metadata (Appendix) ── */}
      <Page size="A4" style={styles.page}>
        <PageHeader accountName={session.accountName} styles={styles} />
        <PageFooter generatedAt={payload.generatedAt} styles={styles} />

        <Text style={styles.sectionTitle}>{nextSection()}. Appendix - Generation Metadata</Text>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { fontWeight: 600 }]}>Session ID</Text>
            <Text style={[styles.tableCell, { flex: 3 }]}>{session.sessionId}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { fontWeight: 600 }]}>Opportunity ID</Text>
            <Text style={[styles.tableCell, { flex: 3 }]}>{session.opportunityId}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { fontWeight: 600 }]}>Generated At</Text>
            <Text style={[styles.tableCell, { flex: 3 }]}>{formatDate(payload.generatedAt)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { fontWeight: 600 }]}>TDR Iteration</Text>
            <Text style={[styles.tableCell, { flex: 3 }]}>#{session.iteration}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { fontWeight: 600 }]}>Input Fields</Text>
            <Text style={[styles.tableCell, { flex: 3 }]}>
              {Array.from(inputsByStep.values()).reduce((sum, fields) => sum + fields.length, 0)} fields across {inputsByStep.size} steps
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { fontWeight: 600 }]}>Intel Sources</Text>
            <Text style={[styles.tableCell, { flex: 3 }]}>
              {[
                sumble ? 'Sumble' : null,
                perplexity ? 'Perplexity' : null,
                orgProfile ? 'Sumble Org' : null,
                hiringSignals ? 'Sumble Jobs' : null,
                keyPeople ? 'Sumble People' : null,
              ].filter(Boolean).join(', ') || 'None'}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { fontWeight: 600 }]}>AI Analysis</Text>
            <Text style={[styles.tableCell, { flex: 3 }]}>
              {[
                brief ? 'TDR Brief' : null,
                classifiedFindings ? 'Classified Findings' : null,
                extractedEntities ? 'Extracted Entities' : null,
                actionPlan ? 'Action Plan' : null,
              ].filter(Boolean).join(', ') || 'None'}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { fontWeight: 600 }]}>Chat Messages</Text>
            <Text style={[styles.tableCell, { flex: 3 }]}>{chatHighlights.length} included</Text>
          </View>
        </View>

        {/* Platform attribution */}
        <View style={{ marginTop: 24, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <ShieldIcon size={16} />
            <Text style={{ fontSize: 10, fontWeight: 700, color: '#6929C4' }}>Deal Inspect</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <DomoIcon size={18} color="#6b7280" />
            <SnowflakeLogo size={16} color="#6b7280" />
            <CortexLogo size={16} color="#6b7280" />
          </View>
          <Text style={{ fontSize: 8, color: '#94a3b8', textAlign: 'center' }}>
            Technical Deal Review platform built on Domo, powered by Snowflake Cortex AI
          </Text>
          <Text style={{ fontSize: 8, color: '#94a3b8', textAlign: 'center', marginTop: 2 }}>
            Intelligence enriched via Sumble and Perplexity
          </Text>
        </View>

        <Text style={[styles.smallText, { marginTop: 20, textAlign: 'center' }]}>
          -- End of TDR Readout --
        </Text>
      </Page>
    </Document>
  );
}
