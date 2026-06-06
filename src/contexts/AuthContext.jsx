import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseClient, hasSupabaseConfig } from "../lib/supabase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      return undefined;
    }

    let cancelled = false;
    let subscription = null;

    getSupabaseClient().then((supabase) => {
      if (!supabase || cancelled) return;
      supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setLoading(false);
      });

      const authState = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        setLoading(false);
      });
      subscription = authState.data.subscription;
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      isConfigured: hasSupabaseConfig,
      signIn: async (email, password) => {
        const supabase = await getSupabaseClient();
        return supabase.auth.signInWithPassword({ email, password });
      },
      signUp: async (email, password, fullName) => {
        const supabase = await getSupabaseClient();
        return supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: getEmailConfirmationRedirect(),
          },
        });
      },
      requestPasswordReset: async (email) => {
        const supabase = await getSupabaseClient();
        return supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getPasswordResetRedirect(),
        });
      },
      updatePassword: async (password) => {
        const supabase = await getSupabaseClient();
        return supabase.auth.updateUser({ password });
      },
      signOut: async () => {
        const supabase = await getSupabaseClient();
        return supabase.auth.signOut();
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function getEmailConfirmationRedirect() {
  return `${getAuthRedirectOrigin()}/login?confirmed=1`;
}

function getPasswordResetRedirect() {
  return `${getAuthRedirectOrigin()}/reset-password`;
}

function getAuthRedirectOrigin() {
  const configuredUrl = import.meta.env.VITE_APP_URL?.trim();
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const origin = configuredUrl || (isLocal ? "http://localhost:5173" : "https://www.occuboard.io");
  return origin.replace(/\/+$/, "");
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
