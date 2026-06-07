const analyticsStorageKey = "occuboard:product-events";
export const productAnalyticsEvent = "occuboard:product-event";

export function trackProductEvent(name, metadata = {}) {
  if (!name) return;
  const event = {
    name,
    metadata,
    occurredAt: new Date().toISOString(),
  };

  try {
    const current = JSON.parse(window.localStorage.getItem(analyticsStorageKey) || "[]");
    window.localStorage.setItem(analyticsStorageKey, JSON.stringify([event, ...current].slice(0, 250)));
    window.dispatchEvent(new window.CustomEvent(productAnalyticsEvent, { detail: event }));
    window.dataLayer?.push?.({ event: name, ...metadata });
  } catch {
    // Analytics must never interrupt the user's work.
  }
}

export function trackProductMilestone(name, metadata = {}) {
  const entityId = metadata.jobId || metadata.resumeId || metadata.userId || "account";
  const milestoneKey = `occuboard:milestone:${name}:${entityId}`;
  try {
    if (window.localStorage.getItem(milestoneKey) === "true") return;
    window.localStorage.setItem(milestoneKey, "true");
  } catch {
    // Continue with best-effort analytics when storage is unavailable.
  }
  trackProductEvent(name, metadata);
}
