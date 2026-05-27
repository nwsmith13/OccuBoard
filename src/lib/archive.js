export function isArchivedJob(job = {}) {
  return Boolean(job.archived_at || job.archivedAt || job.archived_by_user || job.archivedByUser);
}

export function getActiveJobs(jobs = []) {
  return jobs.filter((job) => !isArchivedJob(job));
}

export function getArchivedJobs(jobs = []) {
  return jobs.filter(isArchivedJob);
}
