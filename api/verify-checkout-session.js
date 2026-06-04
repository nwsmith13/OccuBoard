import { sendJson, stripeGet } from "./stripeClient.js";
import { upsertSubscription } from "./billingStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJson(req);
    const sessionId = String(body.sessionId || "").trim();
    const userId = String(body.userId || "").trim();
    if (!sessionId || !userId) return sendJson(res, 400, { error: "Checkout session and user ID are required." });

    const session = await stripeGet(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
    const sessionUserId = session?.metadata?.user_id || "";
    if (sessionUserId && sessionUserId !== userId) return sendJson(res, 403, { error: "Checkout session does not match this user." });
    if (session?.status !== "complete" || !session?.subscription) {
      return sendJson(res, 200, { verified: false, status: session?.status || "unknown" });
    }

    const subscription = await stripeGet(`/subscriptions/${encodeURIComponent(session.subscription)}`);
    const stripeStatus = subscription?.status || "incomplete";
    const currentPeriodEnd = subscription?.current_period_end
      ? new Date(Number(subscription.current_period_end) * 1000).toISOString()
      : null;

    const saved = await upsertSubscription({
      user_id: userId,
      stripe_customer_id: session.customer,
      stripe_subscription_id: subscription.id,
      status: stripeStatus,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    });

    return sendJson(res, 200, {
      verified: ["active", "trialing", "past_due"].includes(stripeStatus),
      subscription: saved,
      status: stripeStatus,
    });
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.message || "Could not verify checkout." });
  }
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
