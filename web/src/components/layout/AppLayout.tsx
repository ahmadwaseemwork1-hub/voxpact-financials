import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { QuickActions } from './QuickActions';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useSmoothScroll(true);

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-[264px]">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] px-4 pb-24 pt-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <QuickActions />
    </div>
  );
}
