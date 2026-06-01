export function getJobAiStatus(jobId, jobScores, resumeVersions, messages, job = {}) {
  const coverLetterDrafted = messages.some((message) => message.job_id === jobId && isCoverLetter(message));
  const coverLetterSkipped = isCoverLetterSkipped(job);
  return {
    analyzed: jobScores.some((score) => score.job_id === jobId && hasValidAnalysis(score)),
    resumeDrafted: resumeVersions.some((version) => version.job_id === jobId),
    messageDrafted: messages.some((message) => message.job_id === jobId && isRecruiterMessage(message)),
    coverLetterDrafted,
    coverLetterSkipped,
    coverLetterResolved: coverLetterDrafted || coverLetterSkipped,
  };
}

function hasValidAnalysis(score) {
  if (!score) return false;
  const value = Number(score.score ?? score);
  if (Number.isFinite(value) && value > 0) return true;
  return Boolean(
    score.summary ||
    score.recommendation ||
    score.strengths?.length ||
    score.gaps?.length ||
    score.keywords?.length
  );
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

export function isCoverLetter(message = {}) {
  return normalizeMessageType(message.type) === "Cover Letter";
}

export function getCoverLetterStatus(job = {}) {
  return String(job.cover_letter_status || job.coverLetterStatus || "").toLowerCase();
}

export function isCoverLetterSkipped(job = {}) {
  return getCoverLetterStatus(job) === "skipped";
}

export function normalizeMessageType(type) {
  return type === "LinkedIn intro" ? "Recruiter Message" : type || "Recruiter Message";
}
