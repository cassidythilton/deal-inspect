import { User, Users, RefreshCw } from 'lucide-react';
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

export interface SEFilterOptions {
  seManagers: string[];
  salesConsultants: string[];
  forecastManagers: string[];
  quarters: string[];
}

export interface SEFilterState {
  selectedSE: string | null;
  selectedManager: string | null;
  selectedQuarter: string | null;
  includeCurrentQuarter: boolean;
}

interface TopBarProps {
  activeView?: 'recommended' | 'agenda' | 'all';
  onViewChange?: (view: 'recommended' | 'agenda' | 'all') => void;
  seFilterOptions?: SEFilterOptions;
  seFilterState?: SEFilterState;
  onSEFilterChange?: (filters: Partial<SEFilterState>) => void;
}

export function TopBar({ 
  activeView, 
  onViewChange,
  seFilterOptions,
  seFilterState,
  onSEFilterChange,
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

  // Get quarters from options or use defaults
  const quarters = seFilterOptions?.quarters?.length 
    ? seFilterOptions.quarters 
    : ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'];

  // Get managers from options
  const managers = seFilterOptions?.forecastManagers || [];

  // Combine all SEs for the grouped dropdown
  const allSEs = [
    ...(seFilterOptions?.salesConsultants || []),
  ].filter((v, i, a) => a.indexOf(v) === i).sort();

  const seManagers = seFilterOptions?.seManagers || [];

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-6">
      {/* Left: Filters */}
      <div className="flex items-center gap-3">
        {/* Filters label */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">FILTERS</span>
        </div>

        {/* Quarter dropdown */}
        <Select 
          value={seFilterState?.selectedQuarter || 'all'} 
          onValueChange={(v) => onSEFilterChange?.({ selectedQuarter: v === 'all' ? null : v })}
        >
          <SelectTrigger className="h-8 w-28 border-none bg-secondary text-xs font-medium shadow-none">
            <SelectValue placeholder="Quarter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Quarters</SelectItem>
            {quarters.map((q) => (
              <SelectItem key={q} value={q} className="text-xs">
                {q}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Include Current toggle */}
        <button 
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors",
            seFilterState?.includeCurrentQuarter 
              ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" 
              : "bg-secondary text-muted-foreground"
          )}
          onClick={() => onSEFilterChange?.({ includeCurrentQuarter: !seFilterState?.includeCurrentQuarter })}
        >
          Incl. Current
        </button>

        {/* Manager dropdown */}
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
                  "h-8 w-40 text-xs font-medium shadow-none border",
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
            <RefreshCw className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />

            {/* All Deals dropdown */}
            <Select defaultValue="all-deals">
              <SelectTrigger className="h-8 w-28 border-none bg-secondary text-xs font-medium shadow-none">
                <SelectValue placeholder="All Deals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-deals" className="text-xs">All Deals</SelectItem>
                <SelectItem value="my-deals" className="text-xs">My Deals</SelectItem>
                <SelectItem value="team-deals" className="text-xs">Team Deals</SelectItem>
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
