import { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { AdminLayout } from '@/components/layout';
import { LoadingSpinner } from '@/components/shared';

// Eager: login + dashboard (always needed)
import LoginPage from '@/pages/login-page';
import DashboardPage from '@/pages/dashboard-page';
import OAuthCallbackPage from '@/pages/oauth-callback-page';

// Lazy: Bridge pages (loaded on demand)
const SecurityPage = lazy(() => import('@/pages/security-page'));
const ServicesPage = lazy(() => import('@/pages/services-page'));
const CachePage = lazy(() => import('@/pages/cache-page'));
const ConfigPage = lazy(() => import('@/pages/config-page'));
const ErpConfigPage = lazy(() => import('@/pages/erp-config-page'));
const LicensingPage = lazy(() => import('@/pages/licensing-page'));
const PatchesPage = lazy(() => import('@/pages/patches-page'));
const ProvidersPage = lazy(() => import('@/pages/providers-page'));

// Lazy: App admin pages (loaded on demand)
const ConnectAdminPage = lazy(() => import('@/pages/apps/connect-admin-page'));
const StackAdminPage = lazy(() => import('@/pages/apps/stack-admin-page'));
const FlipAdminPage = lazy(() => import('@/pages/apps/flip-admin-page'));
const FloorAdminPage = lazy(() => import('@/pages/apps/floor-admin-page'));
const LabelAdminPage = lazy(() => import('@/pages/apps/label-admin-page'));
const ShopAdminPage = lazy(() => import('@/pages/apps/shop-admin-page'));
const InfuseAdminPage = lazy(() => import('@/pages/apps/infuse-admin-page'));
const WorkAdminPage = lazy(() => import('@/pages/apps/work-admin-page'));
const PulpAdminPage = lazy(() => import('@/pages/apps/pulp-admin-page'));
const EmailPollerAdminPage = lazy(() => import('@/pages/apps/email-poller-admin-page'));

function App() {
  const { isAuthenticated } = useAuth();
  const [hydrated, setHydrated] = useState(useAuth.persist.hasHydrated());

  useEffect(() => {
    const unsub = useAuth.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  // Wait for Zustand persist to rehydrate before rendering routes.
  // This prevents queries from firing before auth state is known.
  if (!hydrated) return null;

  // OAuth callback — must render in popup regardless of auth state
  if (window.location.pathname === '/oauth/callback') {
    return (
      <Routes>
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      </Routes>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><LoadingSpinner size="lg" /></div>}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/cache" element={<CachePage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/erp-config" element={<ErpConfigPage />} />
          <Route path="/licensing" element={<LicensingPage />} />
          <Route path="/patches" element={<PatchesPage />} />
          <Route path="/providers" element={<ProvidersPage />} />
          <Route path="/apps/connect" element={<ConnectAdminPage />} />
          <Route path="/apps/stack" element={<StackAdminPage />} />
          <Route path="/apps/flip" element={<FlipAdminPage />} />
          <Route path="/apps/floor" element={<FloorAdminPage />} />
          <Route path="/apps/labels" element={<LabelAdminPage />} />
          <Route path="/apps/shop" element={<ShopAdminPage />} />
          <Route path="/apps/infuse" element={<InfuseAdminPage />} />
          <Route path="/apps/work" element={<WorkAdminPage />} />
          <Route path="/apps/pulp" element={<PulpAdminPage />} />
          <Route path="/apps/email-poller" element={<EmailPollerAdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
