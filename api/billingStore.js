const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

export const proStatuses = new Set(["active", "trialing", "past_due"]);
export const freeLimit = 3;

export function hasBillingDatabase() {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

export async function getSubscriptionByUserId(userId) {
  if (!hasBillingDatabase() || !userId) return null;
  const result = await supabaseRest(`/user_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=*`, { method: "GET" });
  return result?.[0] ?? null;
}

export async function getSubscriptionByCustomerId(customerId) {
  if (!hasBillingDatabase() || !customerId) return null;
  const result = await supabaseRest(`/user_subscriptions?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=*`, { method: "GET" });
  return result?.[0] ?? null;
}

export async function getUsageByUserId(userId) {
  if (!hasBillingDatabase() || !userId) return null;
  const result = await supabaseRest(`/user_usage?user_id=eq.${encodeURIComponent(userId)}&select=*`, { method: "GET" });
  return result?.[0] ?? null;
}

export async function upsertSubscription(payload = {}) {
  if (!hasBillingDatabase() || !payload.user_id) return null;
  const status = payload.status || "free";
  const plan = proStatuses.has(status) ? "pro" : "free";
  return supabaseRest("/user_subscriptions?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      plan,
      updated_at: new Date().toISOString(),
      ...payload,
      status,
    }),
  }).then((rows) => rows?.[0] ?? null);
}

export async function updateSubscriptionByStripeId(subscriptionId, payload = {}) {
  if (!hasBillingDatabase() || !subscriptionId) return null;
  const status = payload.status || "free";
  const plan = proStatuses.has(status) ? "pro" : "free";
  return supabaseRest(`/user_subscriptions?stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...payload, plan, status, updated_at: new Date().toISOString() }),
  }).then((rows) => rows?.[0] ?? null);
}

export async function markWelcomeEmailSent(userId) {
  if (!hasBillingDatabase() || !userId) return null;
  return supabaseRest(`/user_subscriptions?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ welcome_email_sent: true, updated_at: new Date().toISOString() }),
  }).then((rows) => rows?.[0] ?? null);
}

async function supabaseRest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: supabaseServiceKey,
      authorization: `Bearer ${supabaseServiceKey}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Billing database request failed.");
  }
  if (response.status === 204) return null;
  return response.json();
}
