import { create } from "zustand";
import {
  createJob,
  deleteJob,
  fetchWorkspace,
  saveJobScore,
  saveMessage,
  saveProfile,
  saveResumeVersion,
  saveResumeUpload,
  updateJob,
  updateResumeVersion,
} from "../lib/workspaceApi.js";

export const useWorkspaceStore = create((set, get) => ({
  profile: null,
  jobs: [],
  activityLogs: [],
  resumeVersions: [],
  resumeUploads: [],
  jobScores: [],
  messages: [],
  loading: false,
  error: "",
  loadedFor: null,
  loadWorkspace: async (user) => {
    const userKey = user?.id ?? "local-demo-user";
    if (get().loading || get().loadedFor === userKey) return;
    set({ loading: true, error: "" });
    try {
      const data = await fetchWorkspace(user);
      set({ ...data, loading: false, loadedFor: userKey });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },
  saveProfile: async (user, profile) => {
    const saved = await saveProfile(user, profile);
    const data = await fetchWorkspace(user);
    set({ ...data, profile: saved });
  },
  createJob: async (user, job) => {
    const saved = await createJob(user, job);
    const data = await fetchWorkspace(user);
    set(data);
    return saved;
  },
  updateJob: async (user, id, patch) => {
    const saved = await updateJob(user, id, patch);
    const data = await fetchWorkspace(user);
    set({ ...data, jobs: data.jobs.map((job) => (job.id === id ? saved : job)) });
    return saved;
  },
  deleteJob: async (user, id) => {
    await deleteJob(user, id);
    const data = await fetchWorkspace(user);
    set(data);
  },
  saveJobScore: async (user, job, score) => {
    await saveJobScore(user, job, score);
    const data = await fetchWorkspace(user);
    set(data);
  },
  saveResumeVersion: async (user, job, draft, metadata) => {
    const saved = await saveResumeVersion(user, job, draft, metadata);
    const data = await fetchWorkspace(user);
    set(data);
    return saved;
  },
  updateResumeVersion: async (user, id, patch) => {
    await updateResumeVersion(user, id, patch);
    const data = await fetchWorkspace(user);
    set(data);
  },
  saveMessage: async (user, job, message) => {
    await saveMessage(user, job, message);
    const data = await fetchWorkspace(user);
    set(data);
  },
  saveResumeUpload: async (user, file, extractedText) => {
    const saved = await saveResumeUpload(user, file, extractedText);
    const data = await fetchWorkspace(user);
    set(data);
    return saved;
  },
}));
