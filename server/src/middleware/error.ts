import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

/** Throw this for expected, client-facing failures. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res
      .status(422)
      .json({ error: "Validation failed", details: err.flatten() });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error" });
}
