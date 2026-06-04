import { getSupabaseClient, hasSupabaseConfig } from "./supabase.js";

export const FREE_LIMIT = 3;
export const PRO_PRICE_ID = import.meta.env.VITE_STRIPE_PRO_PRICE_ID || "price_1Te8BxDhoHP54GBjlCbY2coq";

const localKeys = {
  subscription: "occuboard.billing.subscription",
  usage: "occuboard.billing.usage",
};

export const usageActions = {
  jobAnalysis: "job_analyses_used",
  resumeGeneration: "resume_generations_used",
  application: "application_count",
};

export function createDefaultBillingState(user) {
  return {
    subscription: {
      user_id: user?.id ?? "local-demo-user",
      plan: "free",
      status: "free",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_end: null,
      cancel_at_period_end: false,
    },
    usage: {
      user_id: user?.id ?? "local-demo-user",
      job_analyses_used: 0,
      resume_generations_used: 0,
      application_count: 0,
    },
  };
}

export async function fetchBillingState(user) {
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const [subscriptionResult, usageResult] = await Promise.all([
      supabase.from("user_subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_usage").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    const fallback = createDefaultBillingState(user);
    if (subscriptionResult.error && !isMissingBillingTable(subscriptionResult.error)) throw subscriptionResult.error;
    if (usageResult.error && !isMissingBillingTable(usageResult.error)) throw usageResult.error;
    const usage = usageResult.data || (await ensureUsageRow(user));
    return {
      subscription: subscriptionResult.data || fallback.subscription,
      usage: usage || fallback.usage,
    };
  }
  return readLocalBilling(user);
}

export async function incrementUsage(user, field) {
  if (!field) return null;
  if (hasSupabaseConfig && user?.id) {
    const current = await ensureUsageRow(user);
    const nextValue = Number(current?.[field] || 0) + 1;
    logBillingUsage("increment:start", { userId: user.id, field, currentUsage: current, nextValue });
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("user_usage")
      .upsert({ user_id: user.id, [field]: nextValue, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) {
      if (isMissingBillingTable(error) || isMissingBillingColumn(error)) {
        globalThis.console.warn("[OccuBoard billing] Supabase usage write unavailable; using local fallback.", error);
        const fallback = incrementLocalUsage(user, field);
        logBillingUsage("increment:fallback", { userId: user.id, field, updatedUsage: fallback });
        return fallback;
      }
      globalThis.console.error("[OccuBoard billing] Supabase usage write failed.", { userId: user.id, field, error });
      throw error;
    }
    logBillingUsage("increment:success", { userId: user.id, field, updatedUsage: data });
    return data;
  }
  const usage = incrementLocalUsage(user, field);
  logBillingUsage("increment:local", { userId: user?.id ?? "local-demo-user", field, updatedUsage: usage });
  return usage;
}

export async function setUsageValue(user, field, value) {
  if (!field) return null;
  const nextValue = Math.max(0, Number(value || 0));
  if (hasSupabaseConfig && user?.id) {
    logBillingUsage("set:start", { userId: user.id, field, nextValue });
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("user_usage")
      .upsert({ user_id: user.id, [field]: nextValue, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) {
      if (isMissingBillingTable(error) || isMissingBillingColumn(error)) {
        globalThis.console.warn("[OccuBoard billing] Supabase usage set unavailable; using local fallback.", error);
        const fallback = setLocalUsageValue(user, field, nextValue);
        logBillingUsage("set:fallback", { userId: user.id, field, updatedUsage: fallback });
        return fallback;
      }
      globalThis.console.error("[OccuBoard billing] Supabase usage set failed.", { userId: user.id, field, error });
      throw error;
    }
    logBillingUsage("set:success", { userId: user.id, field, updatedUsage: data });
    return data;
  }
  const usage = setLocalUsageValue(user, field, nextValue);
  logBillingUsage("set:local", { userId: user?.id ?? "local-demo-user", field, updatedUsage: usage });
  return usage;
}

export function isProSubscription(subscription = {}) {
  return subscription?.plan === "pro" || ["active", "trialing", "past_due"].includes(subscription?.status);
}

export function canUseUsageFeature(billing, field) {
  if (isProSubscription(billing?.subscription)) return true;
  return Number(billing?.usage?.[field] || 0) < FREE_LIMIT;
}

export function getUsageRemaining(billing, field) {
  if (isProSubscription(billing?.subscription)) return Infinity;
  return Math.max(0, FREE_LIMIT - Number(billing?.usage?.[field] || 0));
}

export function getPlanLabel(subscription = {}) {
  return isProSubscription(subscription) ? "Pro" : "Free";
}

export async function createCheckoutSession(user) {
  const response = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: user?.id, userEmail: user?.email }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not start checkout.");
  return data.url;
}

export async function createBillingPortalSession(user) {
  const response = await fetch("/api/create-billing-portal-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: user?.id }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not open billing portal.");
  return data.url;
}

export async function verifyCheckoutSession(user, sessionId) {
  if (!sessionId) return null;
  const response = await fetch("/api/verify-checkout-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: user?.id, sessionId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not verify checkout.");
  return data;
}

async function ensureUsageRow(user) {
  const fallback = createDefaultBillingState(user).usage;
  const supabase = await getSupabaseClient();
  const existing = await supabase.from("user_usage").select("*").eq("user_id", user.id).maybeSingle();
  if (existing.data) return existing.data;
  if (existing.error && !isMissingBillingTable(existing.error)) throw existing.error;
  if (existing.error && isMissingBillingTable(existing.error)) return fallback;
  const { data, error } = await supabase.from("user_usage").insert({ user_id: user.id }).select("*").single();
  if (error) {
    if (isMissingBillingTable(error)) return fallback;
    throw error;
  }
  return data;
}

function readLocalBilling(user) {
  const fallback = createDefaultBillingState(user);
  return {
    subscription: readLocal(localKeys.subscription, fallback.subscription),
    usage: readLocal(localKeys.usage, fallback.usage),
  };
}

function readLocal(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      window.localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return { ...fallback, ...JSON.parse(stored) };
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Billing local fallback is best-effort only.
  }
}

function incrementLocalUsage(user, field) {
  const state = readLocalBilling(user);
  const usage = { ...state.usage, [field]: Number(state.usage[field] || 0) + 1, updated_at: new Date().toISOString() };
  writeLocal(localKeys.usage, usage);
  return usage;
}

function setLocalUsageValue(user, field, value) {
  const state = readLocalBilling(user);
  const usage = { ...state.usage, [field]: value, updated_at: new Date().toISOString() };
  writeLocal(localKeys.usage, usage);
  return usage;
}

function isMissingBillingTable(error) {
  return error?.code === "PGRST205" || error?.message?.includes("schema cache") || error?.message?.includes("does not exist");
}

function isMissingBillingColumn(error) {
  return error?.code === "PGRST204" || error?.message?.includes("Could not find") || error?.message?.includes("column");
}

function logBillingUsage(event, payload) {
  globalThis.console.info(`[OccuBoard billing] ${event}`, payload);
}
