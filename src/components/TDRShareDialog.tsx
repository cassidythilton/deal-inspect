/**
 * TDR Share Dialog — Sprint 14
 *
 * Allows the user to share a TDR readout to Slack with an AI-generated
 * executive summary and attached PDF.
 *
 * Flow:
 *   1. Open dialog → auto-generate executive summary via Cortex
 *   2. User can edit summary before sending
 *   3. Pick a Slack channel from the channel picker
 *   4. Click "Send to Slack" → uploads PDF + posts Block Kit message
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Send,
  Sparkles,
  Hash,
  Lock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { tdrReadout } from '@/lib/tdrReadout';
import type { SlackChannel } from '@/lib/tdrReadout';

interface TDRShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  accountName: string;
}

export function TDRShareDialog({
  open,
  onOpenChange,
  sessionId,
  accountName,
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

  // Load channels when dialog opens
  useEffect(() => {
    if (!open) return;
    setSent(false);
    setSendError(null);

    const loadChannels = async () => {
      setChannelsLoading(true);
      setChannelsError(null);
      try {
        const result = await tdrReadout.getSlackChannels();
        if (result.success) {
          setChannels(result.channels);
          // Restore last-used channel from localStorage
          const lastChannel = localStorage.getItem('tdr-slack-default-channel');
          if (lastChannel && result.channels.some(ch => ch.id === lastChannel)) {
            setSelectedChannel(lastChannel);
          }
        } else {
          setChannelsError(result.error || 'Failed to load channels');
        }
      } catch (err) {
        setChannelsError(String(err));
      }
      setChannelsLoading(false);
    };

    loadChannels();
  }, [open]);

  // Auto-generate summary when dialog opens (if not already generated)
  useEffect(() => {
    if (!open || summaryGenerated || summaryLoading) return;

    const generateSummary = async () => {
      setSummaryLoading(true);
      try {
        const result = await tdrReadout.generateReadoutSummary(sessionId);
        if (result.success && result.summary) {
          setSummary(result.summary);
          setSummaryGenerated(true);
        }
      } catch (err) {
        console.error('[ShareDialog] Summary generation failed:', err);
      }
      setSummaryLoading(false);
    };

    generateSummary();
  }, [open, sessionId, summaryGenerated, summaryLoading]);

  // Regenerate summary
  const handleRegenerateSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryGenerated(false);
    try {
      const result = await tdrReadout.generateReadoutSummary(sessionId);
      if (result.success && result.summary) {
        setSummary(result.summary);
        setSummaryGenerated(true);
      }
    } catch (err) {
      console.error('[ShareDialog] Summary regeneration failed:', err);
    }
    setSummaryLoading(false);
  }, [sessionId]);

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
      );

      if (result.success) {
        // Save last-used channel
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
  }, [selectedChannel, summary, sessionId, accountName, channels]);

  // Reset state when dialog closes
  const handleClose = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      // Don't reset summary so it's available if re-opened
      setSent(false);
      setSendError(null);
    }
    onOpenChange(isOpen);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] bg-[#1B1630] border-[#2a2540]">
        <DialogHeader>
          <DialogTitle className="text-slate-100 flex items-center gap-2">
            <Send className="h-4 w-4 text-violet-400" />
            Share to Slack
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Send an executive summary and PDF readout to a Slack channel.
          </DialogDescription>
        </DialogHeader>

        {/* Success state */}
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-slate-200">
              Sent to #{sentChannel}
            </p>
            <p className="text-xs text-slate-500 text-center max-w-xs">
              The TDR readout has been posted with the executive summary and PDF attachment.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-xs h-7"
              onClick={() => handleClose(false)}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Executive Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  Executive Summary
                </Label>
                <button
                  className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-40"
                  onClick={handleRegenerateSummary}
                  disabled={summaryLoading}
                >
                  {summaryLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {summaryLoading ? 'Generating…' : 'Regenerate'}
                </button>
              </div>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={summaryLoading ? 'Generating executive summary with Cortex AI…' : 'Executive summary will appear here…'}
                className="min-h-[120px] text-xs bg-[#13101f] border-[#2a2540] text-slate-300 placeholder:text-slate-600 resize-none"
                disabled={summaryLoading}
              />
              <p className="text-[10px] text-slate-600">
                <Sparkles className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" />
                AI-generated via Cortex · Edit before sending
              </p>
            </div>

            {/* Channel Picker */}
            <div className="space-y-2">
              <Label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Slack Channel
              </Label>
              {channelsLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading channels…
                </div>
              ) : channelsError ? (
                <div className="flex items-center gap-2 text-xs text-rose-400 py-2">
                  <AlertCircle className="h-3 w-3" />
                  {channelsError}
                </div>
              ) : (
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger className="bg-[#13101f] border-[#2a2540] text-xs text-slate-300 h-9">
                    <SelectValue placeholder="Select a channel…" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1B1630] border-[#2a2540] max-h-60">
                    {channels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id} className="text-xs text-slate-300">
                        <span className="flex items-center gap-1.5">
                          {ch.isPrivate ? (
                            <Lock className="h-3 w-3 text-slate-500" />
                          ) : (
                            <Hash className="h-3 w-3 text-slate-500" />
                          )}
                          {ch.name}
                          <span className="text-[10px] text-slate-600 ml-1">
                            ({ch.memberCount})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* PDF attachment indicator */}
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-[#13101f] rounded-md px-3 py-2 border border-[#2a2540]">
              <FileText className="h-3.5 w-3.5 text-violet-400/60" />
              <span>PDF readout will be attached automatically</span>
            </div>

            {/* Error display */}
            {sendError && (
              <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/5 rounded-md px-3 py-2 border border-rose-500/15">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}

            {/* Send button */}
            <Button
              className="w-full h-9 text-xs gap-2 bg-violet-600 hover:bg-violet-500 text-white"
              onClick={handleSend}
              disabled={sending || !selectedChannel || !summary.trim() || summaryLoading}
            >
              {sending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending to Slack…
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send to Slack
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

