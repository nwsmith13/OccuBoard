import { getAppUrl, getProPriceId, sendJson, stripeRequest } from "./stripeClient.js";
import { getSubscriptionByUserId, upsertSubscription } from "./billingStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJson(req);
    const userId = String(body.userId || "").trim();
    const userEmail = String(body.userEmail || "").trim();
    if (!userId || !userEmail) return sendJson(res, 400, { error: "User ID and email are required." });

    // TODO: Verify the caller's Supabase access token server-side once API auth middleware is introduced.
    const existing = await getSubscriptionByUserId(userId);
    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripeRequest("/customers", {
        email: userEmail,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
      await upsertSubscription({ user_id: userId, stripe_customer_id: customerId, status: existing?.status || "free" });
    }

    const appUrl = getAppUrl(req);
    const session = await stripeRequest("/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      success_url: `${appUrl}/app/settings?billing=success`,
      cancel_url: `${appUrl}/app/settings?billing=cancelled`,
      line_items: [{ price: getProPriceId(), quantity: 1 }],
      metadata: { user_id: userId },
      subscription_data: { metadata: { user_id: userId } },
      allow_promotion_codes: true,
    });
    return sendJson(res, 200, { url: session.url });
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.message || "Could not start checkout." });
  }
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

