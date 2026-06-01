import { getFollowUpStatus, normalizeStage } from "./followUp.js";
import { isCoverLetter, isCoverLetterSkipped, isRecruiterMessage } from "./jobAiStatus.js";

export function getJobMomentumScore(job = {}, context = {}) {
  const score = Number(context.score?.score ?? context.score ?? 0);
  const stage = normalizeStage(job.status);
  const followUpStatus = getFollowUpStatus(job);
  const recentActivityDate = getLatestActivityDate(job, context.activityHistory);
  const recruiterActivityDate = getLatestRecruiterActivityDate(job, context.messages);
  const recencyScore = getRecencyScore(recentActivityDate);
  const staleDays = daysSince(recentActivityDate);
  const messages = context.messages ?? [];
  const hasRecruiterMessage = messages.some((message) => message.job_id === job.id && isRecruiterMessage(message));
  const hasCoverLetter = messages.some((message) => message.job_id === job.id && isCoverLetter(message)) || isCoverLetterSkipped(job);
  const hasResume = Boolean(context.resumeVersions?.some((version) => version.job_id === job.id) || context.hasResume);
  const hasInterviewPrep = Boolean(context.interviewPrep?.some((prep) => prep.job_id === job.id) || context.hasInterviewPrep);
  const factors = [];

  let total = 0;
  const fitContribution = Math.min(42, score * 0.42);
  total += fitContribution;
  if (score >= 85) factors.push("high_fit");
  if (score >= 70 && score < 85) factors.push("positive_fit");
  total += recencyScore;
  if (recencyScore >= 14) factors.push("recent_activity");
  if (stage === "Interview") {
    total += 24;
    factors.push("interview_stage");
  }
  if (stage === "Applied") {
    total += 10;
    factors.push("applied_stage");
  }
  if (hasResume) {
    total += 8;
    factors.push("resume_ready");
  }
  if (hasRecruiterMessage) {
    total += 7;
    factors.push("recruiter_message_ready");
  }
  if (hasCoverLetter) {
    total += 3;
    factors.push(isCoverLetterSkipped(job) ? "cover_letter_skipped" : "cover_letter_ready");
  }
  if (hasInterviewPrep) {
    total += 8;
    factors.push("interview_prep_ready");
  }
  if (recruiterActivityDate && daysSince(recruiterActivityDate) <= 7) {
    total += 9;
    factors.push("recent_recruiter_activity");
  }
  if (job.interview_date) {
    total += isInterviewWithinHours(job, 48) ? 20 : 9;
    factors.push(isInterviewWithinHours(job, 48) ? "interview_soon" : "interview_scheduled");
  }
  if (followUpStatus === "due") {
    total += 10;
    factors.push("followup_due");
  }
  if (followUpStatus === "overdue") {
    total -= 6;
    factors.push("followup_overdue");
  }
  if (staleDays >= 10) {
    total -= Math.min(18, Math.floor((staleDays - 7) / 3) * 3);
    factors.push("stale_decay");
  }
  if (stage === "Closed") {
    total -= 35;
    factors.push("closed_stage");
  }

  return {
    score: Math.max(0, Math.round(total)),
    factors,
    lastUpdated: recentActivityDate?.toISOString?.() || "",
  };
}

export function getJobMomentumValue(job = {}, context = {}) {
  return getJobMomentumScore(job, context).score;
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

function getLatestRecruiterActivityDate(job = {}, messages = []) {
  const dates = messages
    .filter((message) => message.job_id === job.id && isRecruiterMessage(message))
    .map((message) => message.updated_at || message.created_at)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b - a);
  return dates[0] || null;
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
