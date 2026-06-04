import { URLSearchParams } from "node:url";

const stripeApiBase = "https://api.stripe.com/v1";
const proPriceId = process.env.STRIPE_PRO_PRICE_ID || "price_1Te8BxDhoHP54GBjlCbY2coq";

export function getAppUrl(req) {
  return process.env.APP_URL || `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
}

export function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY || "";
}

export function getProPriceId() {
  return proPriceId;
}

export async function stripeRequest(path, params = {}) {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    const error = new Error("Stripe is not configured yet. Add STRIPE_SECRET_KEY in test mode.");
    error.status = 503;
    throw error;
  }
  const response = await fetch(`${stripeApiBase}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: toStripeForm(params),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error?.message || "Stripe request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function stripeGet(path) {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    const error = new Error("Stripe is not configured yet. Add STRIPE_SECRET_KEY in test mode.");
    error.status = 503;
    throw error;
  }
  const response = await fetch(`${stripeApiBase}${path}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${secretKey}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error?.message || "Stripe request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function toStripeForm(params = {}) {
  const form = new URLSearchParams();
  appendParams(form, params);
  return form;
}

function appendParams(form, value, prefix = "") {
  Object.entries(value || {}).forEach(([key, entry]) => {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (entry === undefined || entry === null) return;
    if (Array.isArray(entry)) {
      entry.forEach((item, index) => appendParams(form, item, `${name}[${index}]`));
      return;
    }
    if (typeof entry === "object") {
      appendParams(form, entry, name);
      return;
    }
    form.append(name, String(entry));
  });
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}
