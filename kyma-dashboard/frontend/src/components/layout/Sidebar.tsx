import { useState, memo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import {
  LayoutDashboard, Box, Layers, Activity,
  Container, GitBranch, Database, Monitor, Workflow, Timer,
  Globe, Network, Shield,
  HardDrive, Package, Archive,
  FileText, Lock, Users, BarChart3, Ruler, UserCheck,
  Zap, Code2, Bell, Wifi,
  Terminal, ChevronDown, ChevronRight, ArrowLeft, Share2,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNamespaces } from '@/hooks/useClusterData';

interface SidebarProps {
  collapsed: boolean;
}

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface SidebarSection {
  title: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

// ──────────────────────────────────────────────
// CLUSTER MODE sections — exact Kyma cluster sidebar
// ──────────────────────────────────────────────
const clusterSections: SidebarSection[] = [
  {
    title: 'CLUSTER',
    items: [
      { label: 'Cluster Overview', path: '/cluster',    icon: LayoutDashboard },
      { label: 'Namespaces',       path: '/namespaces', icon: Layers },
      { label: 'Events',           path: '/events',     icon: Activity },
      { label: 'Topology',         path: '/topology',   icon: Share2 },
    ],
  },
  {
    title: 'Storage',
    collapsible: true,
    items: [
      { label: 'Persistent Volumes', path: '/pvs',           icon: HardDrive },
      { label: 'Storage Classes',    path: '/storageclasses', icon: Archive },
    ],
  },
  {
    title: 'Configuration',
    collapsible: true,
    items: [
      { label: 'Cluster Role Bindings',        path: '/rbac?tab=clusterrolebindings',  icon: Users },
      { label: 'Cluster Roles',                path: '/rbac?tab=clusterroles',         icon: Shield },
      { label: 'Custom Resource Definitions',  path: '/rbac?tab=crds',                 icon: Code2 },
      { label: 'Custom Resources',             path: '/rbac?tab=customresources',      icon: FileText },
      { label: 'Modules',                      path: '/kyma?tab=modules',              icon: Zap },
    ],
  },
  {
    title: 'Integration',
    collapsible: true,
    items: [
      { label: 'Applications', path: '/kyma?tab=applications', icon: Globe },
    ],
  },
  {
    title: 'Kyma',
    collapsible: true,
    items: [
      { label: 'APIGateway', path: '/kyma?tab=apigateway', icon: Zap },
    ],
  },
  {
    title: 'Telemetry',
    collapsible: true,
    items: [
      { label: 'Log Pipelines',    path: '/kyma?tab=logpipelines',    icon: FileText },
      { label: 'Metric Pipelines', path: '/kyma?tab=metricpipelines', icon: BarChart3 },
      { label: 'Trace Pipelines',  path: '/kyma?tab=tracepipelines',  icon: Activity },
    ],
  },
];

// ──────────────────────────────────────────────
// NAMESPACE MODE sections — exact Kyma namespace sidebar
// ──────────────────────────────────────────────
function buildNamespaceSections(ns: string): SidebarSection[] {
  return [
    {
      title: 'NAMESPACE',
      items: [
        { label: 'Namespace Overview', path: `/namespaces/${ns}`,        icon: LayoutDashboard },
        { label: 'Events',             path: `/namespaces/${ns}/events`,  icon: Activity },
      ],
    },
    {
      title: 'Workloads',
      collapsible: true,
      defaultOpen: true,
      items: [
        { label: 'Pods',         path: `/namespaces/${ns}/pods`,        icon: Box },
        { label: 'Deployments',  path: `/namespaces/${ns}/deployments`, icon: Container },
        { label: 'Stateful Sets',path: `/namespaces/${ns}/statefulsets`,icon: Database },
        { label: 'Daemon Sets',  path: `/namespaces/${ns}/daemonsets`,  icon: Monitor },
        { label: 'Replica Sets', path: `/namespaces/${ns}/replicasets`, icon: GitBranch },
        { label: 'Jobs',         path: `/namespaces/${ns}/jobs`,        icon: Workflow },
        { label: 'Cron Jobs',    path: `/namespaces/${ns}/cronjobs`,    icon: Timer },
        { label: 'Functions',    path: `/kyma?tab=functions&namespace=${ns}`, icon: Code2 },
      ],
    },
    {
      title: 'Discovery and Network',
      collapsible: true,
      items: [
        { label: 'API Rules',                  path: `/kyma?tab=apirules&namespace=${ns}`,           icon: Zap },
        { label: 'Horizontal Pod Autoscalers', path: `/rbac?tab=hpa&namespace=${ns}`,                icon: BarChart3 },
        { label: 'Ingresses',                  path: `/namespaces/${ns}/ingresses`,                  icon: Network },
        { label: 'Limit Ranges',               path: `/namespaces/${ns}/limitranges`,                icon: Ruler },
        { label: 'Network Policies',           path: `/namespaces/${ns}/networkpolicies`,            icon: Shield },
        { label: 'Resource Quotas',            path: `/namespaces/${ns}/resourcequotas`,             icon: BarChart3 },
        { label: 'Services',                   path: `/namespaces/${ns}/services`,                   icon: Globe },
        { label: 'Topology',                   path: `/topology?namespace=${ns}`,                    icon: Share2 },
      ],
    },
    {
      title: 'Istio',
      collapsible: true,
      items: [
        { label: 'Authorization Policies', path: `/istio?tab=authzpolicies&namespace=${ns}`,     icon: Lock },
        { label: 'Destination Rules',      path: `/istio?tab=destinationrules&namespace=${ns}`,  icon: Network },
        { label: 'Gateways',               path: `/istio?tab=gateways&namespace=${ns}`,          icon: Globe },
        { label: 'Request Authentications',path: `/istio?tab=requestauth&namespace=${ns}`,       icon: UserCheck },
        { label: 'Service Entries',        path: `/istio?tab=serviceentries&namespace=${ns}`,    icon: Bell },
        { label: 'Sidecars',               path: `/istio?tab=sidecars&namespace=${ns}`,          icon: Monitor },
        { label: 'Virtual Services',       path: `/istio?tab=virtualservices&namespace=${ns}`,   icon: Activity },
      ],
    },
    {
      title: 'Service Management',
      collapsible: true,
      items: [
        { label: 'Service Bindings',  path: `/kyma?tab=servicebindings&namespace=${ns}`,  icon: Package },
        { label: 'Service Instances', path: `/kyma?tab=serviceinstances&namespace=${ns}`, icon: Archive },
      ],
    },
    {
      title: 'Storage',
      collapsible: true,
      items: [
        { label: 'Persistent Volume Claims', path: `/namespaces/${ns}/pvcs`, icon: HardDrive },
      ],
    },
    {
      title: 'Apps',
      collapsible: true,
      items: [
        { label: 'Helm Releases', path: `/helm?tab=releases&namespace=${ns}`, icon: Package },
      ],
    },
    {
      title: 'Configuration',
      collapsible: true,
      items: [
        { label: 'Config Maps',      path: `/namespaces/${ns}/configmaps`,      icon: FileText },
        { label: 'Custom Resources', path: `/rbac?tab=customresources&namespace=${ns}`, icon: Code2 },
        { label: 'Modules',          path: `/kyma?tab=modules&namespace=${ns}`, icon: Zap },
        { label: 'Role Bindings',    path: `/rbac?tab=rolebindings&namespace=${ns}`, icon: Users },
        { label: 'Roles',            path: `/rbac?tab=roles&namespace=${ns}`,  icon: Shield },
        { label: 'Secrets',          path: `/namespaces/${ns}/secrets`,         icon: Lock },
        { label: 'Service Accounts', path: `/namespaces/${ns}/serviceaccounts`, icon: UserCheck },
        { label: 'Subscriptions',    path: `/kyma?tab=subscriptions&namespace=${ns}`, icon: Bell },
      ],
    },
    {
      title: 'Kyma',
      collapsible: true,
      items: [
        { label: 'ApplicationConnector', path: `/kyma?tab=appconnector&namespace=${ns}`, icon: Globe },
        { label: 'Eventing',             path: `/kyma?tab=eventing&namespace=${ns}`,     icon: Bell },
        { label: 'Istio',                path: `/kyma?tab=kyma-istio&namespace=${ns}`,   icon: Activity },
        { label: 'NATS',                 path: `/kyma?tab=nats&namespace=${ns}`,         icon: Network },
        { label: 'Serverless',           path: `/kyma?tab=serverless&namespace=${ns}`,   icon: Code2 },
        { label: 'Telemetry',            path: `/kyma?tab=telemetry&namespace=${ns}`,    icon: BarChart3 },
      ],
    },
  ];
}

// ──────────────────────────────────────────────
// Section group component
// ──────────────────────────────────────────────
const SidebarSectionGroup = memo(function SidebarSectionGroup({
  section,
  collapsed,
}: {
  section: SidebarSection;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(
    section.collapsible ? (section.defaultOpen ?? false) : true
  );
  const location = useLocation();

  // Collapsed sidebar: show icons only
  if (collapsed) {
    return (
      <div className="py-1">
        {section.items.map(item => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center h-8 w-8 mx-auto rounded-md transition-colors',
                isActive
                  ? 'bg-indigo-500/15 text-indigo-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              )
            }
            title={item.label}
          >
            <item.icon size={16} />
          </NavLink>
        ))}
      </div>
    );
  }

  // Section header — non-collapsible (plain label, uppercase, no chevron)
  const isNonCollapsible = !section.collapsible;

  return (
    <div className="mb-0.5">
      {/* Section header */}
      {isNonCollapsible ? (
        // Plain label — matches Kyma's flat cluster items header
        <div className="px-3 pt-3 pb-0.5 text-[12px] font-bold text-slate-600 uppercase tracking-widest select-none">
          {section.title}
        </div>
      ) : (
        // Collapsible header — chevron on the RIGHT like Kyma
        <button
          onClick={() => setOpen(p => !p)}
          className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 hover:bg-white/[0.03] rounded-sm transition-colors"
        >
          <span>{section.title}</span>
          {open ? (
            <ChevronDown size={12} className="text-slate-500 shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-slate-500 shrink-0" />
          )}
        </button>
      )}

      {/* Empty state */}
      {open && section.items.length === 0 && (
        <div className="px-4 py-1.5 text-[12px] text-slate-600 italic">
          No items available
        </div>
      )}

      {/* Nav items */}
      {open &&
        section.items.map(item => {
          const pathPart = item.path.split('?')[0];
          const queryPart = item.path.split('?')[1] ?? '';
          const isActive =
            location.pathname === pathPart &&
            (queryPart ? location.search.includes(queryPart) : true);

          return (
            <NavLink
              key={item.label}
              to={item.path}
              className={() =>
                cn(
                  'flex items-center gap-2.5 pl-4 pr-3 py-[7px] text-[13.5px] transition-all duration-150',
                  isActive
                    ? 'bg-gradient-to-r from-blue-500/12 to-transparent text-blue-300 border-l-2 border-blue-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] border-l-2 border-transparent hover:border-slate-600/50'
                )
              }
              style={isActive ? { boxShadow: 'inset 0 0 12px rgba(79,126,255,0.06)' } : undefined}
            >
              <item.icon size={13} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
    </div>
  );
});

SidebarSectionGroup.displayName = 'SidebarSectionGroup';

// ──────────────────────────────────────────────
// Cluster context selector (top of cluster mode)
// ──────────────────────────────────────────────
function ClusterContextSelector({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div className="px-3 py-3 border-b border-[rgba(99,102,241,0.15)]">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded-md cursor-default group hover:border-indigo-500/40 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <Wifi size={12} className="text-green-400 shrink-0" />
          <span className="text-xs text-slate-300 font-medium truncate">
            my-kyma-cluster-admin
          </span>
        </div>
        <ChevronDown size={12} className="text-slate-500 shrink-0" />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Sidebar export
// ──────────────────────────────────────────────
export function Sidebar({ collapsed }: SidebarProps) {
  const { data: nsData } = useNamespaces();
  const namespaces = nsData?.items || [];
  const location = useLocation();
  const navigate = useNavigate();

  // Detect namespace context: /namespaces/:name
  const nsMatch = location.pathname.match(/^\/namespaces\/([^/]+)/);
  const activeNamespace = nsMatch?.[1];
  const isNamespaceMode = !!activeNamespace;

  const sections = isNamespaceMode
    ? buildNamespaceSections(activeNamespace)
    : clusterSections;

  return (
    <aside
      role="navigation"
      aria-label="Sidebar navigation"
      className={cn(
        'flex flex-col shrink-0 transition-all duration-200 overflow-hidden',
        collapsed ? 'w-14' : 'w-[264px]'
      )}
      style={{
        background: 'linear-gradient(180deg, #080f22 0%, #060d1a 100%)',
        borderRight: '1px solid rgba(79,126,255,0.12)',
        boxShadow: '1px 0 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* ── CLUSTER MODE: cluster context selector ── */}
      {!isNamespaceMode && <ClusterContextSelector collapsed={collapsed} />}

      {/* ── NAMESPACE MODE: back button + namespace selector ── */}
      {!collapsed && isNamespaceMode && (
        <div className="px-3 py-2 border-b border-[rgba(99,102,241,0.15)] space-y-2">
          <button
            onClick={() => navigate('/cluster')}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors py-1"
          >
            <ArrowLeft size={12} />
            <span>Back To Cluster Overview</span>
          </button>
          <div className="relative">
            <select
              className="w-full h-8 pl-2 pr-6 text-xs bg-[#060d1f] border border-[rgba(99,102,241,0.2)] rounded-md text-slate-300 focus:outline-none focus:border-indigo-500/40 appearance-none cursor-pointer"
              value={activeNamespace}
              onChange={e => {
                const newNs = e.target.value;
                // Preserve sub-path when switching namespace (e.g., /namespaces/old/pods → /namespaces/new/pods)
                const subPath = location.pathname.replace(/^\/namespaces\/[^/]+/, '');
                navigate(`/namespaces/${newNs}${subPath || ''}`);
              }}
            >
              {namespaces.map(ns => (
                <option key={ns.name} value={ns.name}>
                  {ns.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-700/40 scrollbar-track-transparent" aria-label="Main navigation">
        {sections.map(section => (
          <SidebarSectionGroup
            key={section.title}
            section={section}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* ── Terminal link at bottom ── */}
      <div className="border-t border-[rgba(99,102,241,0.15)] p-2">
        <NavLink
          to="/terminal"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
              isActive
                ? 'bg-indigo-500/10 text-indigo-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            )
          }
        >
          <Terminal size={16} />
          {!collapsed && <span>Terminal</span>}
        </NavLink>
      </div>
    </aside>
  );
}
