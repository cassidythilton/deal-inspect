import { User, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { managers, quarters } from '@/data/mockData';
import { cn } from '@/lib/utils';

interface TopBarProps {
  activeView?: 'recommended' | 'agenda' | 'all';
  onViewChange?: (view: 'recommended' | 'agenda' | 'all') => void;
}

export function TopBar({ activeView, onViewChange }: TopBarProps) {
  const views = [
    { id: 'recommended' as const, label: 'Recommended' },
    { id: 'agenda' as const, label: 'Agenda' },
    { id: 'all' as const, label: 'All Eligible' },
  ];

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-6">
      {/* Left: Selectors */}
      <div className="flex items-center gap-4">
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
