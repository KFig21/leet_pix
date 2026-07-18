import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { AuthShell, GoogleButton } from "@/components/AuthShell/AuthShell";

interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Resolve username-or-email server-side, then hydrate the client session.
      const { access_token, refresh_token } = await api.post<LoginResponse>(
        "/auth/login",
        { identifier, password },
      );
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (error) throw error;
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid login credentials");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  return (
    <AuthShell>
      <form className="auth-page__card" onSubmit={submit}>
        <h1 className="auth-page__title">Welcome back</h1>
        <p className="auth-page__subtitle">Sign in to make your picks.</p>

        <div className="auth-page__field">
          <label className="auth-page__label" htmlFor="login-id">
            Email or username
          </label>
          <input
            id="login-id"
            className="auth-page__input"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="you@example.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
        <div className="auth-page__field">
          <label className="auth-page__label" htmlFor="login-pw">
            Password
          </label>
          <input
            id="login-pw"
            className="auth-page__input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="auth-page__error">{error}</p>}

        <button className="auth-page__submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div className="auth-page__divider">or</div>
        <GoogleButton onClick={oauth} />

        <p className="auth-page__switch">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <p className="auth-page__switch">
          No account? <Link to="/register">Create one</Link>
        </p>
      </form>
    </AuthShell>
  );
}
