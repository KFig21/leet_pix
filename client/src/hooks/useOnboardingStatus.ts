import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface OnboardingStatus {
  step: number;
  completed: boolean;
}

// The signed-in user's setup-wizard progress. Never 404s server-side, so a
// brand-new user (no profile row yet) reads as { step: 0, completed: false }.
export function useOnboardingStatus() {
  return useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => api.get<OnboardingStatus>("/profiles/me/onboarding"),
    staleTime: 60_000,
  });
}
