import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { Loader } from "@/components/Loader/Loader";

// Sits inside the authed app shell: users who haven't finished the setup wizard
// are sent to /onboarding before they can use the app.
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useOnboardingStatus();
  // On error, don't trap the user in a redirect loop — let them into the app.
  if (isLoading) return <Loader />;
  if (!isError && data && !data.completed) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
