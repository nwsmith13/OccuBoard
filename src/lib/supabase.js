const env = import.meta.env ?? {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

let clientPromise = null;

export async function getSupabaseClient() {
  if (!hasSupabaseConfig) return null;
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) => createClient(supabaseUrl, supabaseAnonKey));
  }
  return clientPromise;
}
