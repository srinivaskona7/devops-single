import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardSkeleton, LoadingState } from '@/components/shared/LoadingState';
import { useAdjacentPrefetch } from '@/hooks/usePrefetch';
import { useAuth } from 'react-oidc-context';
import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

/* ─── Lazy-loaded pages (code-split per route) ─── */
const ClusterOverview     = lazy(() => import('@/pages/ClusterOverview'));
const NodesPage           = lazy(() => import('@/pages/NodesPage'));
const NamespacesPage      = lazy(() => import('@/pages/NamespacesPage'));
const NamespaceDetailPage = lazy(() => import('@/pages/NamespaceDetailPage'));
const EventsPage          = lazy(() => import('@/pages/EventsPage'));
const TopologyPage        = lazy(() => import('@/pages/TopologyPage'));

const PodsPage            = lazy(() => import('@/pages/PodsPage'));
const DeploymentsPage     = lazy(() => import('@/pages/DeploymentsPage'));
const StatefulSetsPage    = lazy(() => import('@/pages/StatefulSetsPage'));
const DaemonSetsPage      = lazy(() => import('@/pages/DaemonSetsPage'));
const ReplicaSetsPage     = lazy(() => import('@/pages/ReplicaSetsPage'));
const JobsPage            = lazy(() => import('@/pages/JobsPage'));
const CronJobsPage        = lazy(() => import('@/pages/CronJobsPage'));
const WorkloadsPage       = lazy(() => import('@/pages/WorkloadsPage'));

const ServicesPage        = lazy(() => import('@/pages/ServicesPage'));
const IngressesPage       = lazy(() => import('@/pages/IngressesPage'));
const NetworkPoliciesPage = lazy(() => import('@/pages/NetworkPoliciesPage'));

const ConfigMapsPage      = lazy(() => import('@/pages/ConfigMapsPage'));
const SecretsPage         = lazy(() => import('@/pages/SecretsPage'));
const ServiceAccountsPage = lazy(() => import('@/pages/ServiceAccountsPage'));
const ResourceQuotasPage  = lazy(() => import('@/pages/ResourceQuotasPage'));
const LimitRangesPage     = lazy(() => import('@/pages/LimitRangesPage'));
const RBACPage            = lazy(() => import('@/pages/RBACPage'));

const PVsPage             = lazy(() => import('@/pages/PVsPage'));
const PVCsPage            = lazy(() => import('@/pages/PVCsPage'));
const StorageClassesPage  = lazy(() => import('@/pages/StorageClassesPage'));

const IstioPage           = lazy(() => import('@/pages/IstioPage'));
const KymaPage            = lazy(() => import('@/pages/KymaPage'));
const HelmPage            = lazy(() => import('@/pages/HelmPage'));

const TerminalPage        = lazy(() => import('@/pages/TerminalPage'));
const ExecPodPage         = lazy(() => import('@/pages/ExecPodPage'));
const YamlApplyPage       = lazy(() => import('@/pages/YamlApplyPage'));
const ClustersPage        = lazy(() => import('@/pages/ClustersPage'));
const AdminPage           = lazy(() => import('@/pages/AdminPage'));

/* ─── Suspense fallback ─── */
function PageFallback() {
  return (
    <div className="p-6">
      <LoadingState resource="" rows={8} />
    </div>
  );
}

/** Wraps a lazy page in ErrorBoundary + Suspense — eliminates repetition */
function Page({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

/* ─── Prefetch wrapper ─── */
function PrefetchProvider({ children }: { children: React.ReactNode }) {
  useAdjacentPrefetch();
  return <>{children}</>;
}

/* ─── App ─── */
// Auth is only required in production (Kyma cluster with Keycloak API Rule).
// In dev (VITE_SKIP_AUTH=true) we bypass OIDC entirely — backend also skips JWT
// validation via DEV_SKIP_AUTH=true set in docker-compose.dev.yml.
const SKIP_AUTH = import.meta.env.VITE_SKIP_AUTH === 'true';

export default function App() {
  const auth = useAuth();
  const setToken = useAppStore((s) => s.setToken);

  useEffect(() => {
    if (auth.user?.access_token) {
      setToken(auth.user.access_token);
    } else {
      setToken(null);
    }
  }, [auth.user, setToken]);

  // Dev bypass — skip all auth screens and go straight to the app
  if (SKIP_AUTH) {
    return (
      <Routes>
        <Route path="/clusters" element={<Suspense fallback={<PageFallback />}><ClustersPage /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={<PageFallback />}><AdminPage /></Suspense>} />
        <Route element={<AppLayout />}>
          <Route element={<PrefetchProvider><Suspense fallback={<PageFallback />}><ClusterOverview /></Suspense></PrefetchProvider>} index />
          <Route path="cluster">
            <Route index element={<Suspense fallback={<PageFallback />}><ClusterOverview /></Suspense>} />
            <Route path="nodes" element={<Suspense fallback={<PageFallback />}><NodesPage /></Suspense>} />
          </Route>
          <Route path="namespaces">
            <Route index element={<Suspense fallback={<PageFallback />}><NamespacesPage /></Suspense>} />
            <Route path=":namespace">
              <Route index element={<Suspense fallback={<PageFallback />}><NamespaceDetailPage /></Suspense>} />
              <Route path="pods"           element={<Suspense fallback={<PageFallback />}><PodsPage /></Suspense>} />
              <Route path="deployments"    element={<Suspense fallback={<PageFallback />}><DeploymentsPage /></Suspense>} />
              <Route path="statefulsets"   element={<Suspense fallback={<PageFallback />}><StatefulSetsPage /></Suspense>} />
              <Route path="daemonsets"     element={<Suspense fallback={<PageFallback />}><DaemonSetsPage /></Suspense>} />
              <Route path="replicasets"    element={<Suspense fallback={<PageFallback />}><ReplicaSetsPage /></Suspense>} />
              <Route path="jobs"           element={<Suspense fallback={<PageFallback />}><JobsPage /></Suspense>} />
              <Route path="cronjobs"       element={<Suspense fallback={<PageFallback />}><CronJobsPage /></Suspense>} />
              <Route path="events"         element={<Suspense fallback={<PageFallback />}><EventsPage /></Suspense>} />
              <Route path="services"       element={<Suspense fallback={<PageFallback />}><ServicesPage /></Suspense>} />
              <Route path="ingresses"      element={<Suspense fallback={<PageFallback />}><IngressesPage /></Suspense>} />
              <Route path="networkpolicies" element={<Suspense fallback={<PageFallback />}><NetworkPoliciesPage /></Suspense>} />
              <Route path="limitranges"    element={<Suspense fallback={<PageFallback />}><LimitRangesPage /></Suspense>} />
              <Route path="resourcequotas" element={<Suspense fallback={<PageFallback />}><ResourceQuotasPage /></Suspense>} />
              <Route path="serviceaccounts" element={<Suspense fallback={<PageFallback />}><ServiceAccountsPage /></Suspense>} />
              <Route path="configmaps"     element={<Suspense fallback={<PageFallback />}><ConfigMapsPage /></Suspense>} />
              <Route path="secrets"        element={<Suspense fallback={<PageFallback />}><SecretsPage /></Suspense>} />
              <Route path="pvcs"           element={<Suspense fallback={<PageFallback />}><PVCsPage /></Suspense>} />
            </Route>
          </Route>
          <Route path="events"   element={<Suspense fallback={<PageFallback />}><EventsPage /></Suspense>} />
          <Route path="topology" element={<Suspense fallback={<PageFallback />}><TopologyPage /></Suspense>} />
          <Route path="workloads">
            <Route index element={<Suspense fallback={<PageFallback />}><WorkloadsPage /></Suspense>} />
            <Route path="pods"         element={<Suspense fallback={<PageFallback />}><PodsPage /></Suspense>} />
            <Route path="deployments"  element={<Suspense fallback={<PageFallback />}><DeploymentsPage /></Suspense>} />
            <Route path="statefulsets" element={<Suspense fallback={<PageFallback />}><StatefulSetsPage /></Suspense>} />
            <Route path="daemonsets"   element={<Suspense fallback={<PageFallback />}><DaemonSetsPage /></Suspense>} />
            <Route path="replicasets"  element={<Suspense fallback={<PageFallback />}><ReplicaSetsPage /></Suspense>} />
            <Route path="jobs"         element={<Suspense fallback={<PageFallback />}><JobsPage /></Suspense>} />
            <Route path="cronjobs"     element={<Suspense fallback={<PageFallback />}><CronJobsPage /></Suspense>} />
          </Route>
          <Route path="pvs"            element={<Suspense fallback={<PageFallback />}><PVsPage /></Suspense>} />
          <Route path="storageclasses" element={<Suspense fallback={<PageFallback />}><StorageClassesPage /></Suspense>} />
          <Route path="rbac"           element={<Suspense fallback={<PageFallback />}><RBACPage /></Suspense>} />
          <Route path="istio"          element={<Suspense fallback={<PageFallback />}><IstioPage /></Suspense>} />
          <Route path="kyma"           element={<Suspense fallback={<PageFallback />}><KymaPage /></Suspense>} />
          <Route path="helm"           element={<Suspense fallback={<PageFallback />}><HelmPage /></Suspense>} />
          <Route path="terminal"       element={<Suspense fallback={<PageFallback />}><TerminalPage /></Suspense>} />
          <Route path="exec"           element={<Suspense fallback={<PageFallback />}><ExecPodPage /></Suspense>} />
          <Route path="yaml"           element={<Suspense fallback={<PageFallback />}><YamlApplyPage /></Suspense>} />
          <Route path="*"              element={<Navigate to="/cluster" replace />} />
        </Route>
      </Routes>
    );
  }

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-lg font-medium animate-pulse">Initializing Secure Identity...</p>
        </div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="max-w-md p-8 bg-slate-800 rounded-xl shadow-2xl border border-red-500/30">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Authentication Error</h1>
          <p className="text-slate-300 mb-6">{auth.error.message}</p>
          <button
            onClick={() => auth.signinRedirect()}
            className="w-full py-3 bg-red-500 hover:bg-red-600 rounded-lg font-semibold transition-colors"
          >
            Retry Login
          </button>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white overflow-hidden relative">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full animate-blob" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full animate-blob animation-delay-2000" />
        </div>

        <div className="z-10 w-full max-w-sm p-8 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl text-center">
          <div className="mb-8">
            <div className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6 group hover:rotate-6 transition-transform">
              <span className="text-3xl font-black italic text-white">K</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Kyma Dashboard</h1>
            <p className="text-slate-400">Enterprise Managed Identity</p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => auth.signinRedirect()}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              Sign In with Keycloak
            </button>
            <p className="text-xs text-slate-500">
              Secured by OIDC Flow & JWT Verification
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Cluster management (no sidebar) */}
      <Route path="/clusters" element={<Suspense fallback={<PageFallback />}><ClustersPage /></Suspense>} />
      <Route path="/admin" element={<Suspense fallback={<PageFallback />}><AdminPage /></Suspense>} />

      {/* Main layout with sidebar */}
      <Route element={<AppLayout />}>
        <Route element={<PrefetchProvider><Suspense fallback={<PageFallback />}><ClusterOverview /></Suspense></PrefetchProvider>} index />

        {/* Cluster overview — both /cluster and /cluster/* */}
        <Route path="cluster">
          <Route index element={<Suspense fallback={<PageFallback />}><ClusterOverview /></Suspense>} />
          <Route path="nodes" element={<Suspense fallback={<PageFallback />}><NodesPage /></Suspense>} />
        </Route>

        {/* Flat cluster-level routes (match sidebar) */}
        <Route path="namespaces">
          <Route index element={<Suspense fallback={<PageFallback />}><NamespacesPage /></Suspense>} />
          {/* Namespace-scoped routes: /namespaces/:namespace/resource */}
          <Route path=":namespace">
            <Route index element={<Suspense fallback={<PageFallback />}><NamespaceDetailPage /></Suspense>} />
            <Route path="pods"           element={<Suspense fallback={<PageFallback />}><PodsPage /></Suspense>} />
            <Route path="deployments"    element={<Suspense fallback={<PageFallback />}><DeploymentsPage /></Suspense>} />
            <Route path="statefulsets"   element={<Suspense fallback={<PageFallback />}><StatefulSetsPage /></Suspense>} />
            <Route path="daemonsets"     element={<Suspense fallback={<PageFallback />}><DaemonSetsPage /></Suspense>} />
            <Route path="replicasets"    element={<Suspense fallback={<PageFallback />}><ReplicaSetsPage /></Suspense>} />
            <Route path="jobs"           element={<Suspense fallback={<PageFallback />}><JobsPage /></Suspense>} />
            <Route path="cronjobs"       element={<Suspense fallback={<PageFallback />}><CronJobsPage /></Suspense>} />
            <Route path="events"         element={<Suspense fallback={<PageFallback />}><EventsPage /></Suspense>} />
            <Route path="services"       element={<Suspense fallback={<PageFallback />}><ServicesPage /></Suspense>} />
            <Route path="ingresses"      element={<Suspense fallback={<PageFallback />}><IngressesPage /></Suspense>} />
            <Route path="networkpolicies" element={<Suspense fallback={<PageFallback />}><NetworkPoliciesPage /></Suspense>} />
            <Route path="limitranges"    element={<Suspense fallback={<PageFallback />}><LimitRangesPage /></Suspense>} />
            <Route path="resourcequotas" element={<Suspense fallback={<PageFallback />}><ResourceQuotasPage /></Suspense>} />
            <Route path="serviceaccounts" element={<Suspense fallback={<PageFallback />}><ServiceAccountsPage /></Suspense>} />
            <Route path="configmaps"     element={<Suspense fallback={<PageFallback />}><ConfigMapsPage /></Suspense>} />
            <Route path="secrets"        element={<Suspense fallback={<PageFallback />}><SecretsPage /></Suspense>} />
            <Route path="pvcs"           element={<Suspense fallback={<PageFallback />}><PVCsPage /></Suspense>} />
          </Route>
        </Route>
        <Route path="events"   element={<Suspense fallback={<PageFallback />}><EventsPage /></Suspense>} />
        <Route path="topology" element={<Suspense fallback={<PageFallback />}><TopologyPage /></Suspense>} />

        {/* Workloads (flat, namespace via query param) */}
        <Route path="workloads">
          <Route index element={<Suspense fallback={<PageFallback />}><WorkloadsPage /></Suspense>} />
          <Route path="pods"        element={<Suspense fallback={<PageFallback />}><PodsPage /></Suspense>} />
          <Route path="deployments" element={<Suspense fallback={<PageFallback />}><DeploymentsPage /></Suspense>} />
          <Route path="statefulsets" element={<Suspense fallback={<PageFallback />}><StatefulSetsPage /></Suspense>} />
          <Route path="daemonsets"  element={<Suspense fallback={<PageFallback />}><DaemonSetsPage /></Suspense>} />
          <Route path="replicasets" element={<Suspense fallback={<PageFallback />}><ReplicaSetsPage /></Suspense>} />
          <Route path="jobs"        element={<Suspense fallback={<PageFallback />}><JobsPage /></Suspense>} />
          <Route path="cronjobs"    element={<Suspense fallback={<PageFallback />}><CronJobsPage /></Suspense>} />
        </Route>

        {/* Network */}
        <Route path="network">
          <Route path="services"       element={<Suspense fallback={<PageFallback />}><ServicesPage /></Suspense>} />
          <Route path="ingresses"      element={<Suspense fallback={<PageFallback />}><IngressesPage /></Suspense>} />
          <Route path="networkpolicies" element={<Suspense fallback={<PageFallback />}><NetworkPoliciesPage /></Suspense>} />
        </Route>

        {/* Configuration */}
        <Route path="configuration">
          <Route path="configmaps"      element={<Suspense fallback={<PageFallback />}><ConfigMapsPage /></Suspense>} />
          <Route path="secrets"         element={<Suspense fallback={<PageFallback />}><SecretsPage /></Suspense>} />
          <Route path="serviceaccounts" element={<Suspense fallback={<PageFallback />}><ServiceAccountsPage /></Suspense>} />
          <Route path="resourcequotas"  element={<Suspense fallback={<PageFallback />}><ResourceQuotasPage /></Suspense>} />
          <Route path="limitranges"     element={<Suspense fallback={<PageFallback />}><LimitRangesPage /></Suspense>} />
          <Route path="rbac"            element={<Suspense fallback={<PageFallback />}><RBACPage /></Suspense>} />
        </Route>

        {/* Storage — flat routes (match sidebar) AND nested */}
        <Route path="pvs"          element={<Suspense fallback={<PageFallback />}><PVsPage /></Suspense>} />
        <Route path="storageclasses" element={<Suspense fallback={<PageFallback />}><StorageClassesPage /></Suspense>} />
        <Route path="storage">
          <Route path="pvs"          element={<Suspense fallback={<PageFallback />}><PVsPage /></Suspense>} />
          <Route path="pvcs"         element={<Suspense fallback={<PageFallback />}><PVCsPage /></Suspense>} />
          <Route path="storageclasses" element={<Suspense fallback={<PageFallback />}><StorageClassesPage /></Suspense>} />
        </Route>

        {/* RBAC flat route (match sidebar /rbac?tab=...) */}
        <Route path="rbac" element={<Suspense fallback={<PageFallback />}><RBACPage /></Suspense>} />

        {/* Extensions */}
        <Route path="istio" element={<Suspense fallback={<PageFallback />}><IstioPage /></Suspense>} />
        <Route path="kyma"  element={<Suspense fallback={<PageFallback />}><KymaPage /></Suspense>} />
        <Route path="helm"  element={<Suspense fallback={<PageFallback />}><HelmPage /></Suspense>} />

        {/* Tools */}
        <Route path="terminal" element={<Suspense fallback={<PageFallback />}><TerminalPage /></Suspense>} />
        <Route path="exec"     element={<Suspense fallback={<PageFallback />}><ExecPodPage /></Suspense>} />
        <Route path="yaml"     element={<Suspense fallback={<PageFallback />}><YamlApplyPage /></Suspense>} />

        {/* Catch-all → cluster overview */}
        <Route path="*" element={<Navigate to="/cluster" replace />} />
      </Route>
    </Routes>
  );
}
