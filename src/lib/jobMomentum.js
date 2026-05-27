import { getFollowUpStatus, normalizeStage } from "./followUp.js";
import { isCoverLetter, isRecruiterMessage } from "./jobAiStatus.js";

export function getJobMomentumScore(job = {}, context = {}) {
  const score = Number(context.score?.score ?? context.score ?? 0);
  const stage = normalizeStage(job.status);
  const followUpStatus = getFollowUpStatus(job);
  const recentActivityDate = getLatestActivityDate(job, context.activityHistory);
  const recencyScore = getRecencyScore(recentActivityDate);
  const messages = context.messages ?? [];
  const hasRecruiterMessage = messages.some((message) => message.job_id === job.id && isRecruiterMessage(message));
  const hasCoverLetter = messages.some((message) => message.job_id === job.id && isCoverLetter(message));
  const hasResume = Boolean(context.resumeVersions?.some((version) => version.job_id === job.id) || context.hasResume);
  const hasInterviewPrep = Boolean(context.interviewPrep?.some((prep) => prep.job_id === job.id) || context.hasInterviewPrep);

  let total = 0;
  total += Math.min(40, score * 0.4);
  total += recencyScore;
  if (stage === "Interview") total += 22;
  if (stage === "Applied") total += 12;
  if (hasResume) total += 8;
  if (hasRecruiterMessage) total += 6;
  if (hasCoverLetter) total += 3;
  if (hasInterviewPrep) total += 8;
  if (job.interview_date) total += isInterviewWithinHours(job, 48) ? 18 : 8;
  if (followUpStatus === "due") total += 18;
  if (followUpStatus === "overdue") total += 24;
  if (stage === "Closed") total -= 35;

  return Math.max(0, Math.round(total));
}

export function getLatestActivityDate(job = {}, activityHistory = []) {
  const dates = [
    job.updated_at,
    job.created_at,
    job.date_saved,
    ...activityHistory.filter((event) => event.job_id === job.id).map((event) => event.created_at),
  ]
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b - a);
  return dates[0] || null;
}

export function daysSince(value) {
  if (!value) return Infinity;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return Infinity;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

export function isInterviewWithinHours(job = {}, hours = 48) {
  const date = job.interview_date || job.interviewDate;
  if (!date) return false;
  const time = job.interview_time || job.interviewTime || "09:00";
  const [hour = "09", minute = "00"] = String(time).split(":");
  const interviewAt = new Date(`${date}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`);
  if (Number.isNaN(interviewAt.getTime())) return false;
  const diffHours = (interviewAt.getTime() - Date.now()) / 3600000;
  return diffHours >= 0 && diffHours <= hours;
}

function getRecencyScore(date) {
  const days = daysSince(date);
  if (days <= 1) return 18;
  if (days <= 3) return 14;
  if (days <= 7) return 9;
  if (days <= 14) return 4;
  return 0;
}
