import express from "express";
import cors, { type CorsOptions } from "cors";
import { env } from "./env";
import { errorHandler } from "./middleware/error";
import { profilesRouter } from "./routes/profiles";
import { pollsRouter } from "./routes/polls";
import { votesRouter } from "./routes/votes";
import { scoringFormatsRouter } from "./routes/scoringFormats";
import { statsRouter } from "./routes/stats";
import { searchRouter } from "./routes/search";
import { exploreRouter } from "./routes/explore";
import { notificationsRouter } from "./routes/notifications";
import { playersRouter } from "./routes/players";

const app = express();

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

app.use(cors(corsOptions));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

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
});
