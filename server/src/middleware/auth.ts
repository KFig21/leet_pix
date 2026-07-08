import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";

export interface AuthedRequest extends Request {
  // Supabase auth user id (== Profile.id).
  userId?: string;
}

/**
 * Verifies the Supabase access token by validating it against Supabase Auth.
 * Works with any token signing method (legacy HS256 or asymmetric JWT keys),
 * so there's no shared JWT secret to configure.
 */
export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const token = header.slice("Bearer ".length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.userId = data.user.id;
  next();
}

/**
 * Like requireAuth but never rejects: sets req.userId when a valid token is
 * present, otherwise continues anonymously. Used by feeds that are richer when
 * signed in (e.g. tagging polls with the viewer's own vote).
 */
export async function optionalAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length);
    const { data } = await supabaseAdmin.auth.getUser(token);
    if (data.user) req.userId = data.user.id;
  }
  next();
}
