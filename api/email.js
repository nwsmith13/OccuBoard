const defaultFromEmail = "OccuBoard <hello@occuboard.io>";

export async function sendWelcomeEmail({ email, firstName }) {
  const to = String(email || "").trim();
  if (!to) {
    const error = new Error("Welcome email recipient is missing.");
    error.code = "missing_recipient";
    throw error;
  }
  return sendResendEmail({
    to,
    subject: "Welcome to OccuBoard Pro",
    html: buildWelcomeHtml({ firstName }),
    text: buildWelcomeText({ firstName }),
  });
}

export async function sendResendEmail({ to, subject, html, text, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY || "";
  if (!apiKey) {
    const error = new Error("RESEND_API_KEY is not configured.");
    error.code = "resend_config_missing";
    throw error;
  }
  const from = resolveFromEmail(process.env.FROM_EMAIL);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: replyTo || undefined,
      subject,
      html,
      text,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = new Error("Resend email request failed.");
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return response.json();
}

function resolveFromEmail(value = "") {
  const email = String(value || "").trim();
  if (!email || /occuboard\.com/i.test(email)) return defaultFromEmail;
  return email.includes("<") ? email : `OccuBoard <${email}>`;
}

function buildWelcomeHtml({ firstName }) {
  const greetingName = escapeHtml(firstName || "there");
  const benefits = [
    "Unlimited job analyses",
    "Unlimited resume tailoring",
    "Unlimited recruiter messages",
    "Unlimited interview preparation",
    "Application tracking and organization",
    "Priority access to new improvements",
  ];
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>Welcome to OccuBoard Pro</title>
  </head>
  <body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">Your account is ready. Let's start building stronger applications.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;overflow:hidden;border:1px solid #dbeafe;border-radius:20px;background:#ffffff;box-shadow:0 18px 45px rgba(15,94,168,0.08);">
            <tr>
              <td style="background:#eff6ff;padding:28px 28px 24px;border-bottom:1px solid #dbeafe;">
                <img src="https://www.occuboard.io/Assets/occuboard-logo-email.png" alt="OccuBoard" width="180" style="display:block;width:180px;max-width:100%;height:auto;margin:0 0 22px;" />
                <div style="font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#0f5ea8;">OccuBoard Pro</div>
                <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;color:#0f172a;">Welcome to OccuBoard Pro</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0;font-size:16px;line-height:1.7;color:#334155;">Hi ${greetingName},</p>
                <p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:#334155;">Thank you for subscribing to OccuBoard Pro. Your account is now active and ready to use.</p>
                <div style="margin-top:24px;border-radius:16px;background:#f8fafc;padding:18px;border:1px solid #e2e8f0;">
                  <h2 style="margin:0 0 12px;font-size:17px;color:#0f172a;">Your Pro account includes:</h2>
                  <ul style="margin:0;padding-left:20px;color:#334155;font-size:15px;line-height:1.8;">
                    ${benefits.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
                  </ul>
                </div>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px;">
                  <tr>
                    <td>
                      <a href="https://www.occuboard.io/" style="display:inline-block;border-radius:12px;background:#0f5ea8;color:#ffffff;font-weight:800;text-decoration:none;padding:13px 18px;font-size:15px;">Open OccuBoard</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#475569;">If you have questions, feedback, or run into any issues, simply reply to this email.</p>
                <p style="margin:22px 0 0;font-size:15px;line-height:1.7;color:#334155;">Thank you for supporting OccuBoard.</p>
                <p style="margin:18px 0 0;font-size:15px;line-height:1.6;color:#0f172a;">Matthew Smith<br /><span style="color:#475569;">Founder, Occuboard.io</span></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildWelcomeText({ firstName }) {
  return [
    "Welcome to OccuBoard Pro",
    "",
    `Hi ${firstName || "there"},`,
    "",
    "Thank you for subscribing to OccuBoard Pro. Your account is now active and ready to use.",
    "",
    "Your Pro account includes:",
    "- Unlimited job analyses",
    "- Unlimited resume tailoring",
    "- Unlimited recruiter messages",
    "- Unlimited interview preparation",
    "- Application tracking and organization",
    "- Priority access to new improvements",
    "",
    "Open OccuBoard: https://www.occuboard.io/",
    "",
    "If you have questions, feedback, or run into any issues, simply reply to this email.",
    "",
    "Thank you for supporting OccuBoard.",
    "",
    "Matthew Smith",
    "Founder, Occuboard.io",
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
