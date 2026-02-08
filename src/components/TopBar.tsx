import { User, Users, RefreshCw, Filter, X, Check } from 'lucide-react';
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
  forecastManagers: string[];
  quarters: string[];
}

export interface SEFilterState {
  selectedSE: string | null;
  selectedManager: string | null;
  selectedQuarters: string[] | null; // Multi-select
  selectedPriority: string | null;
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

  const hasFilters = seFilterOptions && (
    seFilterOptions.seManagers.length > 0 || 
    seFilterOptions.salesConsultants.length > 0
  );

  // Get quarters from options - sort in descending order (newest first)
  const quarters = (seFilterOptions?.quarters || [])
    .slice()
    .sort((a, b) => {
      // Parse quarter strings like "Q1 2026"
      const [qA, yearA] = a.split(' ');
      const [qB, yearB] = b.split(' ');
      const yearDiff = parseInt(yearB) - parseInt(yearA);
      if (yearDiff !== 0) return yearDiff;
      return parseInt(qB.replace('Q', '')) - parseInt(qA.replace('Q', ''));
    });

  // Filter managers to only allowed ones
  const managers = ALLOWED_MANAGERS;

  // Get SEs that belong to deals from allowed managers
  const allSEs = seFilterOptions?.salesConsultants || [];
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

  // Get current quarter label for display
  const getCurrentQuarter = () => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `Q${q} ${now.getFullYear()}`;
  };
  const currentQuarter = getCurrentQuarter();

  // Quarter display text
  const quarterDisplayText = selectedQuarters.length === 0 
    ? 'All Quarters'
    : selectedQuarters.length === 1
    ? selectedQuarters[0]
    : `${selectedQuarters.length} Quarters`;

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-6">
      {/* Left: Filters */}
      <div className="flex items-center gap-3">
        {/* Filters label with icon */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span className="font-medium">FILTERS</span>
        </div>

        {/* Quarter multi-select dropdown */}
        <div className="relative">
          <Select
            value={selectedQuarters.join(',')}
            onValueChange={() => {}} // Handled by toggleQuarter
          >
            <SelectTrigger className={cn(
              "h-8 w-28 text-xs font-medium shadow-none gap-1",
              selectedQuarters.length > 0 
                ? "border-none bg-secondary" 
                : "border-none bg-secondary"
            )}>
              <span className="truncate">{quarterDisplayText}</span>
            </SelectTrigger>
            <SelectContent className="min-w-[180px]">
              {quarters.map((q) => {
                const isSelected = selectedQuarters.includes(q);
                const isCurrent = q === currentQuarter;
                return (
                  <div
                    key={q}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 cursor-pointer text-sm hover:bg-accent rounded-sm",
                      isSelected && "bg-accent"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleQuarter(q);
                    }}
                  >
                    <div className={cn(
                      "h-4 w-4 border rounded flex items-center justify-center",
                      isSelected ? "bg-primary border-primary" : "border-border"
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span>{q}</span>
                    {isCurrent && (
                      <span className="ml-auto text-xs text-muted-foreground">Current</span>
                    )}
                  </div>
                );
              })}
              {selectedQuarters.length > 0 && (
                <>
                  <div className="border-t border-border my-1" />
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-sm hover:bg-accent text-muted-foreground"
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
          {selectedQuarters.length > 0 && (
            <button 
              className="absolute right-8 top-1/2 -translate-y-1/2 p-0.5 hover:bg-secondary rounded"
              onClick={(e) => {
                e.stopPropagation();
                clearQuarters();
              }}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Include Current toggle */}
        <button 
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            seFilterState?.includeCurrentQuarter 
              ? "bg-secondary text-foreground" 
              : "bg-secondary/50 text-muted-foreground"
          )}
          onClick={() => onSEFilterChange?.({ includeCurrentQuarter: !seFilterState?.includeCurrentQuarter })}
        >
          Incl. Current
        </button>

        {/* Manager dropdown - filtered to allowed managers */}
        <Select 
          value={seFilterState?.selectedManager || 'all'} 
          onValueChange={(v) => onSEFilterChange?.({ selectedManager: v === 'all' ? null : v })}
        >
          <SelectTrigger className={cn(
            "h-8 w-40 text-xs font-medium shadow-none",
            seFilterState?.selectedManager 
              ? "bg-teal-600 text-white border-none" 
              : "bg-teal-600 text-white border-none"
          )}>
            <SelectValue placeholder="All Managers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs font-medium">All Managers</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* SE Filter with groupings */}
        {hasFilters && (
          <>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Select 
                value={seFilterState?.selectedSE || 'all'} 
                onValueChange={(v) => onSEFilterChange?.({ selectedSE: v === 'all' ? null : v })}
              >
                <SelectTrigger className={cn(
                  "h-8 w-36 text-xs font-medium shadow-none border",
                  seFilterState?.selectedSE 
                    ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400" 
                    : "border-none bg-secondary"
                )}>
                  <SelectValue placeholder="All SEs" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="all" className="text-xs font-medium">All SEs</SelectItem>
                  
                  {/* SE Managers Group */}
                  {seManagers.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-2xs text-muted-foreground px-2 py-1">
                        SE Managers
                      </SelectLabel>
                      {seManagers.map((mgr) => (
                        <SelectItem key={`mgr-${mgr}`} value={mgr} className="text-xs pl-4">
                          {mgr}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  
                  {/* Sales Consultants (SEs) Group */}
                  {allSEs.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-2xs text-muted-foreground px-2 py-1">
                        Sales Consultants
                      </SelectLabel>
                      {allSEs.map((se) => (
                        <SelectItem key={`se-${se}`} value={se} className="text-xs pl-4">
                          {se}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Refresh icon */}
            <button 
              className="p-1.5 hover:bg-secondary rounded-md transition-colors"
              onClick={onRefresh}
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>

            {/* TDR Priority / Deals Filter */}
            <Select 
              value={seFilterState?.selectedPriority || 'all'} 
              onValueChange={(v) => onSEFilterChange?.({ selectedPriority: v === 'all' ? null : v })}
            >
              <SelectTrigger className={cn(
                "h-8 w-32 text-xs font-medium shadow-none border",
                seFilterState?.selectedPriority 
                  ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400" 
                  : "border-none bg-secondary"
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
          </>
        )}
      </div>

      {/* Center: View Toggle */}
      {activeView && onViewChange ? (
        <div className="flex items-center gap-1 rounded-md bg-secondary p-0.5">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
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
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}
