import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LoginPage from "@/pages/LoginPage";
import PendingApprovalPage from "@/pages/PendingApprovalPage";
import AppShell from "@/components/layout/AppShell";
import TabNav from "@/components/layout/TabNav";

export const ProtectedRoute = () => {
  const { user, loading, isApproved } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }
  if (!user) return <LoginPage />;
  if (!isApproved) return <PendingApprovalPage />;

  return (
    <AppShell>
      <TabNav />
      <Outlet />
    </AppShell>
  );
};

/** Nested guard for /settings and /users — redirects non-admins back to Master Data. */
export const AdminRoute = () => {
  const { isAdmin, isOwner } = useAuth();
  if (!isAdmin && !isOwner) return <Navigate to="/" replace />;
  return <Outlet />;
};
