import express from "express";
import helmet from "helmet";
import cors, { type CorsOptions } from "cors";
import { env } from "./env";
import { errorHandler } from "./middleware/error";
import { apiLimiter } from "./middleware/rateLimit";
import { authRouter } from "./routes/auth";
import { profilesRouter } from "./routes/profiles";
import { pollsRouter } from "./routes/polls";
import { votesRouter } from "./routes/votes";
import { scoringFormatsRouter } from "./routes/scoringFormats";
import { statsRouter } from "./routes/stats";
import { searchRouter } from "./routes/search";
import { exploreRouter } from "./routes/explore";
import { notificationsRouter } from "./routes/notifications";
import { playersRouter } from "./routes/players";
import { startScheduler } from "./scheduler";

const app = express();

// In production we sit behind a proxy/load balancer; trust the first hop so
// rate limiting keys on the real client IP (X-Forwarded-For) rather than the
// proxy's. Left off in dev (direct localhost).
if (env.NODE_ENV === "production") app.set("trust proxy", 1);

// In dev, accept any localhost port so Vite jumping ports (5173 → 5174 …)
// doesn't break API calls. In production, lock to the configured origin.
const corsOptions: CorsOptions = {
  origin:
    env.NODE_ENV === "development"
      ? (origin, cb) =>
          cb(
            null,
            !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin),
          )
      : env.CLIENT_ORIGIN,
};

// Security headers (this is a JSON API, so helmet's defaults are a clean fit).
app.use(helmet());
app.use(cors(corsOptions));
// Cap request bodies — nothing we accept is large; blocks oversized payloads.
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Generous catch-all rate limit across the API (auth routes add stricter caps).
app.use("/api", apiLimiter);

app.use("/api/auth", authRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/polls", pollsRouter);
app.use("/api/votes", votesRouter);
app.use("/api/scoring-formats", scoringFormatsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/search", searchRouter);
app.use("/api/explore", exploreRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/players", playersRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`🏈 LeetPix API on http://localhost:${env.PORT}`);
  startScheduler();
});
