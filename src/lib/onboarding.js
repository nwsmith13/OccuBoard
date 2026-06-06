import { getResumeExportHistory } from "./resumeExport.js";

export const onboardingStorageKey = "occuboard-onboarding-dismissed";
export const onboardingTrackerDismissedKey = "occuboard-onboarding-tracker-dismissed";
export const onboardingPackageExportsKey = "occuboard-onboarding-package-exports";
export const onboardingRecruiterViewKey = "occuboard-onboarding-recruiter-view-reviewed";
export const emailConfirmationStorageKey = "occuboard-email-confirmed";
export const onboardingUpdatedEvent = "occuboard:onboarding-updated";

export function buildOnboardingState({ profile, resumeUploads = [], jobs = [], jobScores = [], resumeVersions = [], interviewPrep = [] } = {}) {
  const hasResume = Boolean(profile?.base_resume_text?.trim() || resumeUploads.length);
  const hasJob = jobs.length > 0;
  const hasAnalysis = jobScores.some(hasValidAnalysis);
  const latestScore = [...jobScores].filter(hasValidAnalysis).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] ?? null;
  const hasTailoredResume = resumeVersions.length > 0;
  const hasExport = getResumeExportHistory().length > 0 || getOnboardingPackageExports().length > 0;
  const hasRecruiterView = hasExport || getOnboardingRecruiterViewReviews().length > 0;
  const hasInterviewPrep = hasExport || interviewPrep.some(hasValidInterviewPrep);
  const trackedApplication = jobs.some((job) => ["Applied", "Recruiter Screen", "Interview", "Final Interview", "Offer", "Closed"].includes(job.status));
  const rawSteps = [
    { id: "resume", label: "Upload Resume", done: hasResume },
    { id: "job", label: "Add Job", done: hasJob },
    { id: "fit", label: "Analyze Fit", done: hasAnalysis },
    { id: "resumeGenerated", label: "Generate Resume", done: hasTailoredResume },
    { id: "recruiterView", label: "Recruiter View", done: hasRecruiterView },
    { id: "interviewPrep", label: "Interview Prep", done: hasInterviewPrep },
    { id: "export", label: "Export Package", done: hasExport },
    { id: "track", label: "Track Application", done: hasExport && trackedApplication },
  ];
  let previousComplete = true;
  const steps = rawSteps.map((step) => {
    const done = previousComplete && step.done;
    previousComplete = done;
    return { ...step, done };
  });
  const complete = steps.filter((step) => step.done).length;
  return {
    hasResume,
    hasJob,
    hasAnalysis,
    latestScore,
    hasTailoredResume,
    hasRecruiterView,
    hasInterviewPrep,
    hasExport,
    trackedApplication,
    steps,
    complete,
    total: steps.length,
    completed: complete === steps.length,
    isNewWorkspace: !hasResume && !hasAnalysis && !hasJob && !hasTailoredResume,
  };
}

export function shouldShowFullOnboarding(state, { pathname = "", dismissed = false } = {}) {
  return Boolean(state?.isNewWorkspace && !dismissed && pathname === "/app/dashboard");
}

export function readBooleanFlag(key) {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function writeBooleanFlag(key, value = true) {
  try {
    window.localStorage.setItem(key, String(Boolean(value)));
    dispatchOnboardingUpdated();
  } catch {
    // Local storage is convenience only.
  }
}

export function rememberEmailConfirmation() {
  try {
    window.sessionStorage.setItem(emailConfirmationStorageKey, "true");
  } catch {
    // Session storage is a presentation hint only.
  }
}

export function readEmailConfirmation() {
  try {
    return window.sessionStorage.getItem(emailConfirmationStorageKey) === "true";
  } catch {
    return false;
  }
}

export function clearEmailConfirmation() {
  try {
    window.sessionStorage.removeItem(emailConfirmationStorageKey);
  } catch {
    // Session storage is a presentation hint only.
  }
}

export function rememberOnboardingPackageExport(jobId = "") {
  try {
    const current = getOnboardingPackageExports();
    const entry = { jobId, exportedAt: new Date().toISOString() };
    window.localStorage.setItem(onboardingPackageExportsKey, JSON.stringify([entry, ...current].slice(0, 20)));
    dispatchOnboardingUpdated();
  } catch {
    // Export tracking is a lightweight onboarding signal only.
  }
}

export function rememberOnboardingRecruiterView(jobId = "") {
  try {
    const current = getOnboardingRecruiterViewReviews();
    if (jobId && current.some((item) => item.jobId === jobId)) return;
    const entry = { jobId, reviewedAt: new Date().toISOString() };
    window.localStorage.setItem(onboardingRecruiterViewKey, JSON.stringify([entry, ...current].slice(0, 20)));
    dispatchOnboardingUpdated();
  } catch {
    // Recruiter View review is a lightweight first-tour signal only.
  }
}

function getOnboardingPackageExports() {
  try {
    return JSON.parse(window.localStorage.getItem(onboardingPackageExportsKey) || "[]");
  } catch {
    return [];
  }
}

function getOnboardingRecruiterViewReviews() {
  try {
    return JSON.parse(window.localStorage.getItem(onboardingRecruiterViewKey) || "[]");
  } catch {
    return [];
  }
}

function dispatchOnboardingUpdated() {
  try {
    window.dispatchEvent(new window.Event(onboardingUpdatedEvent));
  } catch {
    // No-op outside the browser.
  }
}

function hasValidAnalysis(score) {
  if (!score) return false;
  const value = Number(score.score ?? score);
  if (Number.isFinite(value) && value > 0) return true;
  return Boolean(score.summary || score.recommendation || score.strengths?.length || score.gaps?.length || score.keywords?.length);
}

function hasValidInterviewPrep(prep) {
  if (!prep) return false;
  const content = prep.content || {};
  return Boolean(
    (Array.isArray(content.questions) && content.questions.length) ||
    (Array.isArray(content.starStories) && content.starStories.length) ||
    (Array.isArray(content.focusAreas) && content.focusAreas.length) ||
    content.thankYouMessage,
  );
}
