const allowedTypes = new Set(["Feedback", "Bug Report", "Support Question", "Feature Request"]);
const defaultSupportInbox = "hello@occuboard.io";

export default async function handler(req, res) {
  setJson(res);
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const payload = normalizeSubmission(typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
    if (!payload.subject || !payload.message) return send(res, 400, { error: "Subject and message are required." });
    const apiKey = process.env.RESEND_API_KEY || "";
    const supportInbox = process.env.SUPPORT_EMAIL || defaultSupportInbox;
    const fromEmail = process.env.FROM_EMAIL || process.env.RESEND_FROM_EMAIL || supportInbox;
    if (!apiKey) {
      return send(res, 503, {
        error: "Support email is not configured yet. You can still email hello@occuboard.io directly.",
        code: "support_config_missing",
        mailto: "mailto:hello@occuboard.io",
      });
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: formatFromEmail(fromEmail),
        to: supportInbox,
        reply_to: payload.userEmail || undefined,
        subject: `[${payload.type}] ${payload.subject}`,
        html: buildHtmlEmail(payload),
        text: buildTextEmail(payload),
      }),
    });
    if (!response.ok) {
      await response.text().catch(() => "");
      return send(res, 502, {
        error: "Could not send support message. You can still email hello@occuboard.io directly.",
        mailto: "mailto:hello@occuboard.io",
      });
    }
    return send(res, 200, { ok: true });
  } catch {
    return send(res, 400, { error: "Could not send support message." });
  }
}

function formatFromEmail(value = "") {
  const email = String(value || defaultSupportInbox).trim();
  if (email.includes("<")) return email;
  return `OccuBoard <${email}>`;
}

function normalizeSubmission(input = {}) {
  const type = allowedTypes.has(input.type) ? input.type : "Feedback";
  return {
    type,
    subject: String(input.subject || "").trim().slice(0, 180),
    message: String(input.message || "").trim().slice(0, 12000),
    userEmail: String(input.userEmail || "").trim().slice(0, 320),
    currentUrl: String(input.currentUrl || "").trim().slice(0, 1000),
    userAgent: String(input.userAgent || "").trim().slice(0, 1000),
    timestamp: String(input.timestamp || new Date().toISOString()).trim(),
  };
}

function buildHtmlEmail(payload) {
  const rows = [
    ["User Email", payload.userEmail || "Not provided"],
    ["Type", payload.type],
    ["Current URL", payload.currentUrl || "Not provided"],
    ["Browser/User Agent", payload.userAgent || "Not provided"],
    ["Timestamp", payload.timestamp],
  ];
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;background:#f8fafc;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;border:1px solid #dbeafe;border-radius:18px;overflow:hidden;background:#ffffff;">
            <tr>
              <td style="padding:22px 24px;background:#eff6ff;border-bottom:1px solid #dbeafe;">
                <div style="font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#0f5ea8;">OccuBoard Support</div>
                <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(payload.type)} submission</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h2 style="margin:0 0 14px;font-size:18px;color:#0f172a;">${escapeHtml(payload.subject)}</h2>
                <div style="white-space:pre-wrap;border-radius:14px;background:#f8fafc;padding:16px;line-height:1.6;color:#334155;">${escapeHtml(payload.message)}</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-collapse:collapse;">
                  ${rows.map(([label, value]) => `<tr>
                    <td style="width:170px;padding:10px 12px;border-top:1px solid #e2e8f0;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">${escapeHtml(label)}</td>
                    <td style="padding:10px 12px;border-top:1px solid #e2e8f0;font-size:14px;line-height:1.5;color:#0f172a;">${escapeHtml(value)}</td>
                  </tr>`).join("")}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildTextEmail(payload) {
  return [
    `User Email: ${payload.userEmail || "Not provided"}`,
    `Type: ${payload.type}`,
    `Current URL: ${payload.currentUrl || "Not provided"}`,
    `Browser/User Agent: ${payload.userAgent || "Not provided"}`,
    `Timestamp: ${payload.timestamp}`,
    "",
    payload.message,
  ].join("\n");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setJson(res) {
  res.setHeader("Content-Type", "application/json");
}

function send(res, status, body) {
  res.statusCode = status;
  res.end(JSON.stringify(body));
}
