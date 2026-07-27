import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { ProtectedRoute, AdminRoute } from "@/routes/ProtectedRoute";

const MasterDataPage = lazy(() => import("@/pages/MasterDataPage"));
const PassingByPage = lazy(() => import("@/pages/PassingByPage"));
const PrintingPage = lazy(() => import("@/pages/PrintingPage"));
const DataBankPage = lazy(() => import("@/pages/DataBankPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
import NotFoundPage from "@/pages/NotFoundPage";

const RouteFallback = () => (
  <div className="flex items-center justify-center py-24">
    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

const AppRoutes = () => (
  <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route index element={<MasterDataPage />} />
        <Route path="passing-by" element={<PassingByPage />} />
        <Route path="printing" element={<PrintingPage />} />
        <Route path="data-bank" element={<DataBankPage />} />
        <Route element={<AdminRoute />}>
          <Route path="settings" element={<SettingsPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </Suspense>
);

export default AppRoutes;
