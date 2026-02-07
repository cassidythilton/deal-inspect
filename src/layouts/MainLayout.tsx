import { AppSidebar } from '@/components/AppSidebar';
import { Outlet } from 'react-router-dom';

export function MainLayout() {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="ml-14 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
