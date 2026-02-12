/**
 * TDRReadoutDocument — React-PDF document for the executive TDR readout.
 *
 * Uses @react-pdf/renderer to generate a polished, branded PDF
 * that captures the entire TDR lifecycle as the canonical artifact of record.
 *
 * Sprint 13: TDR Readout PDF Engine
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { ReadoutPayload, ReadoutTheme } from './readoutTypes';
import { DEFAULT_THEME } from './readoutTypes';

// ─── Font Registration ───────────────────────────────────────────────────────

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiA.woff2', fontWeight: 700 },
  ],
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (theme: ReadoutTheme) =>
  StyleSheet.create({
    page: {
      fontFamily: 'Inter',
      fontSize: 10,
      color: '#433650',
      paddingTop: 60,
      paddingBottom: 50,
      paddingHorizontal: 40,
    },
    // Cover page
    coverPage: {
      fontFamily: 'Inter',
      backgroundColor: theme.secondaryColor,
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: 60,
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
    // Header/Footer
    header: {
      position: 'absolute',
      top: 20,
      left: 40,
      right: 40,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 7,
      color: '#94a3b8',
    },
    footer: {
      position: 'absolute',
      bottom: 20,
      left: 40,
      right: 40,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 7,
      color: '#94a3b8',
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
      fontStyle: 'italic',
      color: '#9ca3af',
      paddingVertical: 8,
    },
  });

// ─── Helper: Format date ────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
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

/** Safely convert any value to a renderable string (prevents React #31 on objects) */
function safeString(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(safeString).join(', ');
  if (typeof val === 'object') {
    try { return JSON.stringify(val); } catch { return '[object]'; }
  }
  return String(val);
}

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
  return map;
}

// ─── Helper: render multiline text ──────────────────────────────────────────

function MultilineText({ text, styles }: { text: string; styles: ReturnType<typeof createStyles> }) {
  const paragraphs = text.split('\n\n').filter(Boolean);
  return (
    <>
      {paragraphs.map((para, i) => {
        // Bold header detection
        const boldMatch = para.match(/^\*\*(.*?)\*\*(.*)$/s);
        if (boldMatch) {
          return (
            <View key={i}>
              <Text style={styles.sectionSubtitle}>{boldMatch[1]}</Text>
              {boldMatch[2].trim() && <Text style={styles.bodyText}>{boldMatch[2].trim()}</Text>}
            </View>
          );
        }
        // Bullet list
        if (para.includes('\n- ')) {
          const lines = para.split('\n');
          return (
            <View key={i}>
              {lines.map((line, j) => {
                if (line.startsWith('- ')) {
                  return (
                    <View key={j} style={styles.listItem}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.listText}>{line.slice(2).replace(/\*\*/g, '')}</Text>
                    </View>
                  );
                }
                return line.trim() ? <Text key={j} style={styles.bodyText}>{line.replace(/\*\*/g, '')}</Text> : null;
              })}
            </View>
          );
        }
        return <Text key={i} style={styles.bodyText}>{para.replace(/\*\*/g, '')}</Text>;
      })}
    </>
  );
}

// ─── Header & Footer ────────────────────────────────────────────────────────

function PageHeader({ accountName, theme, styles }: { accountName: string; theme: ReadoutTheme; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.header} fixed>
      <Text>{theme.confidentialityLabel} — {accountName}</Text>
      <Text>Generated by TDR Deal Inspection</Text>
    </View>
  );
}

function PageFooter({ generatedAt, styles }: { generatedAt: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Generated: {formatDate(generatedAt)}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
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
  const { session, inputs, sumble, perplexity, brief, classifiedFindings, extractedEntities, chatHighlights, orgProfile, hiringSignals, keyPeople } = payload;
  const inputsByStep = groupInputsByStep(inputs);

  return (
    <Document title={`TDR Readout — ${session.accountName}`} author="TDR Deal Inspection" subject="Technical Deal Review">
      {/* ── Cover Page ── */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverLabel}>Technical Deal Review</Text>
        <Text style={styles.coverTitle}>{session.accountName}</Text>
        <Text style={styles.coverSubtitle}>{session.opportunityName}</Text>

        <View style={styles.coverMeta}>
          <View>
            <Text style={styles.coverMetaItem}>ACV</Text>
            <Text style={styles.coverMetaValue}>{formatCurrency(session.acv)}</Text>
          </View>
          <View>
            <Text style={styles.coverMetaItem}>Stage</Text>
            <Text style={styles.coverMetaValue}>{session.stage}</Text>
          </View>
          <View>
            <Text style={styles.coverMetaItem}>Status</Text>
            <Text style={styles.coverMetaValue}>{session.status}</Text>
          </View>
          <View>
            <Text style={styles.coverMetaItem}>Iteration</Text>
            <Text style={styles.coverMetaValue}>#{session.iteration}</Text>
          </View>
        </View>

        <View style={[styles.coverMeta, { marginTop: 20 }]}>
          <View>
            <Text style={styles.coverMetaItem}>Owner</Text>
            <Text style={styles.coverMetaValue}>{session.owner}</Text>
          </View>
          <View>
            <Text style={styles.coverMetaItem}>Created</Text>
            <Text style={styles.coverMetaValue}>{formatDate(session.createdAt)}</Text>
          </View>
          {session.outcome && (
            <View>
              <Text style={styles.coverMetaItem}>Outcome</Text>
              <Text style={styles.coverMetaValue}>{session.outcome}</Text>
            </View>
          )}
        </View>

        <Text style={styles.coverConfidential}>
          {theme.confidentialityLabel} · {formatDate(payload.generatedAt)} · Do not distribute without authorization
        </Text>
      </Page>

      {/* ── §1 Executive Summary ── */}
      <Page size="A4" style={styles.page}>
        <PageHeader accountName={session.accountName} theme={theme} styles={styles} />
        <PageFooter generatedAt={payload.generatedAt} styles={styles} />

        <Text style={styles.sectionTitle}>1. Executive Summary</Text>
        {brief ? (
          <MultilineText text={brief.content} styles={styles} />
        ) : (
          <Text style={styles.emptySection}>TDR brief not yet generated. Generate a brief from the TDR Workspace to populate this section.</Text>
        )}
        {brief && (
          <Text style={styles.smallText}>Model: {brief.modelUsed} · Generated: {formatDate(brief.createdAt)}</Text>
        )}

        {/* ── §2 Deal Context & Stakes ── */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>2. Deal Context & Stakes</Text>
        {inputsByStep.size > 0 ? (
          <>
            {Array.from(inputsByStep.entries()).map(([stepId, fields]) => (
              <View key={stepId} style={styles.card}>
                <Text style={styles.sectionSubtitle}>Step: {stepId}</Text>
                {fields.map((f, j) => (
                  <View key={j} style={{ marginBottom: 4 }}>
                    <Text style={[styles.smallText, { fontWeight: 600 }]}>{f.fieldId}</Text>
                    <Text style={styles.bodyText}>{f.value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.emptySection}>No TDR step inputs recorded yet.</Text>
        )}
      </Page>

      {/* ── §3 Account Intelligence ── */}
      <Page size="A4" style={styles.page}>
        <PageHeader accountName={session.accountName} theme={theme} styles={styles} />
        <PageFooter generatedAt={payload.generatedAt} styles={styles} />

        <Text style={styles.sectionTitle}>3. Account Intelligence</Text>

        {/* Org Profile */}
        {orgProfile && (
          <View style={styles.card}>
            <Text style={styles.sectionSubtitle}>Organization Profile</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { fontWeight: 600 }]}>Industry</Text>
                <Text style={styles.tableCell}>{orgProfile.industry || '—'}</Text>
                <Text style={[styles.tableCell, { fontWeight: 600 }]}>Employees</Text>
                <Text style={styles.tableCell}>{orgProfile.totalEmployees?.toLocaleString() || '—'}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { fontWeight: 600 }]}>Location</Text>
                <Text style={styles.tableCell}>{[orgProfile.hqState, orgProfile.hqCountry].filter(Boolean).join(', ') || '—'}</Text>
                <Text style={[styles.tableCell, { fontWeight: 600 }]}>Source</Text>
                <Text style={styles.tableCell}>Sumble · {formatDate(orgProfile.pulledAt)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tech Stack */}
        {sumble && (
          <View style={styles.card}>
            <Text style={styles.sectionSubtitle}>Technology Stack</Text>
            {isStringArray(sumble.technologies) ? (
              <View style={styles.tagRow}>
                {sumble.technologies.map((tech, i) => (
                  <Text key={i} style={styles.tag}>{tech}</Text>
                ))}
              </View>
            ) : sumble.technologies && typeof sumble.technologies === 'object' && !Array.isArray(sumble.technologies) ? (
              (() => {
                // Only render entries where values are string arrays (category → tech list)
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
            <Text style={styles.smallText}>Source: Sumble · {formatDate(sumble.pulledAt)}</Text>
          </View>
        )}

        {/* Perplexity Research */}
        {perplexity && (
          <View style={styles.card}>
            <Text style={styles.sectionSubtitle}>Research Summary</Text>
            <Text style={styles.bodyText}>{perplexity.summary}</Text>

            {isStringArray(perplexity.recentInitiatives) && perplexity.recentInitiatives.length > 0 && (
              <>
                <Text style={[styles.sectionSubtitle, { fontSize: 10 }]}>Recent Initiatives</Text>
                {perplexity.recentInitiatives.map((item, i) => (
                  <View key={i} style={styles.listItem}>
                    <Text style={styles.bullet}>•</Text>
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
                    <Text style={styles.bullet}>•</Text>
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

            <Text style={styles.smallText}>Source: Perplexity · {formatDate(perplexity.pulledAt)}</Text>
          </View>
        )}

        {!sumble && !perplexity && !orgProfile && (
          <Text style={styles.emptySection}>No account intelligence gathered yet. Use the Intelligence panel to enrich and research.</Text>
        )}
      </Page>

      {/* ── §4 Risk Assessment & Classified Findings ── */}
      <Page size="A4" style={styles.page}>
        <PageHeader accountName={session.accountName} theme={theme} styles={styles} />
        <PageFooter generatedAt={payload.generatedAt} styles={styles} />

        <Text style={styles.sectionTitle}>4. Risk Assessment & Classified Findings</Text>

        {classifiedFindings?.findings && classifiedFindings.findings.length > 0 ? (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Finding</Text>
              <Text style={styles.tableHeaderCell}>Category</Text>
            </View>
            {classifiedFindings.findings.map((f, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{f.finding}</Text>
                <Text style={styles.tableCell}>{f.category.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptySection}>No classified findings available. Run Classify Findings from the Intelligence panel.</Text>
        )}

        {/* Extracted Entities */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>5. Extracted Entities</Text>

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
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.listText}>{safeString(t)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.emptySection}>No entity extraction performed yet. Run Extract Entities from the Intelligence panel.</Text>
        )}

        {/* ── §6 Hiring & People Signals ── */}
        {(hiringSignals || keyPeople) && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>6. Hiring & People Signals</Text>

            {hiringSignals && (
              <View style={styles.card}>
                <Text style={styles.sectionSubtitle}>Hiring Signals — {hiringSignals.jobCount} active data/tech roles</Text>
                <Text style={styles.smallText}>Source: Sumble · {formatDate(hiringSignals.pulledAt)}</Text>
              </View>
            )}

            {keyPeople && (
              <View style={styles.card}>
                <Text style={styles.sectionSubtitle}>Key People — {keyPeople.peopleCount} relevant contacts identified</Text>
                <Text style={styles.smallText}>Source: Sumble · {formatDate(keyPeople.pulledAt)}</Text>
              </View>
            )}
          </>
        )}
      </Page>

      {/* ── §7 Chat Highlights (Appendix) ── */}
      {chatHighlights.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader accountName={session.accountName} theme={theme} styles={styles} />
          <PageFooter generatedAt={payload.generatedAt} styles={styles} />

          <Text style={styles.sectionTitle}>7. AI Chat Highlights</Text>
          <Text style={styles.smallText}>Selected recent exchanges from the TDR inline chat.</Text>

          {chatHighlights.map((msg, i) => (
            <View key={i} style={[styles.card, { backgroundColor: msg.role === 'user' ? '#f0f4ff' : '#f8fafc' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={[styles.smallText, { fontWeight: 600, color: msg.role === 'user' ? '#3b82f6' : '#6929C4' }]}>
                  {msg.role === 'user' ? 'User' : `AI (${msg.provider}/${msg.model})`}
                </Text>
                <Text style={styles.smallText}>{formatDate(msg.createdAt)}</Text>
              </View>
              <Text style={styles.bodyText}>{msg.content}</Text>
            </View>
          ))}
        </Page>
      )}

      {/* ── §8 Generation Metadata ── */}
      <Page size="A4" style={styles.page}>
        <PageHeader accountName={session.accountName} theme={theme} styles={styles} />
        <PageFooter generatedAt={payload.generatedAt} styles={styles} />

        <Text style={styles.sectionTitle}>8. Appendix — Generation Metadata</Text>

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
              ].filter(Boolean).join(', ') || 'None'}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { fontWeight: 600 }]}>Chat Messages</Text>
            <Text style={[styles.tableCell, { flex: 3 }]}>{chatHighlights.length} included</Text>
          </View>
        </View>

        <Text style={[styles.smallText, { marginTop: 20, textAlign: 'center' }]}>
          — End of TDR Readout —
        </Text>
      </Page>
    </Document>
  );
}

