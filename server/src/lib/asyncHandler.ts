import type { Request, Response, NextFunction, RequestHandler } from "express";

// Wraps async route handlers so thrown/rejected errors reach errorHandler.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
