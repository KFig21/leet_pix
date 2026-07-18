import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { AuthShell, GoogleButton } from "@/components/AuthShell/AuthShell";

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
    // After email confirmation + first sign-in, the setup wizard runs.
    navigate("/home");
  };

  const oauth = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  return (
    <AuthShell>
      <form className="auth-page__card" onSubmit={submit}>
        <h1 className="auth-page__title">Create your account</h1>
        <p className="auth-page__subtitle">
          Join LeetPix and start settling debates.
        </p>

        <div className="auth-page__field">
          <label className="auth-page__label" htmlFor="reg-email">
            Email
          </label>
          <input
            id="reg-email"
            className="auth-page__input"
            type="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="auth-page__field">
          <label className="auth-page__label" htmlFor="reg-pw">
            Password
          </label>
          <input
            id="reg-pw"
            className="auth-page__input"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        {error && <p className="auth-page__error">{error}</p>}

        <button className="auth-page__submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>

        <div className="auth-page__divider">or</div>
        <GoogleButton onClick={oauth} label="Sign up with Google" />

        <p className="auth-page__switch">
          Have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
