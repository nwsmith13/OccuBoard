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
import { createDefaultBillingState, fetchBillingState, incrementUsage } from "../lib/billing.js";

export const useWorkspaceStore = create((set, get) => ({
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
  billing: createDefaultBillingState(null),
  loading: false,
  error: "",
  loadedFor: null,
  loadWorkspace: async (user) => {
    const userKey = user?.id ?? "local-demo-user";
    if (get().loading || get().loadedFor === userKey) return;
    set({ loading: true, error: "" });
    try {
      const data = await fetchWorkspace(user);
      const billing = await fetchBillingState(user);
      set({ ...data, billing, loading: false, loadedFor: userKey });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },
  saveProfile: async (user, profile) => {
    const saved = await saveProfile(user, profile);
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, profile: saved, billing: state.billing }));
  },
  createJob: async (user, job) => {
    const saved = await createJob(user, job);
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
    return saved;
  },
  updateJob: async (user, id, patch) => {
    const saved = await updateJob(user, id, patch);
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, jobs: data.jobs.map((job) => (job.id === id ? saved : job)), billing: state.billing }));
    return saved;
  },
  deleteJob: async (user, id) => {
    await deleteJob(user, id);
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
  },
  saveJobScore: async (user, job, score) => {
    await saveJobScore(user, job, score);
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
    await get().markJobAiUsageCounted(user, job);
  },
  saveResumeVersion: async (user, job, draft, metadata) => {
    const saved = await saveResumeVersion(user, job, draft, metadata);
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
    const data = await fetchWorkspace(user);
    set((state) => ({ ...data, billing: state.billing }));
    await get().markJobAiUsageCounted(user, job);
    return saved;
  },
  saveResumeUpload: async (user, file, extractedText) => {
    const saved = await saveResumeUpload(user, file, extractedText);
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
    if (!currentJob?.id || currentJob.ai_usage_counted_at) return currentJob;
    const countedAt = new Date().toISOString();
    const saved = await updateJob(user, currentJob.id, { ai_usage_counted_at: countedAt });
    const usage = await incrementUsage(user, "application_count");
    const data = await fetchWorkspace(user);
    set((state) => ({
      ...data,
      jobs: data.jobs.map((item) => (item.id === currentJob.id ? { ...item, ...saved, ai_usage_counted_at: saved?.ai_usage_counted_at || countedAt } : item)),
      billing: usage ? { ...state.billing, usage } : state.billing,
    }));
    return saved;
  },
  logJobActivity: async (user, jobId, type, metadata) => {
    const saved = await logJobActivity(user, jobId, type, metadata);
    if (!saved) return null;
    set((state) => ({ jobActivityLogs: [saved, ...state.jobActivityLogs] }));
    return saved;
  },
}));
