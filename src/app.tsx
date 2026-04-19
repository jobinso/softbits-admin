import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { AdminLayout } from '@/components/layout';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { FullPageSpinner } from '@shared/components';
import LoginPage from '@/pages/login-page';

// Lazy-loaded pages — grouped by section
const DashboardPage = lazy(() => import('@/pages/dashboard-page'));
const NotFoundPage = lazy(() => import('@/pages/not-found-page'));

// Security pages
const UsersPage = lazy(() => import('@/pages/security').then(m => ({ default: m.UsersPage })));
const RolesPage = lazy(() => import('@/pages/security').then(m => ({ default: m.RolesPage })));
const TokensPage = lazy(() => import('@/pages/security').then(m => ({ default: m.TokensPage })));
const DevicesPage = lazy(() => import('@/pages/security').then(m => ({ default: m.DevicesPage })));

// Infrastructure pages
const ServicesPage = lazy(() => import('@/pages/services-page'));
const CachePage = lazy(() => import('@/pages/cache-page'));
const LicensingPage = lazy(() => import('@/pages/licensing-page'));
const PatchesPage = lazy(() => import('@/pages/patches-page'));

// Config pages
const ProjectTypesPage = lazy(() => import('@/pages/config').then(m => ({ default: m.ProjectTypesPage })));
const CurrenciesPage = lazy(() => import('@/pages/config').then(m => ({ default: m.CurrenciesPage })));
const OptionSetsPage = lazy(() => import('@/pages/config').then(m => ({ default: m.OptionSetsPage })));
const WarehousesPage = lazy(() => import('@/pages/config').then(m => ({ default: m.WarehousesPage })));

// App admin pages
const ConnectAdminPage = lazy(() => import('@/pages/apps').then(m => ({ default: m.ConnectAdminPage })));
const StackAdminPage = lazy(() => import('@/pages/apps').then(m => ({ default: m.StackAdminPage })));
const FlipAdminPage = lazy(() => import('@/pages/apps').then(m => ({ default: m.FlipAdminPage })));
const FloorAdminPage = lazy(() => import('@/pages/apps').then(m => ({ default: m.FloorAdminPage })));
const LabelAdminPage = lazy(() => import('@/pages/apps').then(m => ({ default: m.LabelAdminPage })));
const ShopAdminPage = lazy(() => import('@/pages/apps').then(m => ({ default: m.ShopAdminPage })));
const InfuseAdminPage = lazy(() => import('@/pages/apps').then(m => ({ default: m.InfuseAdminPage })));
const WorkAdminPage = lazy(() => import('@/pages/apps').then(m => ({ default: m.WorkAdminPage })));
const PulpAdminPage = lazy(() => import('@/pages/apps').then(m => ({ default: m.PulpAdminPage })));

function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/security/users" element={<UsersPage />} />
            <Route path="/security/roles" element={<RolesPage />} />
            <Route path="/security/tokens" element={<TokensPage />} />
            <Route path="/security/devices" element={<DevicesPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/cache" element={<CachePage />} />
            <Route path="/config/project-types" element={<ProjectTypesPage />} />
            <Route path="/config/currencies" element={<CurrenciesPage />} />
            <Route path="/config/option-sets" element={<OptionSetsPage />} />
            <Route path="/config/warehouses" element={<WarehousesPage />} />
            <Route path="/licensing" element={<LicensingPage />} />
            <Route path="/patches" element={<PatchesPage />} />
            <Route path="/apps/connect" element={<ConnectAdminPage />} />
            <Route path="/apps/stack" element={<StackAdminPage />} />
            <Route path="/apps/flip" element={<FlipAdminPage />} />
            <Route path="/apps/floor" element={<FloorAdminPage />} />
            <Route path="/apps/labels" element={<LabelAdminPage />} />
            <Route path="/apps/shop" element={<ShopAdminPage />} />
            <Route path="/apps/infuse" element={<InfuseAdminPage />} />
            <Route path="/apps/work" element={<WorkAdminPage />} />
            <Route path="/apps/pulp" element={<PulpAdminPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
