import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import "./LoginPage.scss";

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
    <div className="auth-page">
      <form className="auth-page__card" onSubmit={submit}>
        <h1 className="auth-page__title">LeetPix</h1>
        <p className="auth-page__subtitle">Sign in to make your picks.</p>

        <input
          className="auth-page__input"
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="Email or username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
        <input
          className="auth-page__input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="auth-page__error">{error}</p>}

        <button className="auth-page__submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <button type="button" className="auth-page__oauth" onClick={oauth}>
          Continue with Google
        </button>

        <p className="auth-page__switch">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <p className="auth-page__switch">
          No account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}
