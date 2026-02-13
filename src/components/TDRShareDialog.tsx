/**
 * TDR Share Dialog — Sprint 14+
 *
 * Slack-branded dialog to share a TDR readout with AI-generated summary + PDF.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import React from 'react';
import {
  Loader2,
  Hash,
  Lock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Paperclip,
  Pencil,
  Eye,
} from 'lucide-react';
import { tdrReadout } from '@/lib/tdrReadout';
import type { SlackChannel, DealTeamInfo } from '@/lib/tdrReadout';
import { getAppSettings } from '@/lib/appSettings';

/** Inline Slack logo SVG — clean monochrome */
function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.527 2.527 0 0 1 2.521 2.521 2.527 2.527 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z"/>
    </svg>
  );
}

/** Cortex AI sparkle icon */
function CortexSparkle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 0L9.5 5.5L15 7L9.5 8.5L8 14L6.5 8.5L1 7L6.5 5.5L8 0Z" fill="currentColor" opacity="0.7"/>
      <path d="M13 1L13.5 3L15 3.5L13.5 4L13 6L12.5 4L11 3.5L12.5 3L13 1Z" fill="currentColor" opacity="0.5"/>
    </svg>
  );
}

/** Render inline bold (**text**) and italic (*text*) within a line */
function renderInlineMd(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
      }
      parts.push(<strong key={key++} className="text-slate-200 font-semibold">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }
    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/** Render a structured summary (with section headers and bullets) as formatted HTML.
 *  Also gracefully handles unstructured paragraph text by splitting into logical sections. */
function FormattedSummary({ text }: { text: string }) {
  if (!text) {
    return <p className="text-[12px] text-slate-500 italic">No summary available.</p>;
  }

  // Strip wrapping quotes if AI added them
  let cleaned = text.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Normalise literal \n to real newlines
  const normalized = cleaned.replace(/\\n/g, '\n').trim();

  // Detect if the text has structured formatting (section headers with **)
  const hasStructuredHeaders = /\*\*.+?\*\*/.test(normalized);

  // If no structured headers, convert plain paragraph to structured format
  if (!hasStructuredHeaders) {
    // Split plain paragraph by sentences and group into logical sections
    const sentences = normalized.match(/[^.!?]+[.!?]+/g) || [normalized];
    const cleanSentences = sentences.map(s => s.trim()).filter(Boolean);

    if (cleanSentences.length <= 2) {
      // Very short — just render as a styled paragraph
      return (
        <div>
          <p className="text-[12px] leading-relaxed text-slate-300">
            {renderInlineMd(normalized)}
          </p>
        </div>
      );
    }

    // Group sentences into sections for readability
    return (
      <div>
        <div className="mb-3">
          <h4 className="text-[12px] font-semibold text-cyan-400 mb-1.5">Deal Overview</h4>
          <p className="text-[12px] leading-relaxed text-slate-300">
            {renderInlineMd(cleanSentences.slice(0, 2).join(' '))}
          </p>
        </div>
        {cleanSentences.length > 2 && (
          <div className="mb-3">
            <h4 className="text-[12px] font-semibold text-cyan-400 mb-1.5">Key Insights</h4>
            <ul className="space-y-1 ml-0.5">
              {cleanSentences.slice(2).map((s, j) => (
                <li key={j} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-400">
                  <span className="text-slate-600 mt-[3px] text-[8px] shrink-0">●</span>
                  <span>{renderInlineMd(s)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── Structured format: parse **headers** and - bullets ──
  const blocks = normalized.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    // Check if first line is a header (**Header Text**)
    const headerMatch = lines[0]?.match(/^\*\*(.+?)\*\*$/);

    if (headerMatch) {
      const heading = headerMatch[1];
      const bodyLines = lines.slice(1);
      const bullets = bodyLines.filter(l => /^[-•]\s/.test(l));
      const prose = bodyLines.filter(l => !/^[-•]\s/.test(l));

      elements.push(
        <div key={i} className="mb-3 last:mb-0">
          <h4 className="text-[12px] font-semibold text-cyan-400 mb-1.5">
            {heading}
          </h4>
          {prose.length > 0 && (
            <p className="text-[12px] leading-relaxed text-slate-300 mb-1">
              {renderInlineMd(prose.join(' '))}
            </p>
          )}
          {bullets.length > 0 && (
            <ul className="space-y-1 ml-0.5">
              {bullets.map((b, j) => (
                <li key={j} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-400">
                  <span className="text-slate-600 mt-[3px] text-[8px] shrink-0">●</span>
                  <span>{renderInlineMd(b.replace(/^[-•]\s*/, ''))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    } else {
      // Check if all lines are bullets
      const allBullets = lines.every(l => /^[-•]\s/.test(l));
      if (allBullets) {
        elements.push(
          <ul key={i} className="space-y-1 ml-0.5 mb-3 last:mb-0">
            {lines.map((b, j) => (
              <li key={j} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-400">
                <span className="text-slate-600 mt-[3px] text-[8px] shrink-0">●</span>
                <span>{renderInlineMd(b.replace(/^[-•]\s*/, ''))}</span>
              </li>
            ))}
          </ul>
        );
      } else {
        // Plain paragraph
        elements.push(
          <p key={i} className="text-[12px] leading-relaxed text-slate-300 mb-2 last:mb-0">
            {renderInlineMd(block.replace(/\n/g, ' '))}
          </p>
        );
      }
    }
  }

  return <div>{elements}</div>;
}

interface TDRShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  accountName: string;
  dealTeam?: DealTeamInfo;
}

export function TDRShareDialog({
  open,
  onOpenChange,
  sessionId,
  accountName,
  dealTeam,
}: TDRShareDialogProps) {
  // State
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);

  const [selectedChannel, setSelectedChannel] = useState<string>('');

  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryGenerated, setSummaryGenerated] = useState(false);

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentChannel, setSentChannel] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Retry helper — exponential backoff
  const retryWithBackoff = useCallback(async <T,>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1500,
  ): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          console.log(`[ShareDialog] Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }, []);

  // Load channels with retry
  const loadChannels = useCallback(async () => {
    setChannelsLoading(true);
    setChannelsError(null);
    try {
      const result = await retryWithBackoff(async () => {
        const res = await tdrReadout.getSlackChannels();
        if (!res.success) throw new Error(res.error || 'Failed to load channels');
        return res;
      });
      setChannels(result.channels);
      const lastChannel = localStorage.getItem('tdr-slack-default-channel');
      if (lastChannel && result.channels.some(ch => ch.id === lastChannel)) {
        setSelectedChannel(lastChannel);
      } else {
        const defaultName = getAppSettings().slackDefaultChannel;
        if (defaultName) {
          const match = result.channels.find(ch => ch.name === defaultName);
          if (match) setSelectedChannel(match.id);
        }
      }
    } catch (err) {
      setChannelsError(String(err));
    }
    setChannelsLoading(false);
  }, [retryWithBackoff]);

  // Load channels when dialog opens
  useEffect(() => {
    if (!open) return;
    setSent(false);
    setSendError(null);
    loadChannels();
  }, [open, loadChannels]);

  // Auto-generate summary when dialog opens — force regenerate to get structured format
  useEffect(() => {
    if (!open || summaryGenerated || summaryLoading) return;

    const generateSummary = async () => {
      setSummaryLoading(true);
      try {
        const result = await retryWithBackoff(async () => {
          // Always force regenerate to pick up latest prompt/format
          const res = await tdrReadout.generateReadoutSummary(sessionId, dealTeam, true);
          if (!res.success || !res.summary) throw new Error(res.error || 'No summary returned');
          return res;
        });
        setSummary(result.summary!);
        setSummaryGenerated(true);
      } catch (err) {
        console.error('[ShareDialog] Summary generation failed after retries:', err);
      }
      setSummaryLoading(false);
    };

    generateSummary();
  }, [open, sessionId, summaryGenerated, summaryLoading, retryWithBackoff, dealTeam]);

  // Regenerate summary — force bypass cache
  const handleRegenerateSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryGenerated(false);
    try {
      const result = await tdrReadout.generateReadoutSummary(sessionId, dealTeam, true);
      if (result.success && result.summary) {
        setSummary(result.summary);
        setSummaryGenerated(true);
      }
    } catch (err) {
      console.error('[ShareDialog] Summary regeneration failed:', err);
    }
    setSummaryLoading(false);
  }, [sessionId, dealTeam]);

  // Send to Slack
  const handleSend = useCallback(async () => {
    if (!selectedChannel || !summary.trim()) return;

    setSending(true);
    setSendError(null);

    try {
      const result = await tdrReadout.shareToSlack(
        sessionId,
        selectedChannel,
        accountName,
        summary.trim(),
        dealTeam,
      );

      if (result.success) {
        localStorage.setItem('tdr-slack-default-channel', selectedChannel);
        const channelObj = channels.find(ch => ch.id === selectedChannel);
        setSentChannel(channelObj?.name || selectedChannel);
        setSent(true);
      } else {
        setSendError(result.error || 'Failed to send to Slack');
      }
    } catch (err) {
      setSendError(String(err));
    }

    setSending(false);
  }, [selectedChannel, summary, sessionId, accountName, channels, dealTeam]);

  // Reset state when dialog closes
  const handleClose = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setSent(false);
      setSendError(null);
    }
    onOpenChange(isOpen);
  }, [onOpenChange]);

  const selectedChannelObj = channels.find(ch => ch.id === selectedChannel);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] bg-[#1a1528] border-[#2a2440] p-0 gap-0 overflow-hidden">
        {/* Header bar — Slack-branded */}
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-[15px] font-semibold text-slate-100 flex items-center gap-2.5">
            <SlackIcon className="h-[18px] w-[18px] text-slate-300" />
            Share to Slack
          </DialogTitle>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
            Post executive summary and PDF readout to a channel
          </p>
        </DialogHeader>

        {/* Success state */}
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-10 px-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-slate-200">
              Posted to #{sentChannel}
            </p>
            <p className="text-[11px] text-slate-500 text-center max-w-[280px] leading-relaxed">
              Your TDR readout has been shared with the executive summary and PDF attachment.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 text-[11px] h-7 px-4 border-[#2a2440] text-slate-400 hover:text-slate-200"
              onClick={() => handleClose(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-4">
            {/* Channel Picker — top position for quick selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-slate-500 font-medium tracking-wide">
                  Channel
                </label>
                {channelsError && (
                  <button
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                    onClick={loadChannels}
                  >
                    <RefreshCw className="h-2.5 w-2.5" />
                    retry
                  </button>
                )}
              </div>
              {channelsLoading ? (
                <div className="flex items-center gap-2 text-[11px] text-slate-500 h-8">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading channels...
                </div>
              ) : channelsError ? (
                <div className="flex items-center gap-2 text-[11px] text-rose-400/80 h-8">
                  <AlertCircle className="h-3 w-3" />
                  Could not load channels
                </div>
              ) : (
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger className="bg-[#110e1d] border-[#2a2440] text-[12px] text-slate-300 h-8 rounded-md focus:ring-1 focus:ring-[#4A154B]/40">
                    <SelectValue placeholder="Select a channel..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1528] border-[#2a2440] max-h-56">
                    {channels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id} className="text-[12px] text-slate-300 py-1.5">
                        <span className="flex items-center gap-1.5">
                          {ch.isPrivate ? (
                            <Lock className="h-3 w-3 text-slate-500 shrink-0" />
                          ) : (
                            <Hash className="h-3 w-3 text-slate-500 shrink-0" />
                          )}
                          {ch.name}
                          <span className="text-[10px] text-slate-600 ml-0.5">
                            {ch.memberCount}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-[#2a2440]" />

            {/* Executive Summary — formatted message preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-slate-500 font-medium tracking-wide">
                  Message preview
                </label>
                <div className="flex items-center gap-2">
                  {/* Edit / Preview toggle */}
                  <button
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? (
                      <Eye className="h-2.5 w-2.5" />
                    ) : (
                      <Pencil className="h-2.5 w-2.5" />
                    )}
                    {isEditing ? 'preview' : 'edit'}
                  </button>
                  {/* Regenerate */}
                  <button
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-400 transition-colors disabled:opacity-30"
                    onClick={handleRegenerateSummary}
                    disabled={summaryLoading}
                  >
                    {summaryLoading ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <CortexSparkle className="h-2.5 w-2.5" />
                    )}
                    {summaryLoading ? 'generating...' : 'regenerate'}
                  </button>
                </div>
              </div>

              {/* Slack-style message container */}
              <div className="rounded-md border border-[#2a2440] bg-[#110e1d] overflow-hidden">
                {/* Simulated Slack message header */}
                <div className="px-3 py-2 border-b border-[#2a2440]/60 flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-[#4A154B]/30 flex items-center justify-center">
                    <SlackIcon className="h-3 w-3 text-slate-400" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">TDR Deal Inspect</span>
                  <span className="text-[10px] text-slate-600 ml-auto">
                    {accountName}
                  </span>
                </div>

                {/* Body — formatted preview OR raw textarea */}
                {summaryLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-[11px] text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating summary with Cortex AI...
                  </div>
                ) : isEditing ? (
                  <Textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Executive summary..."
                    className="min-h-[180px] max-h-[260px] text-[12px] leading-[1.7] bg-transparent border-0 text-slate-300 placeholder:text-slate-600 resize-none rounded-none px-3 py-2.5 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono"
                  />
                ) : (
                  <div className="px-3 py-3 min-h-[120px] max-h-[260px] overflow-y-auto custom-scrollbar">
                    <FormattedSummary text={summary} />
                  </div>
                )}

                {/* Bottom bar — attachment + helper text */}
                <div className="px-3 py-1.5 border-t border-[#2a2440]/40 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                    <Paperclip className="h-2.5 w-2.5" />
                    <span>PDF readout attached</span>
                  </div>
                  <span className="text-[10px] text-slate-600 italic">
                    Cortex AI {isEditing ? '— editing' : '— formatted'}
                  </span>
                </div>
              </div>
            </div>

            {/* Error display */}
            {sendError && (
              <div className="flex items-start gap-2 text-[11px] text-rose-400/80 bg-rose-500/5 rounded-md px-3 py-2 border border-rose-500/10">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}

            {/* Send button — Slack aubergine color */}
            <Button
              className="w-full h-9 text-[12px] font-medium gap-2 rounded-md transition-all
                         bg-[#4A154B] hover:bg-[#611f69] active:bg-[#3a1040]
                         text-white border-0 shadow-sm"
              onClick={handleSend}
              disabled={sending || !selectedChannel || !summary.trim() || summaryLoading}
            >
              {sending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <SlackIcon className="h-3.5 w-3.5" />
                  Send to{selectedChannelObj ? ` #${selectedChannelObj.name}` : ' Slack'}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
