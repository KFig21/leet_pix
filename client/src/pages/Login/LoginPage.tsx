import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import "./LoginPage.scss";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    navigate("/home");
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
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          No account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}
