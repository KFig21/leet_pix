import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader } from "@/components/Loader/Loader";
import "./ReactivateGate.scss";

// Sits inside the authed shell. A deactivated user who signs back in lands here
// first: they either reactivate (restoring their profile/polls/picks) or log out
// and stay hidden. Works for both password and OAuth returns.
export function ReactivateGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["account-status"],
    queryFn: async () => {
      try {
        return await api.get<{ deactivatedAt: string | null }>("/profiles/me");
      } catch (e) {
        // No profile yet (brand-new user) — nothing to reactivate.
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });

  if (isLoading) return <Loader />;

  const deactivated = !isError && data?.deactivatedAt != null;
  if (!deactivated) return <>{children}</>;

  const reactivate = async () => {
    setBusy(true);
    try {
      await api.post("/profiles/me/reactivate");
      await qc.invalidateQueries({ queryKey: ["account-status"] });
      // The feed/profile/search now include us again.
      qc.invalidateQueries({ queryKey: ["timeline"] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reactivate">
      <div className="reactivate__card">
        <h1 className="reactivate__title">Welcome back</h1>
        <p className="reactivate__body">
          Your account is deactivated, so it's hidden from everyone else. Your
          polls and picks are safe — reactivate to make your profile visible
          again.
        </p>
        <div className="reactivate__actions">
          <button
            type="button"
            className="reactivate__primary"
            onClick={reactivate}
            disabled={busy}
          >
            {busy ? "Reactivating…" : "Reactivate my account"}
          </button>
          <button
            type="button"
            className="reactivate__ghost"
            onClick={signOut}
            disabled={busy}
          >
            Stay hidden — log out
          </button>
        </div>
      </div>
    </div>
  );
}
