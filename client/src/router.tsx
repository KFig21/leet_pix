import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute/ProtectedRoute";
import { LandingPage } from "@/pages/Landing/LandingPage";
import { LoginPage } from "@/pages/Login/LoginPage";
import { RegisterPage } from "@/pages/Register/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPassword/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPassword/ResetPasswordPage";
import { TimelinePage } from "@/pages/Timeline/TimelinePage";
import { NotificationsPage } from "@/pages/Notifications/NotificationsPage";
import { ProfilePage } from "@/pages/Profile/ProfilePage";
import { PollCreatePage } from "@/pages/PollCreate/PollCreatePage";
import { PollViewPage } from "@/pages/PollView/PollViewPage";
import { SearchPage } from "@/pages/Search/SearchPage";
import { SettingsPage } from "@/pages/Settings/SettingsPage";
import { ScoringFormatCreatorPage } from "@/pages/ScoringFormatCreator/ScoringFormatCreatorPage";
import { LeagueCreatorPage } from "@/pages/LeagueCreator/LeagueCreatorPage";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: "/home", element: <TimelinePage /> },
      { path: "/explore", element: <Navigate to="/search" replace /> },
      { path: "/notifications", element: <NotificationsPage /> },
      { path: "/search", element: <SearchPage /> },
      { path: "/create", element: <PollCreatePage /> },
      { path: "/polls/:id", element: <PollViewPage /> },
      { path: "/u/:username", element: <ProfilePage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/scoring/new", element: <ScoringFormatCreatorPage /> },
      { path: "/scoring/:id/edit", element: <ScoringFormatCreatorPage /> },
      { path: "/leagues/new", element: <LeagueCreatorPage /> },
      { path: "/leagues/:id/edit", element: <LeagueCreatorPage /> },
    ],
  },
]);
