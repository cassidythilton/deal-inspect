/**
 * TopBar Component
 * Main filter bar with Manager, SE Manager, SE, Quarter, and Priority filters
 *
 * Dropdown styling: light, legible backgrounds — no dark fills.
 * Selected states use tinted backgrounds with subtle borders.
 */

import { User, Users, Filter, X, Check, CheckCircle2 } from 'lucide-react';
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
import { ALLOWED_MANAGERS, TDR_PRIORITY_OPTIONS } from '@/lib/constants';

export interface SEFilterOptions {
  seManagers: string[];
  salesConsultants: string[];
  pocSalesConsultants: string[];
  forecastManagers: string[];
  quarters: string[];
}

export interface SEFilterState {
  selectedSEManager: string | null;  // SE Manager selection (dedicated dropdown)
  selectedSE: string | null;         // Individual SE selection (with prefix se: or poc:)
  selectedManager: string | null;    // Forecast Manager (AE Manager)
  selectedQuarters: string[] | null; // Multi-select quarters
  selectedPriority: string | null;   // TDR Priority filter
  includeCurrentQuarter: boolean;
}

interface TopBarProps {
  activeView?: 'recommended' | 'agenda' | 'all';
  onViewChange?: (view: 'recommended' | 'agenda' | 'all') => void;
  seFilterOptions?: SEFilterOptions;
  seFilterState?: SEFilterState;
  onSEFilterChange?: (filters: Partial<SEFilterState>) => void;
  onRefresh?: () => void;
}

export function TopBar({ 
  activeView, 
  onViewChange,
  seFilterOptions,
  seFilterState,
  onSEFilterChange,
  onRefresh,
}: TopBarProps) {
  const views = [
    { id: 'recommended' as const, label: 'Recommended' },
    { id: 'agenda' as const, label: 'Agenda' },
    { id: 'all' as const, label: 'All Eligible' },
  ];

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

  // Get filter lists
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
    : `${selectedQuarters.length} Quarters`;

  // Get display text for SE dropdown
  const getSeDisplayText = () => {
    if (!seFilterState?.selectedSE) return 'All SEs';
    const val = seFilterState.selectedSE;
    // Strip prefix
    if (val.startsWith('se:')) return val.slice(3);
    if (val.startsWith('poc:')) return val.slice(4);
    return val;
  };

  // Has any SE-related data
  const hasSeData = salesEngineers.length > 0 || pocArchitects.length > 0;

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-6">
      {/* Left: Filters */}
      <div className="flex items-center gap-2">
        {/* Filters label */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span className="text-2xs font-medium uppercase tracking-wide">Filters</span>
        </div>

        {/* Quarter multi-select */}
        <div className="relative">
          <Select
            value={selectedQuarters.join(',')}
            onValueChange={() => {}}
          >
            <SelectTrigger className={cn(
              "h-7 w-32 text-2xs font-medium shadow-none gap-2 rounded-md border",
              selectedQuarters.length > 0 
                ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" 
                : "border-border bg-secondary"
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
                      "flex items-center gap-3 px-3 py-2 cursor-pointer text-sm hover:bg-accent rounded-md mx-1 my-0.5",
                      isSelected && "bg-accent"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleQuarter(q);
                    }}
                  >
                    <div className={cn(
                      "h-4 w-4 border-2 rounded flex items-center justify-center transition-colors",
                      isSelected ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40"
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

        {/* Include Current indicator */}
        {seFilterState?.includeCurrentQuarter && (
          <span className="text-2xs font-medium text-primary px-2 py-0.5 bg-primary/10 rounded-full">
            Incl. Current
          </span>
        )}

        <div className="h-4 w-px bg-border" />

        {/* Manager (Forecast / AE Manager) dropdown */}
        <Select 
          value={seFilterState?.selectedManager || 'all'} 
          onValueChange={(v) => onSEFilterChange?.({ selectedManager: v === 'all' ? null : v })}
        >
          <SelectTrigger className={cn(
            "h-7 w-36 text-xs font-medium shadow-none border",
            seFilterState?.selectedManager 
              ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" 
              : "border-border bg-secondary"
          )}>
            <SelectValue placeholder="Manager" />
          </SelectTrigger>
          <SelectContent>
            {managers.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="h-4 w-px bg-border" />

        {/* SE group: SE Mgr, SE, PoC SE — inline with shared Users icon */}
        <div className="flex items-center gap-1.5">
          <Users className="h-3 w-3 text-muted-foreground" />

          {/* SE Manager dropdown */}
          {seManagers.length > 0 && (
            <Select 
              value={seFilterState?.selectedSEManager || 'all'} 
              onValueChange={(v) => onSEFilterChange?.({ selectedSEManager: v === 'all' ? null : v })}
            >
              <SelectTrigger className={cn(
                "h-7 w-28 text-2xs font-medium shadow-none border",
                seFilterState?.selectedSEManager 
                  ? "border-violet-500/50 bg-violet-500/5 text-violet-700 dark:text-violet-400" 
                  : "border-border bg-secondary"
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

          {/* SE dropdown */}
          {salesEngineers.length > 0 && (
            <Select 
              value={seFilterState?.selectedSE?.startsWith('se:') ? seFilterState.selectedSE : (seFilterState?.selectedSE && !seFilterState.selectedSE.startsWith('poc:') ? seFilterState.selectedSE : 'all')} 
              onValueChange={(v) => onSEFilterChange?.({ selectedSE: v === 'all' ? null : v })}
            >
              <SelectTrigger className={cn(
                "h-7 w-24 text-2xs font-medium shadow-none border",
                seFilterState?.selectedSE?.startsWith('se:') 
                  ? "border-sky-500/50 bg-sky-500/5 text-sky-700 dark:text-sky-400" 
                  : "border-border bg-secondary"
              )}>
                <SelectValue placeholder="SE" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All SEs</SelectItem>
                {salesEngineers.map((se) => (
                  <SelectItem key={se} value={`se:${se}`} className="text-xs">
                    {se}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* PoC SE dropdown */}
          {pocArchitects.length > 0 && (
            <Select 
              value={seFilterState?.selectedSE?.startsWith('poc:') ? seFilterState.selectedSE : 'all'} 
              onValueChange={(v) => onSEFilterChange?.({ selectedSE: v === 'all' ? null : v })}
            >
              <SelectTrigger className={cn(
                "h-7 w-24 text-2xs font-medium shadow-none border",
                seFilterState?.selectedSE?.startsWith('poc:') 
                  ? "border-teal-500/50 bg-teal-500/5 text-teal-700 dark:text-teal-400" 
                  : "border-border bg-secondary"
              )}>
                <SelectValue placeholder="PoC SE" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All PoC SEs</SelectItem>
                {pocArchitects.map((se) => (
                  <SelectItem key={se} value={`poc:${se}`} className="text-xs">
                    {se}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="h-4 w-px bg-border" />

        {/* TDR Priority Filter */}
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
          <Select 
            value={seFilterState?.selectedPriority || 'all'} 
            onValueChange={(v) => onSEFilterChange?.({ selectedPriority: v === 'all' ? null : v })}
          >
            <SelectTrigger className={cn(
              "h-7 w-32 text-xs font-medium shadow-none border",
              seFilterState?.selectedPriority 
                ? seFilterState.selectedPriority === 'critical'
                  ? "border-red-500/50 bg-red-500/5 text-red-700 dark:text-red-400"
                  : seFilterState.selectedPriority === 'high'
                  ? "border-orange-500/50 bg-orange-500/5 text-orange-700 dark:text-orange-400"
                  : "border-amber-500/50 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                : "border-border bg-secondary"
            )}>
              <SelectValue placeholder="All Deals" />
            </SelectTrigger>
            <SelectContent>
              {TDR_PRIORITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Center: View Toggle */}
      {activeView && onViewChange ? (
        <div className="flex items-center gap-0.5 rounded-md bg-secondary p-0.5">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-all',
                activeView === view.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {view.label}
            </button>
          ))}
        </div>
      ) : (
        <div />
      )}

      {/* Right: Profile */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500">
          <User className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
    </header>
  );
}
