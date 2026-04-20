import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import App from './App';
import './index.css';

/* ─── Visibility-based focus management ─── */
focusManager.setEventListener((handleFocus) => {
  const onVisibilityChange = () => handleFocus(document.visibilityState === 'visible');
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => document.removeEventListener('visibilitychange', onVisibilityChange);
});

/* ─── Online/offline awareness ─── */
onlineManager.setEventListener((setOnline) => {
  const onOnline  = () => setOnline(true);
  const onOffline = () => setOnline(false);
  window.addEventListener('online',  onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online',  onOnline);
    window.removeEventListener('offline', onOffline);
  };
});

import { AuthProvider, AuthProviderProps } from 'react-oidc-context';

const oidcConfig: AuthProviderProps = {
  authority: "https://keycloak.c-8bd426f.kyma.ondemand.com/auth/realms/kyma",
  client_id: "dashboard-client",
  redirect_uri: window.location.origin,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      // Keep showing old data while refetching
      placeholderData: (prev: unknown) => prev,
    },
    mutations: {
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider {...oidcConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  </React.StrictMode>
);
