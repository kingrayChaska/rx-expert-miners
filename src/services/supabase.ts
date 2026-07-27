import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail loudly and early rather than throwing a confusing error deep inside
  // a random query — set these in a .env.local file (see .env.example).
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.",
  );
}

// Intentionally untyped generic: postgrest-js's newer query-parser infers
// column/relationship types from a CLI-generated `Database` type far more
// precisely than we can hand-author. Once you have Supabase CLI access to
// this project, run:
//   npx supabase gen types typescript --project-id <id> > src/types/supabase-generated.ts
// and pass `createClient<Database>(...)` instead — see src/types/database.ts
// for the row shapes we derived by hand from the migrations in the meantime.
export const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "", {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});

