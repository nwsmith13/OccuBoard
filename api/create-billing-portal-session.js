import { getAppUrl, sendJson, stripeRequest } from "./stripeClient.js";
import { getSubscriptionByUserId } from "./billingStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJson(req);
    const userId = String(body.userId || "").trim();
    if (!userId) return sendJson(res, 400, { error: "User ID is required." });

    // TODO: Verify the caller's Supabase access token server-side once API auth middleware is introduced.
    const subscription = await getSubscriptionByUserId(userId);
    if (!subscription?.stripe_customer_id) {
      return sendJson(res, 404, { error: "No Stripe customer found for this account." });
    }

    const session = await stripeRequest("/billing_portal/sessions", {
      customer: subscription.stripe_customer_id,
      return_url: `${getAppUrl(req)}/app/settings`,
    });
    return sendJson(res, 200, { url: session.url });
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.message || "Could not open billing portal." });
  }
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

