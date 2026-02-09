/**
 * TDRChat — Sprint 8: Multi-provider inline chat for TDR Workspace
 *
 * Embeds a conversational AI experience in the right panel of the TDR
 * workspace. Supports Cortex (5 models), Perplexity (2 models), and
 * Domo AI (native). Context-aware: assembles system prompts from deal
 * info, TDR inputs, cached intel, and the current TDR step.
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
} from '@/config/llmProviders';
import type { Deal, TDRStep } from '@/types/tdr';

// ─── Props ───────────────────────────────────────────────────────────────────

interface TDRChatProps {
  deal: Deal;
  sessionId?: string;
  activeStep?: TDRStep;
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
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-300',
    border: 'border-cyan-500/30',
  },
  perplexity: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-300',
    border: 'border-violet-500/30',
  },
  domo: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
  },
};

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

      // Optimistic: add user bubble
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
        const result: SendMessageResult = await tdrChat.sendMessage({
          sessionId,
          opportunityId: deal.id,
          accountName: deal.account,
          userMessage: text,
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
        {pConfig?.icon || '🤖'}{' '}
        {modelUsed || pConfig?.label || providerKey}
      </span>
    );
  };

  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      // Bold: **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const rendered = parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={j} className="font-semibold text-slate-100">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={j}>{part}</span>;
      });

      // Bullet
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <div key={i} className="flex gap-2 ml-2">
            <span className="text-slate-500 mt-0.5">•</span>
            <span>{rendered}</span>
          </div>
        );
      }
      // Numbered
      const numMatch = line.trim().match(/^(\d+)\.\s/);
      if (numMatch) {
        return (
          <div key={i} className="flex gap-2 ml-2">
            <span className="text-slate-400 font-medium min-w-[1rem] text-right">
              {numMatch[1]}.
            </span>
            <span>{rendered}</span>
          </div>
        );
      }
      // Empty
      if (line.trim() === '') return <div key={i} className="h-2" />;
      return <div key={i}>{rendered}</div>;
    });
  };

  // ── Render ──
  return (
    <div className="flex flex-col h-full">
      {/* ── Provider / Model Selector ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#2a2540]">
        {/* Provider dropdown */}
        <div className="relative" ref={providerMenuRef}>
          <button
            onClick={() => setShowProviderMenu(!showProviderMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#2a2540] hover:bg-[#332d50] text-sm text-slate-200 transition-colors"
          >
            <span>{currentProvider.icon}</span>
            <span>{currentProvider.label}</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>
          {showProviderMenu && (
            <div className="absolute top-full left-0 mt-1 w-56 rounded-lg bg-[#2a2540] border border-[#3a3460] shadow-xl z-50">
              {PROVIDER_LIST.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handleProviderChange(p.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#332d50] transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    provider === p.key
                      ? 'bg-[#332d50] text-white'
                      : 'text-slate-300'
                  }`}
                >
                  <span>{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{p.label}</div>
                    <div className="text-xs text-slate-500 truncate">
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#2a2540] hover:bg-[#332d50] text-sm text-slate-300 transition-colors"
            >
              <span>{currentModel.label}</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
            {showModelMenu && (
              <div className="absolute top-full left-0 mt-1 w-56 rounded-lg bg-[#2a2540] border border-[#3a3460] shadow-xl z-50">
                {currentProvider.models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleModelChange(m.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#332d50] transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      modelId === m.id
                        ? 'bg-[#332d50] text-white'
                        : 'text-slate-300'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{m.label}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {m.description}
                      </div>
                    </div>
                    {m.costTier && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          m.costTier === 'low'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : m.costTier === 'medium'
                              ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-red-500/15 text-red-400'
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
        <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
          <Sparkles className="h-3 w-3" />
          <span>
            {(totalTokens.in + totalTokens.out).toLocaleString()} tokens
          </span>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="rounded-full bg-[#2a2540] p-3">
              <MessageSquare className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-200">
                TDR Chat
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Ask questions about this deal using AI. Context from your
                TDR inputs and account intelligence is automatically
                included.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 max-w-sm justify-center mt-2">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleSend(chip.prompt)}
                  disabled={!sessionId}
                  className="px-3 py-1.5 rounded-full bg-[#2a2540] border border-[#3a3460] text-xs text-slate-300 hover:bg-[#332d50] hover:text-white transition-colors disabled:opacity-40"
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
            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="shrink-0 mt-0.5">
                <div className="h-6 w-6 rounded-full bg-[#2a2540] flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-violet-600/30 text-slate-100 border border-violet-500/20'
                  : 'bg-[#221D38] text-slate-300 border border-[#2a2540]'
              }`}
            >
              {msg.role === 'assistant' && msg.provider && (
                <div className="mb-1.5">
                  {renderProviderBadge(msg.provider, msg.modelUsed)}
                </div>
              )}
              <div className="whitespace-pre-wrap">
                {renderMessageContent(msg.content)}
              </div>
              {/* Citations */}
              {msg.citedSources &&
                ((Array.isArray(msg.citedSources) &&
                  msg.citedSources.length > 0) ||
                  (typeof msg.citedSources === 'string' &&
                    msg.citedSources !== '[]')) && (
                  <div className="mt-2 pt-2 border-t border-[#2a2540]">
                    <div className="text-[10px] text-slate-500 mb-1">
                      Sources:
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
                          className="text-[10px] text-violet-400 hover:text-violet-300 underline truncate max-w-[200px]"
                        >
                          [{i + 1}]
                        </a>
                      ))}
                    </div>
                  </div>
                )}
            </div>
            {msg.role === 'user' && (
              <div className="shrink-0 mt-0.5">
                <div className="h-6 w-6 rounded-full bg-violet-600/30 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-violet-300" />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading */}
        {isLoading && (
          <div className="flex gap-2.5">
            <div className="shrink-0 mt-0.5">
              <div className="h-6 w-6 rounded-full bg-[#2a2540] flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
            <div className="bg-[#221D38] border border-[#2a2540] rounded-xl px-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className="px-3 py-2.5 border-t border-[#2a2540]">
        <div className="flex gap-2 items-end">
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
            className="flex-1 resize-none rounded-lg bg-[#2a2540] border border-[#3a3460] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 disabled:opacity-50 min-h-[36px] max-h-[120px]"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height =
                Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          <Button
            size="sm"
            disabled={!inputValue.trim() || isLoading || !sessionId}
            onClick={() => handleSend()}
            className="h-9 w-9 shrink-0 rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-slate-600">
            Shift+Enter for new line
          </span>
          {activeStep && (
            <span className="text-[10px] text-slate-600">
              Context: {activeStep.title}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

