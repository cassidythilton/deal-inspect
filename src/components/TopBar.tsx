/**
 * TopBar Component
 * Filter bar with Quarter, AE Manager, SE Manager, SE, and Agenda toggle.
 *
 * The Shadcn dropdowns provide elegant, modern filtering.
 * AG Grid column filters remain available for in-grid refinement.
 */

import { User, Users, Filter, X, Check, Pin } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ALLOWED_MANAGERS } from '@/lib/constants';

export interface SEFilterOptions {
  seManagers: string[];
  salesConsultants: string[];
  pocSalesConsultants?: string[];
  forecastManagers: string[];
  quarters: string[];
}

export interface SEFilterState {
  selectedSEManager: string | null;
  selectedSE: string | null;
  selectedManager: string | null;
  selectedQuarters: string[] | null;
  selectedPriority: string | null;
  includeCurrentQuarter: boolean;
  showAgendaOnly?: boolean;
}

interface TopBarProps {
  seFilterOptions?: SEFilterOptions;
  seFilterState?: SEFilterState;
  onSEFilterChange?: (filters: Partial<SEFilterState>) => void;
  onRefresh?: () => void;
  agendaCount?: number;
}

export function TopBar({
  seFilterOptions,
  seFilterState,
  onSEFilterChange,
  agendaCount = 0,
}: TopBarProps) {
  // Sort quarters in descending order (newest first)
  const quarters = (seFilterOptions?.quarters || [])
    .slice()
    .sort((a, b) => {
      const matchA = a.match(/(\d{4})-Q(\d)/);
      const matchB = b.match(/(\d{4})-Q(\d)/);
      if (matchA && matchB) {
        const yearDiff = parseInt(matchB[1]) - parseInt(matchA[1]);
        if (yearDiff !== 0) return yearDiff;
        return parseInt(matchB[2]) - parseInt(matchA[2]);
      }
      return b.localeCompare(a);
    });

  // Filter lists
  const managers = ALLOWED_MANAGERS;
  const salesEngineers = seFilterOptions?.salesConsultants || [];
  const pocArchitects = seFilterOptions?.pocSalesConsultants || [];
  const seManagers = seFilterOptions?.seManagers || [];

  // Multi-select quarter handling
  const selectedQuarters = seFilterState?.selectedQuarters || [];

  const toggleQuarter = (quarter: string) => {
    const current = [...selectedQuarters];
    const idx = current.indexOf(quarter);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(quarter);
    }
    onSEFilterChange?.({ selectedQuarters: current.length > 0 ? current : null });
  };

  const clearQuarters = () => {
    onSEFilterChange?.({ selectedQuarters: null });
  };

  // Get current quarter for labeling
  const getCurrentQuarter = () => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${q}`;
  };
  const currentQuarter = getCurrentQuarter();

  // Quarter display text
  const quarterDisplayText = selectedQuarters.length === 0
    ? 'All Quarters'
    : selectedQuarters.length === 1
    ? selectedQuarters[0]
    : `${selectedQuarters.length} quarters`;

  // SE display text
  const getSeDisplayText = () => {
    if (!seFilterState?.selectedSE) return 'All SEs';
    const val = seFilterState.selectedSE;
    if (val.startsWith('se:')) return val.slice(3);
    if (val.startsWith('poc:')) return val.slice(4);
    return val;
  };

  const hasSeData = salesEngineers.length > 0 || pocArchitects.length > 0;
  const showAgenda = seFilterState?.showAgendaOnly ?? false;

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-6">
      {/* Left: Filters */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span className="text-2xs font-medium uppercase tracking-wide">Scope</span>
        </div>

        {/* Quarter multi-select */}
        <div className="relative">
          <Select
            value={selectedQuarters.join(',')}
            onValueChange={() => {}}
          >
            <SelectTrigger className={cn(
              'h-7 w-32 text-2xs font-medium shadow-none gap-2 rounded-md border',
              selectedQuarters.length > 0
                ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                : 'border-border bg-secondary'
            )}>
              <span className="truncate">{quarterDisplayText}</span>
              {selectedQuarters.length > 0 && (
                <X
                  className="h-3.5 w-3.5 shrink-0 opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearQuarters();
                  }}
                />
              )}
            </SelectTrigger>
            <SelectContent className="min-w-[200px]">
              {quarters.map((q) => {
                const isSelected = selectedQuarters.includes(q);
                const isCurrent = q === currentQuarter;
                return (
                  <div
                    key={q}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 cursor-pointer text-sm hover:bg-accent rounded-md mx-1 my-0.5',
                      isSelected && 'bg-accent'
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleQuarter(q);
                    }}
                  >
                    <div className={cn(
                      'h-4 w-4 border-2 rounded flex items-center justify-center transition-colors',
                      isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40'
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="flex-1">{q}</span>
                    {isCurrent && (
                      <span className="text-xs text-emerald-600 font-medium">Current</span>
                    )}
                  </div>
                );
              })}
              {selectedQuarters.length > 0 && (
                <>
                  <div className="border-t border-border my-1 mx-2" />
                  <div
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-accent text-muted-foreground mx-1 rounded-md"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      clearQuarters();
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Clear all</span>
                  </div>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* AE Manager dropdown */}
        <Select
          value={seFilterState?.selectedManager || 'all'}
          onValueChange={(v) => onSEFilterChange?.({ selectedManager: v === 'all' ? null : v })}
        >
          <SelectTrigger className={cn(
            'h-7 w-36 text-xs font-medium shadow-none border',
            seFilterState?.selectedManager
              ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
              : 'border-border bg-secondary'
          )}>
            <SelectValue placeholder="AE Manager" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs font-medium">All AE Managers</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="h-4 w-px bg-border" />

        {/* SE group: SE Mgr + SE dropdown */}
        <div className="flex items-center gap-1.5">
          <Users className="h-3 w-3 text-muted-foreground" />

          {/* SE Manager dropdown */}
          {seManagers.length > 0 && (
            <Select
              value={seFilterState?.selectedSEManager || 'all'}
              onValueChange={(v) => onSEFilterChange?.({ selectedSEManager: v === 'all' ? null : v })}
            >
              <SelectTrigger className={cn(
                'h-7 w-28 text-2xs font-medium shadow-none border',
                seFilterState?.selectedSEManager
                  ? 'border-violet-500/50 bg-violet-500/5 text-violet-700 dark:text-violet-400'
                  : 'border-border bg-secondary'
              )}>
                <SelectValue placeholder="SE Mgr" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All SE Mgrs</SelectItem>
                {seManagers.map((mgr) => (
                  <SelectItem key={mgr} value={mgr} className="text-xs">
                    {mgr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Combined SE + PoC dropdown with groupings */}
          {hasSeData && (
            <Select
              value={seFilterState?.selectedSE || 'all'}
              onValueChange={(v) => onSEFilterChange?.({ selectedSE: v === 'all' ? null : v })}
            >
              <SelectTrigger className={cn(
                'h-7 w-28 text-2xs font-medium shadow-none border',
                seFilterState?.selectedSE
                  ? seFilterState.selectedSE.startsWith('poc:')
                    ? 'border-teal-500/50 bg-teal-500/5 text-teal-700 dark:text-teal-400'
                    : 'border-sky-500/50 bg-sky-500/5 text-sky-700 dark:text-sky-400'
                  : 'border-border bg-secondary'
              )}>
                <SelectValue placeholder="All SEs">{getSeDisplayText()}</SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[400px] min-w-[220px]">
                <SelectItem value="all" className="text-xs font-medium">All SEs</SelectItem>

                {salesEngineers.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-2xs uppercase tracking-wide text-muted-foreground px-2 py-1.5 font-semibold">
                      Sales Engineers
                    </SelectLabel>
                    {salesEngineers.map((se) => (
                      <SelectItem key={`se-${se}`} value={`se:${se}`} className="text-xs pl-4">
                        {se}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                {pocArchitects.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-2xs uppercase tracking-wide text-muted-foreground px-2 py-1.5 font-semibold">
                      PoC Architects
                    </SelectLabel>
                    {pocArchitects.map((se) => (
                      <SelectItem key={`poc-${se}`} value={`poc:${se}`} className="text-xs pl-4">
                        {se}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Agenda toggle */}
        <button
          onClick={() => onSEFilterChange?.({ showAgendaOnly: !showAgenda })}
          className={cn(
            'inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-2xs font-medium transition-all border',
            showAgenda
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
          )}
        >
          <Pin className={cn('h-3 w-3', showAgenda && 'fill-primary')} />
          Agenda{agendaCount > 0 && <span className="tabular-nums">· {agendaCount}</span>}
        </button>
      </div>

      {/* Right: Profile */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500">
          <User className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
    </header>
  );
}
