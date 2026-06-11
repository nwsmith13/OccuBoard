import { normalizeStage } from "./followUp.js";

export function isArchivedJob(job = {}) {
  return Boolean(job.archived_at || job.archivedAt || job.archived_by_user || job.archivedByUser);
}

export function isInactiveJob(job = {}) {
  return ["Rejected", "Closed"].includes(normalizeStage(job.status));
}

export function isActiveJob(job = {}) {
  return !isArchivedJob(job) && !isInactiveJob(job);
}

export function getActiveJobs(jobs = []) {
  return jobs.filter(isActiveJob);
}

export function getArchivedJobs(jobs = []) {
  return jobs.filter(isArchivedJob);
}
