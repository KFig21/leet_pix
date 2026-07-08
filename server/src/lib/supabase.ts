import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

// Service-role client for privileged server operations (e.g. reading auth.users,
// admin tasks). Never expose the service-role key to the client.
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
