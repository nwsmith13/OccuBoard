import { getSubscriptionByUserId, getUsageByUserId } from "./billingStore.js";
import { sendJson } from "./stripeClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJson(req);
    const userId = String(body.userId || "").trim();
    if (!userId) return sendJson(res, 400, { error: "User ID is required." });
    const [subscription, usage] = await Promise.all([
      getSubscriptionByUserId(userId),
      getUsageByUserId(userId),
    ]);
    return sendJson(res, 200, { subscription, usage });
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.message || "Could not load billing state." });
  }
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
