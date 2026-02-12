import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ListTodo,
  FileSearch,
  History,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PoweredByCortexBadge } from '@/components/CortexBranding';

const navItems = [
  { id: 'command', label: 'Command Center', icon: LayoutDashboard, path: '/' },
  { id: 'agenda', label: 'Agenda', icon: ListTodo, path: '/agenda' },
  { id: 'workspace', label: 'TDR Workspace', icon: FileSearch, path: '/workspace' },
  { id: 'history', label: 'History', icon: History, path: '/history' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

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
      {/* Logo area — left-aligned */}
      <div className="flex h-12 items-center border-b border-sidebar-border px-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-accent">
            <span className="text-xs font-semibold text-sidebar-accent-foreground">T</span>
          </div>
          <span
            className={cn(
              'whitespace-nowrap text-sm font-semibold text-white transition-opacity',
              isExpanded ? 'opacity-100' : 'opacity-0'
            )}
          >
            TDR
          </span>
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
