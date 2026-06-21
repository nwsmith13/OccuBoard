const env = import.meta.env ?? {};
const supabaseUrl = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim();
const supabaseAnonKey = String(
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_ANON_KEY_VALUE ||
  env.VITE_SUPABASE_PUBLIC_ANON_KEY ||
  env.VITE_SUPABASE_KEY ||
  "",
).trim();

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

let clientPromise = null;

export async function getSupabaseClient() {
  if (!hasSupabaseConfig) return null;
  if (!clientPromise) {
    logSupabaseConfig("supabaseClient");
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) => createClient(supabaseUrl, supabaseAnonKey));
  }
  return clientPromise;
}

export function getSupabaseConfigDebug() {
  return {
    path: hasSupabaseConfig ? "supabaseClient" : "localFallback",
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseAnonKey),
    urlHost: safeHost(supabaseUrl),
  };
}

function logSupabaseConfig(path) {
  try {
    globalThis.console?.info?.("[supabase-config]", { ...getSupabaseConfigDebug(), path });
  } catch {
    // Debug logging should not affect app startup.
  }
}

function safeHost(value = "") {
  return String(value).replace(/^https?:\/\//i, "").split("/")[0] || "";
}
