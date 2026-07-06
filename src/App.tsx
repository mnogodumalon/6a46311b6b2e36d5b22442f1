import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import ReparaturauftraegePage from '@/pages/ReparaturauftraegePage';
import ReparaturauftraegeDetailPage from '@/pages/ReparaturauftraegeDetailPage';
import KundenPage from '@/pages/KundenPage';
import KundenDetailPage from '@/pages/KundenDetailPage';
import PublicFormReparaturauftraege from '@/pages/public/PublicForm_Reparaturauftraege';
import PublicFormKunden from '@/pages/public/PublicForm_Kunden';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a463108843b6cd2d180b8f9" element={<PublicFormReparaturauftraege />} />
              <Route path="public/6a463104399c364351f91e8a" element={<PublicFormKunden />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="reparaturauftraege" element={<ReparaturauftraegePage />} />
                <Route path="reparaturauftraege/:id" element={<ReparaturauftraegeDetailPage />} />
                <Route path="kunden" element={<KundenPage />} />
                <Route path="kunden/:id" element={<KundenDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
