import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { z } from "zod";

// .env lives at the repo root, one level above server/.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env") });

// Loaded from the repo-root .env (see .env.example). Fail fast if misconfigured.
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // No longer required: tokens are verified via Supabase Auth (see middleware/auth.ts).
  SUPABASE_JWT_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
