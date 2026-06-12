import posthog from "posthog-js";

const analyticsStorageKey = "occuboard:product-events";
export const productAnalyticsEvent = "occuboard:product-event";
const onboardingMilestones = ["resume_added", "job_added", "fit_analysis_completed", "resume_generated"];

export function trackEvent(name, properties = {}) {
  if (!name) return;
  const metadata = normalizeProperties(properties);
  const event = {
    name,
    metadata,
    occurredAt: new Date().toISOString(),
  };

  try {
    const current = JSON.parse(window.localStorage.getItem(analyticsStorageKey) || "[]");
    window.localStorage.setItem(analyticsStorageKey, JSON.stringify([event, ...current].slice(0, 250)));
    window.dispatchEvent(new window.CustomEvent(productAnalyticsEvent, { detail: event }));
  } catch {
    // Local analytics history is optional.
  }
  try {
    window.dataLayer?.push?.({ event: name, ...metadata });
  } catch {
    // Third-party analytics must never interrupt the user's work.
  }
  try {
    if (typeof posthog?.capture === "function") posthog.capture(name, metadata);
  } catch {
    // PostHog may be unavailable in local development or blocked by the browser.
  }
}

export const trackProductEvent = trackEvent;

export function trackProductMilestone(name, metadata = {}) {
  const properties = normalizeProperties(metadata);
  const userId = properties.user_id || "anonymous";
  const entityId = properties.job_id || properties.resume_id || properties.upload_id || "account";
  const milestoneKey = getMilestoneKey(name, userId, entityId);
  try {
    if (window.localStorage.getItem(milestoneKey) === "true") return;
    window.localStorage.setItem(milestoneKey, "true");
  } catch {
    // Continue with best-effort analytics when storage is unavailable.
  }
  trackEvent(name, properties);
  maybeTrackOnboardingCompleted(userId);
}

function maybeTrackOnboardingCompleted(userId) {
  if (!userId || userId === "anonymous") return;
  try {
    const completed = onboardingMilestones.every((name) => hasUserMilestone(name, userId));
    if (!completed) return;
    const key = getMilestoneKey("onboarding_completed", userId, "account");
    if (window.localStorage.getItem(key) === "true") return;
    window.localStorage.setItem(key, "true");
    trackEvent("onboarding_completed", { user_id: userId });
  } catch {
    // Completion analytics are best effort only.
  }
}

function hasUserMilestone(name, userId) {
  const prefix = `occuboard:milestone:${name}:${userId}:`;
  return Object.keys(window.localStorage).some((key) => key.startsWith(prefix) && window.localStorage.getItem(key) === "true");
}

function getMilestoneKey(name, userId, entityId) {
  return `occuboard:milestone:${name}:${userId}:${entityId}`;
}

function normalizeProperties(properties = {}) {
  const normalized = { ...properties };
  const aliases = {
    jobId: "job_id",
    resumeId: "resume_id",
    uploadId: "upload_id",
    userId: "user_id",
    fitScore: "fit_score",
    fitLabel: "fit_label",
    tailoringIntensity: "tailoring_intensity",
    previousStage: "previous_stage",
    newStage: "new_stage",
  };
  Object.entries(aliases).forEach(([legacy, standard]) => {
    if (normalized[standard] == null && normalized[legacy] != null) normalized[standard] = normalized[legacy];
    delete normalized[legacy];
  });
  return normalized;
}
