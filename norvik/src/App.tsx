import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ProtectedRoute } from "@/components/shared/protected-route";
import { AdminRoute } from "@/components/shared/admin-route";
import { AppShell } from "@/components/layout/app-shell";
import { ROUTES } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";

const LandingPage = lazy(() => import("@/pages/landing/index"));
const LoginPage = lazy(() => import("@/pages/auth/login"));
const RegisterPage = lazy(() => import("@/pages/auth/register"));
const DashboardPage = lazy(() => import("@/pages/dashboard/index"));
const CatalogsPage = lazy(() => import("@/pages/catalog-browser/catalogs"));
const CategoriesPage = lazy(() => import("@/pages/catalog-browser/categories"));
const CabinetsPage = lazy(() => import("@/pages/catalog-browser/cabinets"));
const WorkspacesListPage = lazy(() => import("@/pages/workspaces/list"));
const WorkspaceEditorPage = lazy(() => import("@/pages/workspaces/editor"));
const AdminUsersPage = lazy(() => import("@/pages/admin/users/index"));
const AdminCompaniesPage = lazy(() => import("@/pages/admin/companies/index"));
const AdminCatalogsPage = lazy(() => import("@/pages/admin/catalogs/index"));
const AdminCategoriesPage = lazy(() => import("@/pages/admin/categories/index"));
const AdminCabinetsPage = lazy(() => import("@/pages/admin/cabinets/index"));
const AdminCompanyUsersPage = lazy(() => import("@/pages/admin/companies/users/index"));
const TeamPage = lazy(() => import("@/pages/team/index"));
const InvitationsPage = lazy(() => import("@/pages/invitations/index"));

function PageFallback() {
  return <Skeleton className="h-96 w-full" />;
}

function lazySuspense(Component: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: lazySuspense(LandingPage),
  },
  {
    path: ROUTES.LOGIN,
    element: lazySuspense(LoginPage),
  },
  {
    path: ROUTES.REGISTER,
    element: lazySuspense(RegisterPage),
  },
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: ROUTES.DASHBOARD, element: lazySuspense(DashboardPage) },
      { path: ROUTES.CATALOGS, element: lazySuspense(CatalogsPage) },
      { path: ROUTES.CATALOG_CATEGORIES, element: lazySuspense(CategoriesPage) },
      { path: ROUTES.CATEGORY_CABINETS, element: lazySuspense(CabinetsPage) },
      { path: ROUTES.WORKSPACES, element: lazySuspense(WorkspacesListPage) },
      { path: ROUTES.WORKSPACE_EDITOR, element: lazySuspense(WorkspaceEditorPage) },
      { path: ROUTES.TEAM, element: lazySuspense(TeamPage) },
      { path: ROUTES.INVITATIONS, element: lazySuspense(InvitationsPage) },
    ],
  },
  {
    element: (
      <AdminRoute>
        <AppShell />
      </AdminRoute>
    ),
    children: [
      { path: ROUTES.ADMIN_USERS, element: lazySuspense(AdminUsersPage) },
      { path: ROUTES.ADMIN_COMPANIES, element: lazySuspense(AdminCompaniesPage) },
      { path: ROUTES.ADMIN_COMPANY_USERS, element: lazySuspense(AdminCompanyUsersPage) },
      { path: ROUTES.ADMIN_CATALOGS, element: lazySuspense(AdminCatalogsPage) },
      { path: ROUTES.ADMIN_CATEGORIES, element: lazySuspense(AdminCategoriesPage) },
      { path: ROUTES.ADMIN_CABINETS, element: lazySuspense(AdminCabinetsPage) },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
