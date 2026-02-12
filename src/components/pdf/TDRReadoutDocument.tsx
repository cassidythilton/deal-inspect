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
  G,
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
      color: theme.accentColor,
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
    // Tags
    tag: {
      fontSize: 8,
      color: theme.primaryColor,
      backgroundColor: '#f0ebff',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 3,
      marginRight: 4,
      marginBottom: 4,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
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

// ─── Helper: Group inputs by step ───────────────────────────────────────────

function groupInputsByStep(inputs: ReadoutPayload['inputs']): Map<string, { fieldId: string; value: string }[]> {
  const map = new Map<string, { fieldId: string; value: string }[]>();
  for (const input of inputs) {
    if (!map.has(input.stepId)) map.set(input.stepId, []);
    map.get(input.stepId)!.push({ fieldId: input.fieldId, value: input.value });
  }
  // Sort by STEP_ORDER
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
        // Numbered section header: "1. Title" or "## Title"
        const numberedMatch = para.match(/^(\d+)\.\s+(.+?)(?:\n(.*))?$/s);
        if (numberedMatch) {
          const title = numberedMatch[2].replace(/\*\*/g, '');
          const body = numberedMatch[3]?.trim();
          return (
            <View key={i}>
              <Text style={styles.numberedHeader}>{numberedMatch[1]}. {title}</Text>
              {body && <MultilineBody text={body} styles={styles} />}
            </View>
          );
        }

        // Bold header detection: **Title** content
        const boldMatch = para.match(/^\*\*(.*?)\*\*(.*)$/s);
        if (boldMatch) {
          return (
            <View key={i}>
              <Text style={styles.sectionSubtitle}>{boldMatch[1]}</Text>
              {boldMatch[2].trim() && <MultilineBody text={boldMatch[2].trim()} styles={styles} />}
            </View>
          );
        }

        // Paragraph with embedded bullet list
        if (para.includes('\n- ') || para.includes('\n* ')) {
          return <MultilineBody key={i} text={para} styles={styles} />;
        }

        return <Text key={i} style={styles.bodyText}>{para.replace(/\*\*/g, '')}</Text>;
      })}
    </>
  );
}

/** Render a body block that may contain inline bullet lists */
function MultilineBody({ text, styles }: { text: string; styles: ReturnType<typeof createStyles> }) {
  const lines = text.split('\n');
  return (
    <View>
      {lines.map((line, j) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.slice(2).replace(/\*\*/g, '');
          return (
            <View key={j} style={styles.listItem}>
              <Text style={styles.bullet}>-</Text>
              <Text style={styles.listText}>{content}</Text>
            </View>
          );
        }
        return trimmed ? <Text key={j} style={styles.bodyText}>{trimmed.replace(/\*\*/g, '')}</Text> : null;
      })}
    </View>
  );
}

// ─── SVG Logos for PDF (react-pdf Svg components) ────────────────────────────

function SnowflakeIcon({ size = 12 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" stroke="#29B5E8" strokeWidth={2} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={2} fill="#29B5E8" />
    </Svg>
  );
}

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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <SnowflakeIcon size={8} />
        <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>Powered by Snowflake Cortex</Text>
      </View>
      <Text render={({ pageNumber, totalPages }) => `${formatDate(generatedAt)}  |  Page ${pageNumber} of ${totalPages}`} />
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
        <Text style={styles.coverSubtitle}>{s(session.opportunityName)}</Text>

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

        {/* Powered by Snowflake Cortex */}
        <View style={styles.coverPoweredBy}>
          <SnowflakeIcon size={10} />
          <Text style={styles.poweredByText}>Powered by</Text>
          <Text style={styles.poweredByBrand}>Snowflake Cortex</Text>
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
            <MultilineText text={brief.content} styles={styles} />
            <View style={styles.aiBadge}>
              <SnowflakeIcon size={8} />
              <Text style={styles.aiBadgeText}>
                Generated via Snowflake Cortex ({s(brief.modelUsed)}) - {formatDate(brief.createdAt)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.emptySection}>TDR brief not yet generated. Generate a brief from the TDR Workspace to populate this section.</Text>
        )}
      </Page>

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
                    <Text style={styles.fieldValue}>{s(f.value)}</Text>
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
            {isStringArray(sumble.technologies) ? (
              <View style={styles.tagRow}>
                {sumble.technologies.map((tech, i) => (
                  <Text key={i} style={styles.tag}>{tech}</Text>
                ))}
              </View>
            ) : sumble.technologies && typeof sumble.technologies === 'object' && !Array.isArray(sumble.technologies) ? (
              (() => {
                const entries = Object.entries(sumble.technologies as Record<string, unknown>).filter(
                  ([, v]) => isStringArray(v)
                );
                if (entries.length === 0) {
                  return <Text style={styles.bodyText}>{safeString(sumble.technologies)}</Text>;
                }
                return entries.map(([cat, techs]) => (
                  <View key={cat} style={{ marginBottom: 4 }}>
                    <Text style={[styles.smallText, { fontWeight: 600 }]}>{cat}</Text>
                    <View style={styles.tagRow}>
                      {(techs as string[]).map((tech, i) => (
                        <Text key={i} style={styles.tag}>{tech}</Text>
                      ))}
                    </View>
                  </View>
                ));
              })()
            ) : (
              <Text style={styles.emptySection}>No technology data available.</Text>
            )}
            <Text style={styles.smallText}>Source: Sumble - {formatDate(sumble.pulledAt)}</Text>
          </View>
        )}

        {/* Perplexity Research */}
        {perplexity && (
          <View style={styles.card} wrap={false}>
            <Text style={styles.sectionSubtitle}>Research Summary</Text>
            <Text style={styles.bodyText}>{s(perplexity.summary)}</Text>

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

      {/* ── Action Plan (if available) ── */}
      {actionPlan && actionPlan.content && (
        <Page size="A4" style={styles.page} wrap>
          <PageHeader accountName={session.accountName} styles={styles} />
          <PageFooter generatedAt={payload.generatedAt} styles={styles} />

          <Text style={styles.sectionTitle}>{nextSection()}. Strategic Action Plan</Text>
          <MultilineText text={actionPlan.content} styles={styles} />
          <View style={styles.aiBadge}>
            <SnowflakeIcon size={8} />
            <Text style={styles.aiBadgeText}>
              Synthesized via Snowflake Cortex ({s(actionPlan.modelUsed)}) - {formatDate(actionPlan.createdAt)}
            </Text>
          </View>
        </Page>
      )}

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
              <Text style={styles.bodyText}>{s(msg.content)}</Text>
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
            <Text style={[styles.tableCell, { flex: 3 }]}>{inputs.length} fields across {inputsByStep.size} steps</Text>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <ShieldIcon size={16} />
            <Text style={{ fontSize: 10, fontWeight: 700, color: '#6929C4' }}>Deal Inspect</Text>
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
