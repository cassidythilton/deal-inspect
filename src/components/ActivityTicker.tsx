import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, CheckCircle2, PenLine, Activity, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { snowflakeStore, type ActivityEvent } from '@/lib/snowflakeStore';
import { useDomoUser } from '@/hooks/useDomoUser';

const LS_LAST_SEEN_KEY = 'dealinspect:lastSeen';
const POLL_INTERVAL_MS = 90_000;
const ROTATE_INTERVAL_MS = 5_000;
const NEW_FADE_MS = 30_000;

function parseTimestamp(ts: string): number {
  const raw = parseFloat(ts);
  if (!isNaN(raw) && raw > 1e9 && raw < 1e12) return raw * 1000;
  if (ts.includes('T')) return new Date(ts).getTime();
  return NaN;
}

function relativeTime(ts: string): string {
  const now = Date.now();
  const then = parseTimestamp(ts);
  if (isNaN(then)) return '';
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-cyan-500', 'bg-amber-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-blue-500', 'bg-orange-500', 'bg-teal-500',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const EVENT_META = {
  started: { icon: Play, label: 'started TDR on', color: 'text-blue-400', bg: 'bg-blue-500/15' },
  completed: { icon: CheckCircle2, label: 'completed TDR on', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  inputs: { icon: PenLine, label: 'saved inputs on', color: 'text-violet-400', bg: 'bg-violet-500/15' },
} as const;

function formatInlineMessage(e: ActivityEvent): { user: string; verb: string; target: string } {
  const user = e.userName === 'current-user' ? 'Someone' : e.userName;
  const target = truncate(e.accountName || e.opportunityName || 'a deal', 24);
  const meta = EVENT_META[e.type] || EVENT_META.started;
  const verb = e.type === 'inputs'
    ? `saved ${e.count} input${e.count > 1 ? 's' : ''} on`
    : meta.label;
  return { user, verb, target };
}

export function ActivityTicker() {
  const { user } = useDomoUser();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(() => {
    const stored = localStorage.getItem(LS_LAST_SEEN_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const [mountedAt] = useState(Date.now);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const rotateRef = useRef<ReturnType<typeof setInterval>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchEvents = useCallback(async () => {
    if (!user.displayName) return;
    try {
      const result = await snowflakeStore.getRecentActivity(user.displayName);
      setEvents(result);
    } catch {
      // silent — ambient feature
    }
  }, [user.displayName]);

  useEffect(() => {
    fetchEvents();
    pollRef.current = setInterval(fetchEvents, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetchEvents]);

  useEffect(() => {
    const handleUnload = () => {
      localStorage.setItem(LS_LAST_SEEN_KEY, String(Date.now()));
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLastSeen(Date.now());
    }, NEW_FADE_MS);
    return () => clearTimeout(timer);
  }, [mountedAt]);

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen]);

  useEffect(() => {
    if (events.length <= 1 || panelOpen) {
      clearInterval(rotateRef.current);
      return;
    }
    rotateRef.current = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIdx(prev => (prev + 1) % events.length);
        setIsTransitioning(false);
      }, 200);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(rotateRef.current);
  }, [events.length, panelOpen]);

  if (events.length === 0) return null;

  const current = events[activeIdx % events.length];
  if (!current) return null;

  const eventTs = parseTimestamp(current.timestamp);
  const isNew = !isNaN(eventTs) && eventTs > lastSeen;
  const msg = formatInlineMessage(current);
  const meta = EVENT_META[current.type] || EVENT_META.started;

  return (
    <div ref={containerRef} className="relative flex items-center gap-2 max-w-[380px]">
      {/* Inline rotating ticker — click to toggle panel */}
      <button
        type="button"
        onClick={() => setPanelOpen(prev => !prev)}
        className={cn(
          'flex items-center gap-1.5 transition-all duration-200 min-w-0 rounded-md px-1.5 py-0.5 -my-0.5',
          'hover:bg-muted/50 active:bg-muted/70',
          panelOpen && 'bg-muted/40',
        )}
      >
        {isNew && (
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
        )}
        <div className={cn(
          'flex items-center gap-1 transition-all duration-200 min-w-0',
          isTransitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0',
        )}>
          <meta.icon className={cn('h-2.5 w-2.5 shrink-0 opacity-60', meta.color)} />
          <span className="text-[10px] text-muted-foreground/60 truncate">
            <span className="font-medium text-foreground/50">{msg.user.split(' ')[0]}</span>
            {' '}{msg.verb}{' '}
            <span className="font-medium text-foreground/50">{msg.target}</span>
          </span>
          <span className="text-[9px] text-muted-foreground/25 shrink-0 tabular-nums">
            {relativeTime(current.timestamp)}
          </span>
        </div>
        {events.length > 1 && !panelOpen && (
          <span className="text-[9px] text-muted-foreground/20 shrink-0 tabular-nums">
            +{events.length - 1}
          </span>
        )}
      </button>

      {/* Panel — dark mode, click-pinned */}
      {panelOpen && events.length > 0 && (
        <div className="absolute top-full right-0 mt-2 z-50 w-[340px] rounded-lg border border-white/[0.06] bg-[#1e1b2e] shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-white/[0.06]">
            <Activity className="h-3 w-3 text-violet-400/60" />
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
              Team Activity
            </span>
            <span className="ml-auto text-[10px] text-white/20 tabular-nums mr-1">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPanelOpen(false); }}
              className="p-0.5 rounded hover:bg-white/10 transition-colors"
            >
              <X className="h-3 w-3 text-white/30 hover:text-white/60" />
            </button>
          </div>

          {/* Event list */}
          <div className="py-1 max-h-[320px] overflow-y-auto">
            {events.slice(0, 10).map((e, i) => {
              const EvMeta = EVENT_META[e.type] || EVENT_META.started;
              const EvIcon = EvMeta.icon;
              const eTs = parseTimestamp(e.timestamp);
              const eIsNew = !isNaN(eTs) && eTs > lastSeen;
              const eMsg = formatInlineMessage(e);
              const initials = getInitials(eMsg.user);

              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2.5 px-3.5 py-2.5 transition-colors',
                    eIsNew ? 'bg-cyan-400/[0.04]' : 'hover:bg-white/[0.03]',
                  )}
                >
                  {/* Avatar */}
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ring-1 ring-white/10',
                    avatarColor(eMsg.user),
                  )}>
                    <span className="text-[10px] font-bold text-white leading-none">{initials}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-white/85 truncate">
                        {eMsg.user}
                      </span>
                      {eIsNew && (
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={cn('flex items-center gap-1 rounded-md px-1.5 py-0.5', EvMeta.bg)}>
                        <EvIcon className={cn('h-2.5 w-2.5', EvMeta.color)} />
                        <span className={cn('text-[10px] font-semibold', EvMeta.color)}>
                          {e.type === 'inputs' ? `${e.count} input${e.count > 1 ? 's' : ''}` : e.type}
                        </span>
                      </div>
                      <span className="text-[11px] text-white/35 truncate">
                        {eMsg.target}
                      </span>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <span className="text-[10px] text-white/20 shrink-0 tabular-nums mt-1">
                    {relativeTime(e.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-3.5 py-2 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-[9px] text-white/15 tracking-wider uppercase">
              Last 7 days · auto-refreshes
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
