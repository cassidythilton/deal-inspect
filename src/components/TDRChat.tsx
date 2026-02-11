/**
 * TDRChat — Sprint 8: Multi-provider inline chat for TDR Workspace
 *
 * Embeds a conversational AI experience in the right panel of the TDR
 * workspace. Supports Cortex (5 models), Perplexity (2 models), and
 * Domo AI (native). Context-aware: assembles system prompts from deal
 * info, TDR inputs, cached intel, and the current TDR step.
 *
 * Typography matches the TDR Brief renderer (text-xs, slate-400, leading-relaxed).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Loader2,
  Bot,
  User,
  ChevronDown,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Snowflake,
  Search,
  Cpu,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  tdrChat,
  type ChatMessage,
  type SendMessageResult,
} from '@/lib/tdrChat';
import {
  LLM_PROVIDERS,
  PROVIDER_LIST,
  type ProviderKey,
  type ProviderIconKey,
} from '@/config/llmProviders';
import type { Deal, TDRStep } from '@/types/tdr';
import { filesetIntel } from '@/lib/filesetIntel';
import { getAppSettings } from '@/lib/appSettings';

// ─── Props ───────────────────────────────────────────────────────────────────

interface TDRChatProps {
  deal: Deal;
  sessionId?: string;
  activeStep?: TDRStep;
}

// ─── Icon mapping ────────────────────────────────────────────────────────────

const ICON_MAP: Record<ProviderIconKey, React.FC<{ className?: string }>> = {
  snowflake: Snowflake,
  search: Search,
  cpu: Cpu,
};

function ProviderIcon({
  iconKey,
  className = 'h-3.5 w-3.5',
}: {
  iconKey: ProviderIconKey;
  className?: string;
}) {
  const Icon = ICON_MAP[iconKey] || Bot;
  return <Icon className={className} />;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SUGGESTION_CHIPS = [
  {
    label: 'Summarize deal risks',
    prompt:
      'What are the key risks in this deal and how should we address them in the TDR?',
  },
  {
    label: 'Competitive positioning',
    prompt: 'How should we position against the competitors in this deal?',
  },
  {
    label: 'Technical fit analysis',
    prompt:
      "Analyze the technical fit between Domo and this account's current architecture.",
  },
  {
    label: 'Next steps',
    prompt:
      'What should be our recommended next steps for this TDR?',
  },
];

const PROVIDER_COLORS: Record<
  ProviderKey,
  { bg: string; text: string; border: string }
> = {
  cortex: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/20',
  },
  perplexity: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/20',
  },
  domo: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
};

// ─── Markdown renderer (matches TDR Brief) ───────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let idx = 0;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    if (m[2]) {
      parts.push(
        <strong key={`b${idx++}`} className="font-semibold text-slate-200">
          {m[2]}
        </strong>,
      );
    } else if (m[3]) {
      parts.push(
        <em key={`i${idx++}`} className="italic text-slate-300">
          {m[3]}
        </em>,
      );
    } else if (m[4]) {
      parts.push(
        <code
          key={`c${idx++}`}
          className="px-1 py-0.5 rounded bg-[#2a2540] text-violet-300 text-[10px]"
        >
          {m[4]}
        </code>,
      );
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? <>{parts}</> : text;
}

function renderMarkdown(text: string, keyPrefix = 'md'): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let paraBuffer: string[] = [];

  const flushPara = () => {
    if (paraBuffer.length === 0) return;
    const raw = paraBuffer.join(' ');
    elements.push(
      <p key={`${keyPrefix}-p${elements.length}`} className="mb-1.5 last:mb-0">
        {renderInline(raw)}
      </p>,
    );
    paraBuffer = [];
  };

  const flushList = () => {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul
        key={`${keyPrefix}-ul${elements.length}`}
        className="mb-1.5 list-disc pl-4 space-y-0.5 last:mb-0"
      >
        {listBuffer.map((item, j) => (
          <li key={j}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Heading: ### or **Section Title** at start of line alone
    const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      flushList();
      flushPara();
      elements.push(
        <h4
          key={`${keyPrefix}-h${elements.length}`}
          className="text-[11px] font-semibold text-slate-200 mt-2 mb-1 border-b border-[#322b4d] pb-1 first:mt-0"
        >
          {renderInline(headingMatch[1].replace(/\*+/g, '').trim())}
        </h4>,
      );
      continue;
    }

    // Numbered list: 1. item
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      flushPara();
      listBuffer.push(numMatch[2]);
      continue;
    }

    // Bullet: - item or * item or • item
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      flushPara();
      listBuffer.push(bulletMatch[1]);
      continue;
    }

    if (trimmed === '') {
      flushList();
      flushPara();
      continue;
    }

    flushList();
    paraBuffer.push(trimmed);
  }

  flushList();
  flushPara();
  return <>{elements}</>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TDRChat({ deal, sessionId, activeStep }: TDRChatProps) {
  // ── State ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderKey>('cortex');
  const [modelId, setModelId] = useState(LLM_PROVIDERS.cortex.defaultModelId);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [totalTokens, setTotalTokens] = useState({ in: 0, out: 0 });
  const [includeKB, setIncludeKB] = useState(true);
  const [kbContext, setKbContext] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // ── Load history on mount ──
  useEffect(() => {
    if (!sessionId) return;
    tdrChat.getHistory(sessionId).then((history) => {
      if (history.length > 0) {
        setMessages(history);
        let tokIn = 0;
        let tokOut = 0;
        for (const msg of history) {
          tokIn += msg.tokensIn || 0;
          tokOut += msg.tokensOut || 0;
        }
        setTotalTokens({ in: tokIn, out: tokOut });
      }
    });
  }, [sessionId]);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Close menus on outside click ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        providerMenuRef.current &&
        !providerMenuRef.current.contains(e.target as Node)
      ) {
        setShowProviderMenu(false);
      }
      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(e.target as Node)
      ) {
        setShowModelMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Provider / Model switching ──
  const handleProviderChange = useCallback((newProvider: ProviderKey) => {
    setProvider(newProvider);
    setModelId(LLM_PROVIDERS[newProvider].defaultModelId);
    setShowProviderMenu(false);
  }, []);

  const handleModelChange = useCallback((newModelId: string) => {
    setModelId(newModelId);
    setShowModelMenu(false);
  }, []);

  // ── Send message ──
  const handleSend = useCallback(
    async (messageText?: string) => {
      const text = (messageText || inputValue).trim();
      if (!text || !sessionId) return;

      setInputValue('');
      setError(null);
      setIsLoading(true);

      const userMsg: ChatMessage = {
        messageId: `pending-user-${Date.now()}`,
        sessionId,
        role: 'user',
        content: text,
        provider,
        modelUsed: modelId,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        // Sprint 19: If KB toggle is on, prepend fileset context to message
        let enrichedMessage = text;
        if (includeKB && kbContext) {
          enrichedMessage = `${kbContext}\n\n---\nUser Question: ${text}`;
        } else if (includeKB && (getAppSettings().filesetIds ?? []).length > 0) {
          // Try to fetch KB context on the fly for this question
          try {
            const kbResults = await filesetIntel.search(text);
            if (kbResults.matches.length > 0) {
              const ctx = filesetIntel.buildChatContext(kbResults.matches);
              setKbContext(ctx);
              enrichedMessage = `${ctx}\n\n---\nUser Question: ${text}`;
            }
          } catch (kbErr) {
            console.warn('[TDRChat] KB search failed, sending without context:', kbErr);
          }
        }

        const result: SendMessageResult = await tdrChat.sendMessage({
          sessionId,
          opportunityId: deal.id,
          accountName: deal.account,
          userMessage: enrichedMessage,
          provider,
          model: modelId,
          contextStep: activeStep?.id,
          createdBy: 'current-user',
        });

        if (result.success && result.content) {
          const assistantMsg: ChatMessage = {
            messageId:
              result.assistantMessageId || `assistant-${Date.now()}`,
            sessionId,
            role: 'assistant',
            content: result.content,
            provider: result.provider || provider,
            modelUsed: result.model || modelId,
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut,
            citedSources: result.citations,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);

          if (result.tokensIn || result.tokensOut) {
            setTotalTokens((prev) => ({
              in: prev.in + (result.tokensIn || 0),
              out: prev.out + (result.tokensOut || 0),
            }));
          }
        } else {
          setError(result.error || 'Failed to get response');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [inputValue, sessionId, deal, provider, modelId, activeStep],
  );

  // ── Keyboard handler ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Render helpers ──
  const currentProvider = LLM_PROVIDERS[provider];
  const currentModel =
    currentProvider.models.find((m) => m.id === modelId) ||
    currentProvider.models[0];

  const renderProviderBadge = (
    providerKey: string,
    modelUsed?: string | null,
  ) => {
    const pKey = (providerKey || 'cortex') as ProviderKey;
    const colors = PROVIDER_COLORS[pKey] || PROVIDER_COLORS.cortex;
    const pConfig = LLM_PROVIDERS[pKey];
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
      >
        <ProviderIcon iconKey={pConfig?.icon || 'cpu'} className="h-2.5 w-2.5" />
        {modelUsed || pConfig?.label || providerKey}
      </span>
    );
  };

  // ── Render ──
  return (
    <div className="flex flex-col h-full">
      {/* ── Provider / Model Selector ── */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#2a2540]">
        {/* Provider dropdown */}
        <div className="relative" ref={providerMenuRef}>
          <button
            onClick={() => setShowProviderMenu(!showProviderMenu)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#2a2540] hover:bg-[#332d50] text-xs text-slate-300 transition-colors"
          >
            <ProviderIcon iconKey={currentProvider.icon} className="h-3 w-3" />
            <span>{currentProvider.label}</span>
            <ChevronDown className="h-2.5 w-2.5 text-slate-500" />
          </button>
          {showProviderMenu && (
            <div className="absolute top-full left-0 mt-1 w-52 rounded-lg bg-[#221D38] border border-[#3a3460] shadow-xl z-50">
              {PROVIDER_LIST.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handleProviderChange(p.key)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-[#2a2540] transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    provider === p.key
                      ? 'bg-[#2a2540] text-white'
                      : 'text-slate-400'
                  }`}
                >
                  <ProviderIcon iconKey={p.icon} className="h-3 w-3 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">{p.label}</div>
                    <div className="text-[10px] text-slate-600 truncate">
                      {p.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Model dropdown */}
        {currentProvider.models.length > 1 && (
          <div className="relative" ref={modelMenuRef}>
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#2a2540] hover:bg-[#332d50] text-xs text-slate-400 transition-colors"
            >
              <span>{currentModel.label}</span>
              <ChevronDown className="h-2.5 w-2.5 text-slate-500" />
            </button>
            {showModelMenu && (
              <div className="absolute top-full left-0 mt-1 w-52 rounded-lg bg-[#221D38] border border-[#3a3460] shadow-xl z-50">
                {currentProvider.models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleModelChange(m.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-[#2a2540] transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      modelId === m.id
                        ? 'bg-[#2a2540] text-white'
                        : 'text-slate-400'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{m.label}</div>
                      <div className="text-[10px] text-slate-600 truncate">
                        {m.description}
                      </div>
                    </div>
                    {m.costTier && (
                      <span
                        className={`text-[9px] px-1 py-px rounded ${
                          m.costTier === 'low'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : m.costTier === 'medium'
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {m.costTier}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Token counter */}
        <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-600">
          <Sparkles className="h-2.5 w-2.5" />
          <span>
            {(totalTokens.in + totalTokens.out).toLocaleString()} tokens
          </span>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="rounded-full bg-[#221D38] p-2.5 border border-[#2a2540]">
              <MessageSquare className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <h3 className="text-xs font-medium text-slate-300">
                TDR Chat
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-[260px] leading-relaxed">
                Ask questions about this deal using AI. Context from your
                TDR inputs and account intelligence is included automatically.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 max-w-sm justify-center mt-1">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleSend(chip.prompt)}
                  disabled={!sessionId}
                  className="px-2.5 py-1 rounded-full bg-[#221D38] border border-[#2a2540] text-[10px] text-slate-400 hover:bg-[#2a2540] hover:text-slate-200 transition-colors disabled:opacity-30"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg) => (
          <div
            key={msg.messageId}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="shrink-0 mt-px">
                <div className="h-5 w-5 rounded-full bg-[#221D38] border border-[#2a2540] flex items-center justify-center">
                  <Bot className="h-3 w-3 text-slate-500" />
                </div>
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-lg px-2.5 py-2 ${
                msg.role === 'user'
                  ? 'bg-violet-600/20 border border-violet-500/15'
                  : 'bg-[#221D38] border border-[#2a2540]'
              }`}
            >
              {msg.role === 'assistant' && msg.provider && (
                <div className="mb-1">
                  {renderProviderBadge(msg.provider, msg.modelUsed)}
                </div>
              )}
              {/* Content — matches TDR Brief typography */}
              <div
                className={`text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'text-slate-200'
                    : 'text-slate-400'
                }`}
              >
                {msg.role === 'assistant'
                  ? renderMarkdown(msg.content, msg.messageId)
                  : msg.content}
              </div>
              {/* Citations */}
              {msg.citedSources &&
                ((Array.isArray(msg.citedSources) &&
                  msg.citedSources.length > 0) ||
                  (typeof msg.citedSources === 'string' &&
                    msg.citedSources !== '[]')) && (
                  <div className="mt-1.5 pt-1.5 border-t border-[#2a2540]">
                    <div className="text-[9px] text-slate-600 mb-0.5 font-medium uppercase tracking-wide">
                      Sources
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(typeof msg.citedSources === 'string'
                        ? JSON.parse(msg.citedSources)
                        : msg.citedSources
                      ).map((url: string, i: number) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-violet-400 hover:text-violet-300 underline underline-offset-2"
                        >
                          [{i + 1}]
                        </a>
                      ))}
                    </div>
                  </div>
                )}
            </div>
            {msg.role === 'user' && (
              <div className="shrink-0 mt-px">
                <div className="h-5 w-5 rounded-full bg-violet-600/20 border border-violet-500/15 flex items-center justify-center">
                  <User className="h-3 w-3 text-violet-400" />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading */}
        {isLoading && (
          <div className="flex gap-2">
            <div className="shrink-0 mt-px">
              <div className="h-5 w-5 rounded-full bg-[#221D38] border border-[#2a2540] flex items-center justify-center">
                <Bot className="h-3 w-3 text-slate-500" />
              </div>
            </div>
            <div className="bg-[#221D38] border border-[#2a2540] rounded-lg px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-[11px]">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/8 border border-red-500/15 text-[11px] text-red-400">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className="px-3 py-2 border-t border-[#2a2540]">
        <div className="flex gap-1.5 items-end">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !sessionId}
            placeholder={
              sessionId
                ? `Ask ${currentProvider.label} about this deal...`
                : 'Start a TDR session to chat'
            }
            rows={1}
            className="flex-1 resize-none rounded-md bg-[#221D38] border border-[#2a2540] px-2.5 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/40 disabled:opacity-40 min-h-[32px] max-h-[100px]"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height =
                Math.min(target.scrollHeight, 100) + 'px';
            }}
          />
          <Button
            size="sm"
            disabled={!inputValue.trim() || isLoading || !sessionId}
            onClick={() => handleSend()}
            className="h-8 w-8 shrink-0 rounded-md bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 p-0"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-600">
              Shift+Enter for new line
            </span>
            {/* Sprint 19: Knowledge Base toggle */}
            {(getAppSettings().filesetIds ?? []).length > 0 && (
              <button
                onClick={() => setIncludeKB(!includeKB)}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] transition-colors ${
                  includeKB
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                    : 'bg-[#221D38] text-slate-600 border border-[#2a2540]'
                }`}
                title={includeKB ? 'Knowledge base context included' : 'Knowledge base context excluded'}
              >
                <BookOpen className="h-2.5 w-2.5" />
                KB
              </button>
            )}
          </div>
          {activeStep && (
            <span className="text-[9px] text-slate-600">
              Context: {activeStep.title}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
