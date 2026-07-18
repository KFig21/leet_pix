import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { AuthShell } from "@/components/AuthShell/AuthShell";

// Landing page for the reset-password email link. Supabase parses the recovery
// token from the URL and establishes a temporary session; we then let the user
// set a new password via updateUser.
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setChecking(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    setDone(true);
    // Drop the recovery session so they sign in fresh with the new password.
    await supabase.auth.signOut();
    setTimeout(() => navigate("/login"), 1500);
  };

  return (
    <AuthShell>
      <div className="auth-page__card">
        <h1 className="auth-page__title">Set a new password</h1>

        {done ? (
          <p className="auth-page__subtitle">
            Password updated. Redirecting you to sign in…
          </p>
        ) : checking ? (
          <p className="auth-page__subtitle">Verifying your reset link…</p>
        ) : ready ? (
          <form onSubmit={submit} className="auth-page__form">
            <p className="auth-page__subtitle">Choose a new password.</p>
            <input
              className="auth-page__input"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
            {error && <p className="auth-page__error">{error}</p>}
            <button className="auth-page__submit" disabled={busy}>
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        ) : (
          <>
            <p className="auth-page__subtitle">
              This reset link is invalid or has expired. Request a new one.
            </p>
            <p className="auth-page__switch">
              <Link to="/forgot-password">Send a new link</Link>
            </p>
          </>
        )}
      </div>
    </AuthShell>
  );
}
