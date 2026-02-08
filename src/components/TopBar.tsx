/**
 * TopBar Component
 * Main filter bar with Manager, SE Manager, SE, Quarter, and Priority filters
 * Rebuilt to match original formatting exactly
 */

import { User, Users, Building2, RefreshCw, Filter, X, Check } from 'lucide-react';
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
  selectedSEManager: string | null;  // Separate SE Manager selection
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

  // Check if we have filter data
  const hasFilters = seFilterOptions && (
    seFilterOptions.seManagers.length > 0 || 
    seFilterOptions.salesConsultants.length > 0 ||
    seFilterOptions.pocSalesConsultants.length > 0
  );

  // Sort quarters in descending order (newest first)
  const quarters = (seFilterOptions?.quarters || [])
    .slice()
    .sort((a, b) => {
      // Handle formats like "2026-Q1" 
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
    const [prefix, name] = seFilterState.selectedSE.split(':');
    return name || seFilterState.selectedSE;
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      {/* Left: Filters */}
      <div className="flex items-center gap-4">
        {/* Filters label */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span className="font-semibold uppercase tracking-wider">Filters</span>
        </div>

        {/* Quarter multi-select */}
        <div className="relative">
          <Select
            value={selectedQuarters.join(',')}
            onValueChange={() => {}}
          >
            <SelectTrigger className={cn(
              "h-9 min-w-[120px] text-sm font-medium shadow-none gap-2 rounded-lg",
              selectedQuarters.length > 0 
                ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700" 
                : "bg-secondary border-transparent hover:bg-secondary/80"
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
                      isSelected ? "bg-emerald-600 border-emerald-600" : "border-muted-foreground/40"
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

        {/* Include Current toggle */}
        <button 
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
            seFilterState?.includeCurrentQuarter 
              ? "bg-secondary text-foreground shadow-sm" 
              : "bg-transparent text-muted-foreground hover:bg-secondary/50"
          )}
          onClick={() => onSEFilterChange?.({ includeCurrentQuarter: !seFilterState?.includeCurrentQuarter })}
        >
          Incl. Current
        </button>

        <div className="h-6 w-px bg-border" />

        {/* Manager (Forecast Manager) dropdown */}
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Manager:</span>
          <Select 
            value={seFilterState?.selectedManager || 'all'} 
            onValueChange={(v) => onSEFilterChange?.({ selectedManager: v === 'all' ? null : v })}
          >
            <SelectTrigger className={cn(
              "h-9 w-[160px] text-sm font-medium shadow-none rounded-lg",
              seFilterState?.selectedManager 
                ? "bg-teal-600 text-white border-teal-600 hover:bg-teal-700" 
                : "bg-secondary border-transparent hover:bg-secondary/80"
            )}>
              <SelectValue placeholder="All Managers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm font-medium">All Managers</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m} value={m} className="text-sm">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* SE Manager dropdown - SEPARATE from SE selection */}
        {seManagers.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">SE Mgr:</span>
            <Select 
              value={seFilterState?.selectedSEManager || 'all'} 
              onValueChange={(v) => onSEFilterChange?.({ selectedSEManager: v === 'all' ? null : v })}
            >
              <SelectTrigger className={cn(
                "h-9 w-[160px] text-sm font-medium shadow-none rounded-lg",
                seFilterState?.selectedSEManager 
                  ? "bg-violet-600 text-white border-violet-600 hover:bg-violet-700" 
                  : "bg-secondary border-transparent hover:bg-secondary/80"
              )}>
                <SelectValue placeholder="All SE Managers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm font-medium">All SE Managers</SelectItem>
                {seManagers.map((mgr) => (
                  <SelectItem key={mgr} value={mgr} className="text-sm">
                    {mgr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* SE Filter with grouped Sales Engineers and PoC Architects */}
        {hasFilters && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">SE:</span>
            <Select 
              value={seFilterState?.selectedSE || 'all'} 
              onValueChange={(v) => onSEFilterChange?.({ selectedSE: v === 'all' ? null : v })}
            >
              <SelectTrigger className={cn(
                "h-9 w-[180px] text-sm font-medium shadow-none rounded-lg",
                seFilterState?.selectedSE 
                  ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700" 
                  : "bg-secondary border-transparent hover:bg-secondary/80"
              )}>
                <SelectValue placeholder="All SEs">{getSeDisplayText()}</SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[400px] min-w-[240px]">
                <SelectItem value="all" className="text-sm font-medium">All SEs</SelectItem>
                
                {/* Sales Engineers Group */}
                {salesEngineers.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-xs uppercase tracking-wider text-muted-foreground px-3 py-2 font-bold bg-muted/50">
                      Sales Engineers
                    </SelectLabel>
                    {salesEngineers.map((se) => (
                      <SelectItem 
                        key={`se-${se}`} 
                        value={`se:${se}`} 
                        className="text-sm pl-5"
                      >
                        {se}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                
                {/* PoC Architects Group */}
                {pocArchitects.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-xs uppercase tracking-wider text-muted-foreground px-3 py-2 font-bold bg-muted/50">
                      PoC Architects
                    </SelectLabel>
                    {pocArchitects.map((se) => (
                      <SelectItem 
                        key={`poc-${se}`} 
                        value={`poc:${se}`} 
                        className="text-sm pl-5"
                      >
                        {se}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Refresh button */}
        <button 
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
          onClick={onRefresh}
          title="Refresh data"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>

        {/* TDR Priority Filter */}
        <Select 
          value={seFilterState?.selectedPriority || 'all'} 
          onValueChange={(v) => onSEFilterChange?.({ selectedPriority: v === 'all' ? null : v })}
        >
          <SelectTrigger className={cn(
            "h-9 w-[130px] text-sm font-medium shadow-none rounded-lg",
            seFilterState?.selectedPriority 
              ? "bg-amber-600 text-white border-amber-600 hover:bg-amber-700" 
              : "bg-secondary border-transparent hover:bg-secondary/80"
          )}>
            <SelectValue placeholder="All Deals" />
          </SelectTrigger>
          <SelectContent>
            {TDR_PRIORITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.id} value={opt.id} className="text-sm">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Center: View Toggle */}
      {activeView && onViewChange ? (
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-all',
                activeView === view.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
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
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500">
          <User className="h-4 w-4 text-white" />
        </div>
      </div>
    </header>
  );
}
