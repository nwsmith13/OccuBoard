import { getSubscriptionByUserId, getUsageByUserId, proStatuses, upsertSubscription } from "./billingStore.js";
import { sendJson, stripeGet } from "./stripeClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJson(req);
    const userId = String(body.userId || "").trim();
    if (!userId) return sendJson(res, 400, { error: "User ID is required." });
    const [storedSubscription, usage] = await Promise.all([
      getSubscriptionByUserId(userId),
      getUsageByUserId(userId),
    ]);
    const subscription = await refreshStripeSubscriptionIfNeeded(userId, storedSubscription);
    return sendJson(res, 200, { subscription, usage });
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.message || "Could not load billing state." });
  }
}

async function refreshStripeSubscriptionIfNeeded(userId, subscription) {
  if (!subscription?.stripe_subscription_id || !proStatuses.has(subscription.status)) return subscription;
  if (subscription.current_period_end) return subscription;
  try {
    const stripeSubscription = await stripeGet(`/subscriptions/${encodeURIComponent(subscription.stripe_subscription_id)}`);
    const bestFreeUntil = getBestFreeUntilDate(stripeSubscription);
    const item = stripeSubscription.items?.data?.[0];
    return await upsertSubscription({
      ...subscription,
      user_id: userId,
      stripe_customer_id: stripeSubscription.customer || subscription.stripe_customer_id,
      stripe_subscription_id: stripeSubscription.id,
      stripe_price_id: item?.price?.id || subscription.stripe_price_id || null,
      status: stripeSubscription.status || subscription.status,
      current_period_end: bestFreeUntil,
      cancel_at_period_end: Boolean(stripeSubscription.cancel_at_period_end),
    }) || { ...subscription, current_period_end: bestFreeUntil };
  } catch (error) {
    globalThis.console?.warn?.("[billing-state] Stripe subscription date refresh failed", {
      subscriptionId: subscription.stripe_subscription_id,
      message: error?.message,
    });
    return subscription;
  }
}

function getBestFreeUntilDate(subscription = {}) {
  const discountEnd = getDiscountEnd(subscription);
  if (discountEnd) return toIsoDate(discountEnd);
  if (subscription.trial_end) return toIsoDate(subscription.trial_end);
  if (hasActiveFreeDiscount(subscription) && subscription.current_period_end) return toIsoDate(subscription.current_period_end);
  return subscription.current_period_end ? toIsoDate(subscription.current_period_end) : null;
}

function getDiscountEnd(subscription = {}) {
  const discounts = [
    subscription.discount,
    ...(Array.isArray(subscription.discounts) ? subscription.discounts : []),
  ].filter(Boolean);
  const activeFreeDiscount = discounts.find((discount) => isFreeDiscount(discount));
  return activeFreeDiscount?.end || null;
}

function hasActiveFreeDiscount(subscription = {}) {
  return Boolean(subscription.discount && isFreeDiscount(subscription.discount))
    || (Array.isArray(subscription.discounts) && subscription.discounts.some(isFreeDiscount));
}

function isFreeDiscount(discount = {}) {
  const coupon = discount.coupon || discount.promotion_code?.coupon || {};
  return Number(coupon.percent_off || 0) >= 100 || Number(coupon.amount_off || 0) > 0;
}

function toIsoDate(unixSeconds) {
  const value = Number(unixSeconds || 0);
  return value ? new Date(value * 1000).toISOString() : null;
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
