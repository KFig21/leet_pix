import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import "../Login/LoginPage.scss";

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { identifier });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      {sent ? (
        <div className="auth-page__card">
          <h1 className="auth-page__title">LeetPix</h1>
          <p className="auth-page__subtitle">
            If an account matches that, we’ve emailed a password reset link. Check
            your inbox (and spam).
          </p>
          <p className="auth-page__switch">
            <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      ) : (
        <form className="auth-page__card" onSubmit={submit}>
          <h1 className="auth-page__title">Reset password</h1>
          <p className="auth-page__subtitle">
            Enter your email or username and we’ll send you a reset link.
          </p>

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
          {error && <p className="auth-page__error">{error}</p>}

          <button className="auth-page__submit" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
          <p className="auth-page__switch">
            <Link to="/login">Back to sign in</Link>
          </p>
        </form>
      )}
    </div>
  );
}
