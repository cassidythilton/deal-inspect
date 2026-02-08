import { User } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { managers, quarters } from '@/data/mockData';
import { cn } from '@/lib/utils';

export interface SEFilterOptions {
  seManagers: string[];
  salesConsultants: string[];
  pocSalesConsultants: string[];
}

export interface SEFilterState {
  seManager: string | null;
  pocSalesConsultant: string | null;
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
    seFilterOptions.pocSalesConsultants.length > 0
  );

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-6">
      {/* Left: Selectors */}
      <div className="flex items-center gap-3">
        <Select defaultValue="q1-24">
          <SelectTrigger className="h-8 w-28 border-none bg-secondary text-xs font-medium shadow-none">
            <SelectValue placeholder="Quarter" />
          </SelectTrigger>
          <SelectContent>
            {quarters.map((q) => (
              <SelectItem key={q.id} value={q.id} className="text-xs">
                {q.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select defaultValue="all">
          <SelectTrigger className="h-8 w-36 border-none bg-secondary text-xs font-medium shadow-none">
            <SelectValue placeholder="Manager" />
          </SelectTrigger>
          <SelectContent>
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* SE Filters - only show if options available */}
        {hasFilters && (
          <>
            <div className="h-4 w-px bg-border" />
            
            {seFilterOptions.seManagers.length > 0 && (
              <Select 
                value={seFilterState?.seManager || 'all'} 
                onValueChange={(v) => onSEFilterChange?.({ seManager: v === 'all' ? null : v })}
              >
                <SelectTrigger className={cn(
                  "h-8 w-36 text-xs font-medium shadow-none border",
                  seFilterState?.seManager 
                    ? "border-violet-500/50 bg-violet-500/5 text-violet-700 dark:text-violet-400" 
                    : "border-none bg-secondary"
                )}>
                  <SelectValue placeholder="SE Manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All SE Managers</SelectItem>
                  {seFilterOptions.seManagers.map((mgr) => (
                    <SelectItem key={mgr} value={mgr} className="text-xs">
                      {mgr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {seFilterOptions.pocSalesConsultants.length > 0 && (
              <Select 
                value={seFilterState?.pocSalesConsultant || 'all'} 
                onValueChange={(v) => onSEFilterChange?.({ pocSalesConsultant: v === 'all' ? null : v })}
              >
                <SelectTrigger className={cn(
                  "h-8 w-36 text-xs font-medium shadow-none border",
                  seFilterState?.pocSalesConsultant 
                    ? "border-teal-500/50 bg-teal-500/5 text-teal-700 dark:text-teal-400" 
                    : "border-none bg-secondary"
                )}>
                  <SelectValue placeholder="PoC SE" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All PoC SEs</SelectItem>
                  {seFilterOptions.pocSalesConsultants.map((se) => (
                    <SelectItem key={se} value={se} className="text-xs">
                      {se}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}
      </div>

      {/* Center: View Toggle - only show if activeView and onViewChange are provided */}
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
