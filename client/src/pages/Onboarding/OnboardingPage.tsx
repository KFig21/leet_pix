import { Navigate } from "react-router-dom";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { Loader } from "@/components/Loader/Loader";
import { OnboardingWizard } from "./OnboardingWizard";

// Route target for /onboarding. Already-finished users are bounced to home so
// the wizard can't be re-entered by URL.
export function OnboardingPage() {
  const { data, isLoading } = useOnboardingStatus();
  if (isLoading) return <Loader />;
  if (data?.completed) return <Navigate to="/home" replace />;
  return <OnboardingWizard startStep={data?.step ?? 0} />;
}
