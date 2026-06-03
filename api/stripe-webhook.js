import { createHmac, timingSafeEqual } from "node:crypto";
import { sendJson } from "./stripeClient.js";
import { getSubscriptionByCustomerId, updateSubscriptionByStripeId, upsertSubscription } from "./billingStore.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  const rawBody = await readRawBody(req);
  try {
    verifyStripeSignature(rawBody, req.headers["stripe-signature"] || "");
  } catch {
    return sendJson(res, 400, { error: "Invalid Stripe webhook signature." });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return sendJson(res, 400, { error: "Invalid webhook payload." });
  }

  try {
    await handleEvent(event);
    return sendJson(res, 200, { received: true });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Webhook handling failed." });
  }
}

async function handleEvent(event) {
  const object = event?.data?.object || {};
  if (event.type === "checkout.session.completed") {
    const userId = object.metadata?.user_id;
    if (!userId) return;
    await upsertSubscription({
      user_id: userId,
      stripe_customer_id: object.customer,
      stripe_subscription_id: object.subscription,
      status: "active",
    });
    return;
  }

  if (event.type?.startsWith("customer.subscription.")) {
    await syncSubscription(object);
    return;
  }

  if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
    const subscriptionId = object.subscription;
    if (!subscriptionId) return;
    await updateSubscriptionByStripeId(subscriptionId, {
      status: event.type === "invoice.payment_failed" ? "past_due" : "active",
    });
  }
}

async function syncSubscription(subscription = {}) {
  const userId = subscription.metadata?.user_id || (await getSubscriptionByCustomerId(subscription.customer))?.user_id;
  if (!userId) return;
  const item = subscription.items?.data?.[0];
  await upsertSubscription({
    user_id: userId,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    stripe_price_id: item?.price?.id || null,
    status: subscription.status === "canceled" ? "canceled" : subscription.status,
    current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
  });
}

function verifyStripeSignature(rawBody, signatureHeader) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret) throw new Error("Missing webhook secret.");
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => part.split("=", 2)));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) throw new Error("Missing signature parts.");
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("Signature mismatch.");
  }
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

