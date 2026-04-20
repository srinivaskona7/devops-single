import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { Breadcrumb } from '../shared/Breadcrumb';
import { CommandPalette } from '../shared/CommandPalette';
import { useWarmCache } from '@/hooks/usePrefetch';

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useWarmCache();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Navbar onToggleSidebar={() => setSidebarCollapsed(p => !p)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />
        <main className="flex-1 overflow-y-auto px-9 py-7">
          <Breadcrumb />
          <div className="k-page-enter">
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
