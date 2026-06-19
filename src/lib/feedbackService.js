export const feedbackTypes = [
  { value: "Feedback", label: "Feedback" },
  { value: "Bug Report", label: "Bug Report" },
  { value: "Support Question", label: "Support Question" },
  { value: "Feature Request", label: "Feature Request" },
];

export function normalizeFeedbackPayload(input = {}) {
  const type = feedbackTypes.some((item) => item.value === input.type) ? input.type : "Feedback";
  return {
    type,
    subject: String(input.subject || "").trim(),
    message: String(input.message || "").trim(),
    userEmail: String(input.userEmail || "").trim(),
    currentUrl: String(input.currentUrl || (typeof window !== "undefined" ? window.location.href : "")).trim(),
    userAgent: String(input.userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "")).trim(),
    timestamp: input.timestamp || new Date().toISOString(),
  };
}

export async function submitFeedback(input = {}) {
  const payload = normalizeFeedbackPayload(input);
  const response = await fetch("/api/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  if (!response.ok) {
    const error = new Error(data?.error || "Could not send your message. Please try again.");
    error.status = response.status;
    error.code = data?.code || "";
    error.mailto = data?.mailto || "";
    throw error;
  }
  return data;
}

async function safeJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return {};
  try {
    return await response.json();
  } catch {
    return {};
  }
}
