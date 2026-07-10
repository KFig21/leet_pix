import rateLimit, { type Options } from "express-rate-limit";

// Shared factory so every limiter returns the same JSON error shape as the rest
// of the API ({ error }) and counts only failed attempts where it makes sense.
function make(opts: Partial<Options> & Pick<Options, "windowMs" | "limit">) {
  return rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) =>
      res
        .status(429)
        .json({ error: "Too many attempts. Please try again in a bit." }),
    ...opts,
  });
}

// Brute-force guard on password sign-in: per IP, only failed logins count toward
// the limit (a successful sign-in shouldn't penalize a shared IP).
export const loginLimiter = make({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 10,
  skipSuccessfulRequests: true,
});

// Password-reset requests are cheaper to abuse (email spam / enumeration probing),
// so cap them tighter per IP.
export const passwordResetLimiter = make({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
});

// Generous catch-all across the API to blunt floods/DoS, sized well above normal
// use (the client polls + fires several queries per page). Stricter per-endpoint
// limiters (auth) stack on top of this.
export const apiLimiter = make({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 1000,
});
