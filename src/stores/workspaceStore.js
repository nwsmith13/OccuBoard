import { create } from "zustand";
import {
  createJob,
  deleteJob,
  fetchWorkspace,
  saveJobScore,
  saveMessage,
  saveJobContact,
  saveInterviewPrep,
  saveProfile,
  saveResumeVersion,
  saveResumeUpload,
  logJobActivity,
  deleteJobContact,
  markJobContacted,
  updateJob,
  updateMessage,
  updateResumeVersion,
} from "../lib/workspaceApi.js";
import { createDefaultBillingState, fetchBillingState, incrementUsage, setUsageValue } from "../lib/billing.js";
import { hasValidInterviewPrep } from "../lib/interviewPrep.js";
import { trackEvent, trackProductMilestone } from "../lib/productAnalytics.js";

const localAiUsageCountedKey = "occuboard.aiUsageCountedJobs";
let workspaceLoadSequence = 0;

function isBillingDebugEnabled() {
  try {
    return Boolean(import.meta.env.DEV && window.localStorage.getItem("occuboard:debugBilling") === "true");
  } catch {
    return false;
  }
}

function logBillingDebug(message, payload) {
  if (!isBillingDebugEnabled()) return;
  globalThis.console.info(`[OccuBoard billing] ${message}`, payload);
}

function warnBillingDebug(message, payload) {
  if (!isBillingDebugEnabled()) return;
  globalThis.console.warn(`[OccuBoard billing] ${message}`, payload);
}

function normalizeAnalyticsStage(status = "") {
  const value = String(status || "").trim();
  const lower = value.toLowerCase();
  if (lower === "applied") return "Applied";
  if (lower === "saved" || lower === "draft" || lower === "tailoring") return "Saved";
  if (lower === "recruiter screen" || lower === "recruiter contacted") return "Recruiter Contacted";
  if (lower === "phone screen") return "Phone Screen";
  if (lower === "interview" || lower === "interviewing") return "Interview";
  if (lower === "final interview" || lower === "final round") return "Final Interview";
  if (lower === "offer") return "Offer";
  if (lower === "rejected") return "Rejected";
  if (lower === "closed") return "Closed";
  return value || "unknown";
}

function createEmptyWorkspaceState(user) {
  return {
    profile: null,
    jobs: [],
    activityLogs: [],
    jobActivityLogs: [],
    jobContacts: [],
    interviewPrep: [],
    resumeVersions: [],
    resumeUploads: [],
    jobScores: [],
    messages: [],
    billing: createDefaultBillingState(user),
  };
}

export const useWorkspaceStore = create((set, get) => ({
  ...createEmptyWorkspaceState(null),
  loading: false,
  loadingFor: null,
  error: "",
  loadedFor: null,
  loadWorkspace: async (user) => {
    const userKey = user?.id ?? "local-demo-user";
    if (get().loadedFor === userKey && !get().loading) return;
    if (get().loading && get().loadingFor === userKey) return;
    const requestId = ++workspaceLoadSequence;
    set({
      ...createEmptyWorkspaceState(user),
      loading: true,
      loadingFor: userKey,
      error: "",
      loadedFor: null,
    });
    try {
      const data = await fetchWorkspace(user);
      const billing = await reconcileAiApplicationUsage(user, data, await fetchBillingState(user));
      if (requestId !== workspaceLoadSequence) return;
      set({ ...data, billing, loading: false, loadingFor: null, loadedFor: userKey });
    } catch (error) {
      if (requestId !== workspaceLoadSequence) return;
      set({ error: error.message, loading: false, loadingFor: null });
    }
  },
  saveProfile: async (user, profile) => {
    const userKey = user?.id ?? "local-demo-user";
    const saved = await saveProfile(user, profile);
    const data = await fetchWorkspace(user);
    if (!isCurrentWorkspaceUser(get(), userKey)) return saved;
    set((state) => ({ ...data, profile: saved, billing: state.billing }));
    return saved;
  },
  createJob: async (user, job) => {
    const saved = await createJob(user, job);
    trackProductMilestone("job_added", { job_id: saved?.id, user_id: user?.id });
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
    return saved;
  },
  updateJob: async (user, id, patch, options = {}) => {
    const previousJob = get().jobs.find((job) => job.id === id);
    const saved = await updateJob(user, id, patch);
    const previousStage = normalizeAnalyticsStage(previousJob?.status || "unknown");
    const newStage = normalizeAnalyticsStage(saved?.status || patch?.status);
    const source = options.source || "unknown";
    if (patch?.status && newStage !== previousStage) {
      const payload = {
        application_id: id,
        job_id: id,
        user_id: user?.id,
        job_title: saved?.job_title || previousJob?.job_title || "",
        company: saved?.company_name || previousJob?.company_name || "",
        previous_stage: previousStage,
        new_stage: newStage,
        source,
      };
      trackEvent("application_stage_changed", payload);
    }
    if (patch?.status && newStage === "Applied" && previousStage !== "Applied") {
      const payload = {
        application_id: id,
        job_id: id,
        user_id: user?.id,
        job_title: saved?.job_title || previousJob?.job_title || "",
        company: saved?.company_name || previousJob?.company_name || "",
        previous_stage: previousStage,
        new_stage: "Applied",
        source,
      };
      globalThis.console?.log?.("[analytics] application_marked_applied", payload);
      trackEvent("application_marked_applied", payload);
    }
    if (patch?.status === "Applied") trackProductMilestone("application_tracked", { job_id: id, user_id: user?.id, stage: "applied" });
    if (patch?.archived_at && !previousJob?.archived_at) trackProductMilestone("application_archived", { job_id: id, user_id: user?.id });
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, jobs: data.jobs.map((job) => (job.id === id ? saved : job)), billing: state.billing }));
    return saved;
  },
  deleteJob: async (user, id) => {
    await deleteJob(user, id);
    trackProductMilestone("application_deleted", { job_id: id, user_id: user?.id });
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
  },
  saveJobScore: async (user, job, score) => {
    const saved = await saveJobScore(user, job, score);
    const properties = {
      job_id: job?.id,
      user_id: user?.id,
      fit_score: Number(saved?.score ?? score?.score ?? 0),
      fit_label: getAnalyticsFitLabel(saved?.score ?? score?.score),
    };
    trackProductMilestone("fit_analyzed", properties);
    trackProductMilestone("fit_analysis_completed", properties);
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
    await get().markJobAiUsageCounted(user, job);
  },
  saveResumeVersion: async (user, job, draft, metadata) => {
    const saved = await saveResumeVersion(user, job, draft, metadata);
    const latestScore = get().jobScores.find((score) => score.job_id === job?.id);
    trackProductMilestone("resume_generated", {
      job_id: job?.id,
      resume_id: saved?.id,
      user_id: user?.id,
      fit_score: Number(latestScore?.score || 0) || undefined,
      tailoring_intensity: metadata?.tailoringIntensity || saved?.tailoring_intensity || undefined,
    });
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
    await get().markJobAiUsageCounted(user, job);
    return saved;
  },
  updateResumeVersion: async (user, id, patch) => {
    await updateResumeVersion(user, id, patch);
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
  },
  saveMessage: async (user, job, message) => {
    const saved = await saveMessage(user, job, message);
    const messageType = saved?.type || message?.type || "Recruiter Message";
    if (["Recruiter Message", "Outreach Message", "LinkedIn intro"].includes(messageType)) {
      trackEvent("recruiter_message_generated", { job_id: job?.id, user_id: user?.id, message_id: saved?.id });
    }
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
    if (["Recruiter Message", "Outreach Message", "Cover Letter"].includes(saved?.type || message?.type || "Recruiter Message")) {
      await get().markJobAiUsageCounted(user, job);
    }
    return saved;
  },
  updateMessage: async (user, message, patch) => {
    const saved = await updateMessage(user, message, patch);
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
    return saved;
  },
  saveJobContact: async (user, job, contact) => {
    const saved = await saveJobContact(user, job, contact);
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
    return saved;
  },
  deleteJobContact: async (user, contact) => {
    await deleteJobContact(user, contact);
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
  },
  markJobContacted: async (user, contact) => {
    const saved = await markJobContacted(user, contact);
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
    return saved;
  },
  saveInterviewPrep: async (user, job, prep) => {
    const saved = await saveInterviewPrep(user, job, prep);
    if (!prep?.skipActivity) {
      trackEvent("interview_prep_generated", { job_id: job?.id, user_id: user?.id, interview_prep_id: saved?.id });
    }
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
    await get().markJobAiUsageCounted(user, job);
    return saved;
  },
  saveResumeUpload: async (user, file, extractedText) => {
    const saved = await saveResumeUpload(user, file, extractedText);
    trackProductMilestone("resume_uploaded", {
      user_id: user?.id,
      upload_id: saved?.id,
      upload_method: "file",
      file_type: getAnalyticsFileType(file),
    });
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
    return saved;
  },
  refreshBilling: async (user) => {
    const billing = await fetchBillingState(user);
    set({ billing });
    return billing;
  },
  markJobAiUsageCounted: async (user, job) => {
    const currentJob = get().jobs.find((item) => item.id === job?.id) || job;
    const currentUsage = get().billing?.usage;
    logBillingDebug("usage check", {
      jobId: currentJob?.id,
      aiUsageCountedAt: currentJob?.ai_usage_counted_at,
      localCounted: hasLocalAiUsageCounted(currentJob?.id),
      currentUsage,
    });
    if (!currentJob?.id || currentJob.ai_usage_counted_at || hasLocalAiUsageCounted(currentJob.id)) {
      logBillingDebug("usage already counted", { jobId: currentJob?.id, currentUsage });
      return currentJob;
    }
    const countedAt = new Date().toISOString();
    logBillingDebug("consuming AI-powered application", {
      jobId: currentJob.id,
      countedAt,
      currentUsage,
    });
    let saved = { ...currentJob, ai_usage_counted_at: countedAt };
    try {
      saved = await updateJob(user, currentJob.id, { ai_usage_counted_at: countedAt });
    } catch (error) {
      warnBillingDebug("job usage marker write failed; using local marker.", {
        jobId: currentJob.id,
        error,
      });
    }
    const usage = await incrementUsage(user, "application_count");
    rememberLocalAiUsageCounted(currentJob.id, countedAt);
    const data = await fetchWorkspace(user);
    set((state) => ({
      ...data,
      jobs: data.jobs.map((item) => (item.id === currentJob.id ? { ...item, ...saved, ai_usage_counted_at: saved?.ai_usage_counted_at || countedAt } : item)),
      billing: usage ? { ...state.billing, usage } : state.billing,
    }));
    logBillingDebug("usage updated", {
      jobId: currentJob.id,
      previousUsage: currentUsage,
      updatedUsage: usage,
    });
    return saved;
  },
  logJobActivity: async (user, jobId, type, metadata) => {
    const saved = await logJobActivity(user, jobId, type, metadata);
    if (!saved) return null;
    set((state) => ({ jobActivityLogs: [saved, ...state.jobActivityLogs] }));
    return saved;
  },
}));

function getAnalyticsFitLabel(score) {
  const value = Number(score || 0);
  if (value >= 90) return "Strong Match";
  if (value >= 80) return "Competitive Match";
  if (value >= 70) return "Viable Match";
  if (value >= 60) return "Stretch Match";
  return "Low Match";
}

function getAnalyticsFileType(file) {
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase();
  if (["pdf", "docx", "txt"].includes(extension)) return extension;
  if (file?.type === "application/pdf") return "pdf";
  if (file?.type === "text/plain") return "txt";
  if (String(file?.type || "").includes("wordprocessingml")) return "docx";
  return "unknown";
}

function isCurrentWorkspaceUser(state, userKey) {
  return state.loadedFor === userKey || state.loadingFor === userKey;
}

async function reconcileAiApplicationUsage(user, data, billing) {
  const countedJobIds = getAiPoweredJobIds(data);
  if (!countedJobIds.size) return billing;
  countedJobIds.forEach((jobId) => rememberLocalAiUsageCounted(jobId, new Date().toISOString()));
  const currentCount = Number(billing?.usage?.application_count || 0);
  logBillingDebug("reconciliation check", {
    currentUsage: billing?.usage,
    derivedAiPoweredApplications: countedJobIds.size,
    jobIds: [...countedJobIds],
  });
  if (currentCount >= countedJobIds.size) return billing;
  const usage = await setUsageValue(user, "application_count", countedJobIds.size);
  logBillingDebug("reconciliation updated usage", {
    previousUsage: billing?.usage,
    updatedUsage: usage,
  });
  return usage ? { ...billing, usage } : billing;
}

function getAiPoweredJobIds(data = {}) {
  const ids = new Set();
  data.jobScores?.forEach((item) => item.job_id && ids.add(item.job_id));
  data.resumeVersions?.forEach((item) => item.job_id && ids.add(item.job_id));
  data.interviewPrep?.filter(hasValidInterviewPrep).forEach((item) => item.job_id && ids.add(item.job_id));
  data.messages
    ?.filter((item) => ["Recruiter Message", "Outreach Message", "Cover Letter"].includes(item.type || "Recruiter Message"))
    .forEach((item) => item.job_id && ids.add(item.job_id));
  data.jobs?.filter((job) => job.ai_usage_counted_at).forEach((job) => ids.add(job.id));
  return ids;
}

function readLocalAiUsageCounted() {
  try {
    return JSON.parse(window.localStorage.getItem(localAiUsageCountedKey) || "{}");
  } catch {
    return {};
  }
}

function hasLocalAiUsageCounted(jobId) {
  if (!jobId) return false;
  return Boolean(readLocalAiUsageCounted()[jobId]);
}

function rememberLocalAiUsageCounted(jobId, countedAt) {
  if (!jobId) return;
  try {
    window.localStorage.setItem(localAiUsageCountedKey, JSON.stringify({ ...readLocalAiUsageCounted(), [jobId]: countedAt }));
  } catch {
    // Local marker is a fallback only; Supabase remains the source of truth when available.
  }
}
