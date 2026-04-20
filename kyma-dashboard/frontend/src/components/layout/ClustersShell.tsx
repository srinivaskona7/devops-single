import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

/**
 * Shell for the /clusters page — Navbar only, no sidebar.
 * Matches SAP Kyma "Cluster Overview" layout.
 */
export function ClustersShell() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#060d1f]">
      <Navbar />
      <main className="flex-1 overflow-y-auto px-8 py-6 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
