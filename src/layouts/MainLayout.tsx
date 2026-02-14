import { AppSidebar } from '@/components/AppSidebar';
import { Outlet, useLocation } from 'react-router-dom';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Command Center',
  '/workspace': 'TDR Workspace',
  '/history': 'History',
  '/analytics': 'Analytics',
  '/docs': 'Documentation',
  '/settings': 'Settings',
};

export function MainLayout() {
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || 'DealInspect';

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="ml-14 flex flex-1 flex-col">
        {/* Minimalistic header bar */}
        <header className="sticky top-0 z-30 flex h-10 items-center border-b border-border/40 bg-background/80 backdrop-blur-md px-5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground/70 uppercase">
            {pageTitle}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground/40 tracking-wider font-medium">
              DealInspect
            </span>
            <div className="h-3 w-px bg-border/50" />
            <span className="text-[10px] text-purple-500/50 font-medium">
              TDR
            </span>
          </div>
        </header>
        {/* Page content */}
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
