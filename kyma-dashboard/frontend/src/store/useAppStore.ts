import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  activeNamespace: string;
  setNamespace: (ns: string) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  kubeconfig: string;
  setKubeconfig: (k: string) => void;
  // token is intentionally NOT persisted — it's a session JWT, ephemeral by nature.
  // Storing JWTs in localStorage is an XSS vector. Token is re-set on every auth.
  token: string | null;
  setToken: (t: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeNamespace: '-all-',
      setNamespace: (activeNamespace) => set({ activeNamespace }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      kubeconfig: '',
      setKubeconfig: (kubeconfig) => set({ kubeconfig }),
      token: null,
      setToken: (token) => set({ token }),
    }),
    {
      name: 'kyma-manager-store',
      // Only persist UI preferences — never the auth token
      partialize: (state) => ({
        activeNamespace: state.activeNamespace,
        sidebarCollapsed: state.sidebarCollapsed,
        kubeconfig: state.kubeconfig,
      }),
    }
  )
);
