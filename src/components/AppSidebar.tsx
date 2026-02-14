import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSearch,
  History,
  BarChart3,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PoweredByCortexBadge } from '@/components/CortexBranding';

const navItems = [
  { id: 'command', label: 'Command Center', icon: LayoutDashboard, path: '/' },
  { id: 'workspace', label: 'TDR Workspace', icon: FileSearch, path: '/workspace' },
  { id: 'history', label: 'History', icon: History, path: '/history' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { id: 'docs', label: 'Documentation', icon: BookOpen, path: '/docs' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

/** DealInspect logo — shield + search overlay, representing deal inspection */
function DealInspectLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Shield className="h-full w-full text-purple-400" strokeWidth={1.8} />
      <Search className="absolute bottom-0 right-0 h-[55%] w-[55%] text-violet-300" strokeWidth={2.2} />
    </div>
  );
}

export function AppSidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col bg-sidebar transition-all duration-200 ease-out',
        isExpanded ? 'w-52' : 'w-14'
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Logo area */}
      <div className="flex h-12 items-center border-b border-sidebar-border px-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-violet-500 shadow-sm shadow-purple-900/40">
            <DealInspectLogo className="h-4 w-4" />
          </div>
          <div
            className={cn(
              'flex flex-col transition-opacity whitespace-nowrap',
              isExpanded ? 'opacity-100' : 'opacity-0'
            )}
          >
            <span className="text-[13px] font-bold tracking-tight text-white leading-tight">
              DealInspect
            </span>
            <span className="text-[8px] uppercase tracking-widest text-purple-400/70 leading-none">
              TDR Intelligence
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                'nav-item',
                isActive && 'nav-item-active'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span
                className={cn(
                  'whitespace-nowrap transition-opacity',
                  isExpanded ? 'opacity-100' : 'opacity-0'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Powered by Snowflake Cortex */}
      <div className={cn(
        'border-t border-sidebar-border px-2 py-2 transition-all',
        isExpanded ? 'opacity-100' : 'opacity-100'
      )}>
        <PoweredByCortexBadge compact={!isExpanded} />
      </div>

      {/* Collapse indicator */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="nav-item w-full justify-center"
        >
          {isExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
