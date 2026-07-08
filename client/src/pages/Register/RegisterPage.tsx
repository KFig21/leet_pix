import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
// Shares the auth-page styling.
import "../Login/LoginPage.scss";

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    // After email confirmation + first sign-in, user completes profile in Settings.
    navigate("/home");
  };

  return (
    <div className="auth-page">
      <form className="auth-page__card" onSubmit={submit}>
        <h1 className="auth-page__title">Create account</h1>
        <p className="auth-page__subtitle">Join LeetPix.</p>

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
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        {error && <p className="auth-page__error">{error}</p>}

        <button className="auth-page__submit" disabled={busy}>
          {busy ? "Creating…" : "Sign up"}
        </button>

        <p className="auth-page__switch">
          Have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
