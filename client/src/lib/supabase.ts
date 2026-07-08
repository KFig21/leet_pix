import { createClient } from "@supabase/supabase-js";

// Browser client. Uses the public anon key; RLS protects data server-side.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
