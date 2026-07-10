import { Router } from "express";
import { env } from "../env";
import { prisma } from "../lib/prisma";
import { supabaseAdmin } from "../lib/supabase";
import { asyncHandler } from "../lib/asyncHandler";
import { HttpError } from "../middleware/error";
import { loginLimiter, passwordResetLimiter } from "../middleware/rateLimit";

export const authRouter = Router();

// Resolve an email-or-username identifier to an account email (null if unknown).
async function emailForIdentifier(identifier: string): Promise<string | null> {
  const value = identifier.trim();
  if (value.includes("@")) return value;
  const profile = await prisma.profile.findFirst({
    where: { username: { equals: value, mode: "insensitive" } },
    select: { id: true },
  });
  if (!profile) return null;
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  return error ? null : (data.user?.email ?? null);
}

// Password sign-in that accepts either an email or a username. Usernames are
// resolved to the account email server-side (via the service role), so the
// email is never exposed to the client and usernames can't be enumerated —
// every failure returns the same generic error.
authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body ?? {};
    if (
      typeof identifier !== "string" ||
      typeof password !== "string" ||
      !identifier.trim() ||
      !password
    ) {
      throw new HttpError(400, "Missing credentials");
    }

    const invalid = new HttpError(401, "Invalid login credentials");
    const email = await emailForIdentifier(identifier);
    if (!email) throw invalid;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) throw invalid;

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }),
);

// Send a password-reset email. Accepts email or username, always responds 200
// (no account enumeration), and links back to the client's reset page.
authRouter.post(
  "/forgot-password",
  passwordResetLimiter,
  asyncHandler(async (req, res) => {
    const { identifier } = req.body ?? {};
    if (typeof identifier === "string" && identifier.trim()) {
      const email = await emailForIdentifier(identifier);
      if (email) {
        await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: `${env.CLIENT_ORIGIN}/reset-password`,
        });
      }
    }
    // Same response whether or not the account exists.
    res.json({ ok: true });
  }),
);
