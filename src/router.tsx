import { createBrowserRouter } from "react-router-dom"

// Public pages
import {
  HomePage,
  ActivitiesPage,
  PastActivitiesPage,
  ActivityDetailPage,
  ApplyPage,
  ApplyStatusPage,
  ApplyEditPage,
  LoginPage,
} from "@/pages/public"

// Dashboard pages
import {
  DashboardPage,
  ProfilePage,
  MyActivitiesPage,
  MyServicePage,
  VolunteersPage,
  ApplicationsPage,
  PlansPage,
  ProjectsPage,
  ActivitiesManagePage,
  ReportsPage,
  SettingsPage,
  AccountManagePage,
} from "@/pages/dashboard"

// Layouts
import { PublicLayout } from "@/components/layout/PublicLayout"
import { DashboardLayout } from "@/components/layout/DashboardLayout"

// Auth
import { ProtectedRoute } from "@/components/auth"

export const router = createBrowserRouter([
  // Public routes
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "activities", element: <ActivitiesPage /> },
      { path: "activities/past", element: <PastActivitiesPage /> },
      { path: "activities/:id", element: <ActivityDetailPage /> },
      { path: "apply", element: <ApplyPage /> },
      { path: "apply/status", element: <ApplyStatusPage /> },
      { path: "apply/edit/:token", element: <ApplyEditPage /> },
      { path: "login", element: <LoginPage /> },
    ],
  },
  // Dashboard routes (protected)
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "my-activities", element: <MyActivitiesPage /> },
      { path: "my-service", element: <MyServicePage /> },
      // Admin routes
      {
        path: "volunteers",
        element: (
          <ProtectedRoute requireAdmin>
            <VolunteersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "applications",
        element: (
          <ProtectedRoute requireAdmin>
            <ApplicationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "plans",
        element: (
          <ProtectedRoute requireAdmin>
            <PlansPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "projects",
        element: (
          <ProtectedRoute requireAdmin>
            <ProjectsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "activities",
        element: (
          <ProtectedRoute requireAdmin>
            <ActivitiesManagePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "reports",
        element: (
          <ProtectedRoute requireAdmin>
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "settings",
        element: (
          <ProtectedRoute requireAdmin>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      // Super Admin only
      {
        path: "accounts",
        element: (
          <ProtectedRoute requireSuperAdmin>
            <AccountManagePage />
          </ProtectedRoute>
        ),
      },
    ],
  },
])
