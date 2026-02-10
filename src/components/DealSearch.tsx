/**
 * DealSearch Component
 * Typeahead search across ALL deals (bypasses filters).
 * Lives above the grid as a toolbar-level control.
 *
 * ⌘K (Mac) / Ctrl+K (Windows) to focus.
 * 2+ chars triggers fuzzy match → top 10 results in dropdown.
 * Click result → navigate to /workspace?deal={id}
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Deal } from '@/types/tdr';

interface DealSearchProps {
  /** Full unfiltered deal set for search */
  allDeals: Deal[];
  className?: string;
}

/** Simple fuzzy-ish match: all query tokens must appear in the target string */
function fuzzyMatch(query: string, target: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const targetLower = target.toLowerCase();
  return tokens.every(t => targetLower.includes(t));
}

export function DealSearch({ allDeals, className }: DealSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Search results
  const results = useMemo(() => {
    if (query.length < 2) return [];
    return allDeals
      .filter(deal => {
        const searchStr = [
          deal.account,
          deal.dealName,
          deal.id,
          deal.owner,
          deal.accountExecutive,
          deal.salesConsultant,
          deal.pocSalesConsultant,
        ].filter(Boolean).join(' ');
        return fuzzyMatch(query, searchStr);
      })
      .slice(0, 10);
  }, [query, allDeals]);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleSelect = useCallback((deal: Deal) => {
    navigate(`/workspace?deal=${deal.id}`);
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }, [navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  }, [isOpen, results, selectedIndex, handleSelect]);

  const formatACV = (acv: number) => {
    if (acv >= 1000000) return `$${(acv / 1000000).toFixed(1)}M`;
    if (acv >= 1000) return `$${Math.round(acv / 1000)}K`;
    return `$${acv}`;
  };

  const getShortStage = (stage: string) => {
    const lower = stage.toLowerCase();
    if (lower.includes('determine') || lower.includes('discovery')) return 'S2';
    if (lower.includes('demonstrate') || lower.includes('validation')) return 'S3';
    if (lower.includes('negotiate') || lower.includes('proposal')) return 'S4';
    if (lower.includes('close') || lower.includes('closing')) return 'S5';
    const match = stage.match(/^(\d+):/);
    return match ? `S${match[1]}` : 'S?';
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length >= 2) setIsOpen(true);
          }}
          onFocus={() => { if (query.length >= 2) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search all deals…"
          className={cn(
            'h-8 w-64 rounded-md border border-border/60 bg-background pl-9 pr-16 text-xs',
            'placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring/40',
            'transition-all focus:w-80'
          )}
        />
        {/* Shortcut badge or clear button */}
        {query ? (
          <button
            onClick={() => { setQuery(''); setIsOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-accent"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ) : (
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 bg-secondary rounded px-1.5 py-0.5 font-mono">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 min-w-[400px] max-w-[500px] rounded-md border border-border/60 bg-card shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">No deals found for "{query}"</p>
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {results.map((deal, i) => (
                <div
                  key={deal.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                    i === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50',
                    i > 0 && 'border-t border-border/30'
                  )}
                  onClick={() => handleSelect(deal)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{deal.account}</p>
                    <p className="text-xs text-muted-foreground truncate">{deal.dealName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-2xs text-muted-foreground font-mono">{getShortStage(deal.stage)}</span>
                    <span className="text-xs font-medium tabular-nums">{formatACV(deal.acv)}</span>
                    {deal.owner && (
                      <span className="text-2xs text-muted-foreground truncate max-w-[80px]">{deal.owner}</span>
                    )}
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-border/40 px-3 py-1.5 bg-secondary/30 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {results.length} result{results.length !== 1 ? 's' : ''} · Searching {allDeals.length.toLocaleString()} deals
            </span>
            <span className="text-[10px] text-muted-foreground">
              ↑↓ navigate · ↵ select · esc close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

