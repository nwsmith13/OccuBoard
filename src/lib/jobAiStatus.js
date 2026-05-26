export function getJobAiStatus(jobId, jobScores, resumeVersions, messages) {
  return {
    analyzed: jobScores.some((score) => score.job_id === jobId),
    resumeDrafted: resumeVersions.some((version) => version.job_id === jobId),
    messageDrafted: messages.some((message) => message.job_id === jobId && isRecruiterMessage(message)),
  };
}

export function getLatestForJob(items, jobId) {
  return items
    .filter((item) => item.job_id === jobId)
    .sort((a, b) => new Date(b.created_at || b.updated_at) - new Date(a.created_at || a.updated_at))[0];
}

export function isRecruiterMessage(message = {}) {
  const type = normalizeMessageType(message.type);
  return type === "Recruiter Message" || type === "Outreach Message";
}

export function normalizeMessageType(type) {
  return type === "LinkedIn intro" ? "Recruiter Message" : type || "Recruiter Message";
}
