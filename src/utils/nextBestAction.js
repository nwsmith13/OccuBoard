import { formatDate } from "../lib/date.js";
import { getFollowUpDate, getFollowUpStatus, normalizeStage } from "../lib/followUp.js";
import { isCoverLetter, isCoverLetterSkipped } from "../lib/jobAiStatus.js";

const actionDefaults = {
  analyze_fit: {
    label: "Analyze this role",
    description: "Identify fit, risks, keywords, and the strongest resume angles before tailoring materials.",
    tone: "info",
    priority: 1,
    icon: "search",
  },
  follow_up_overdue: {
    label: "Follow up overdue",
    description: "This reminder is past due. A short, calm follow-up should be the next move.",
    tone: "danger",
    priority: 1,
    icon: "bell",
  },
  follow_up_today: {
    label: "Follow up today",
    description: "This opportunity is due for a touchpoint today.",
    tone: "warning",
    priority: 1,
    icon: "bell",
  },
  apply_now: {
    label: "Ready to apply",
    description: "This role looks strong and your application assets are ready.",
    tone: "success",
    priority: 2,
    icon: "arrow-right-circle",
  },
  generate_resume: {
    label: "Generate tailored resume",
    description: "Create a focused resume version using the analysis and role requirements.",
    tone: "info",
    priority: 2,
    icon: "document",
  },
  generate_message: {
    label: "Draft recruiter message",
    description: "Draft a short outreach note after your application materials are ready.",
    tone: "info",
    priority: 3,
    icon: "message-circle",
  },
  generate_cover_letter: {
    label: "Generate cover letter",
    description: "This role may benefit from a short tailored cover letter.",
    tone: "info",
    priority: 3,
    icon: "document",
  },
  prepare_interview: {
    label: "Prepare for interview",
    description: "Review fit, talking points, and follow-up notes before the conversation.",
    tone: "success",
    priority: 2,
    icon: "sparkles",
  },
  export_package: {
    label: "Ready to apply",
    description: "Everything needed for submission is complete. Export your package or mark this role as applied after submission.",
    tone: "success",
    priority: 2,
    icon: "download",
  },
  review_high_fit: {
    label: "Review strong match",
    description: "This strong match has been quiet for a few days. Revisit the next step.",
    tone: "info",
    priority: 4,
    icon: "search",
  },
  move_to_interview: {
    label: "Move to interview",
    description: "If the conversation has progressed, update the stage so guidance stays current.",
    tone: "success",
    priority: 4,
    icon: "arrow-right-circle",
  },
  no_action: {
    label: "No action needed",
    description: "Nothing urgent right now. This opportunity is up to date.",
    tone: "neutral",
    priority: 5,
    icon: "check-circle",
  },
};

export function getNextBestAction(job = {}, options = {}) {
  const stage = normalizeStage(job.status);
  const followUpStatus = getFollowUpStatus(job);
  const scoreValue = getScoreValue(options.score ?? options.latestScore);
  const aiStatus = options.aiStatus ?? {};
  const hasAnalysis = Boolean(
    options.hasAnalysis ||
    aiStatus.analyzed ||
    hasValidAnalysis(options.score ?? options.latestScore) ||
    job.analysis ||
    job.fitAnalysis
  );
  const hasResume = Boolean(options.hasResume ?? aiStatus.resumeDrafted);
  const hasMessage = Boolean(options.hasMessage ?? aiStatus.messageDrafted);
  const coverLetterSkipped = Boolean(options.coverLetterSkipped ?? aiStatus.coverLetterSkipped ?? isCoverLetterSkipped(job));
  const hasCoverLetter = Boolean(
    options.hasCoverLetter ??
    aiStatus.coverLetterResolved ??
    aiStatus.coverLetterDrafted ??
    coverLetterSkipped ??
    options.messages?.some((message) => message.job_id === job.id && isCoverLetter(message))
  );
  const hasInterviewPrep = Boolean(options.hasInterviewPrep);
  const hasFollowUpMessage = Boolean(options.hasFollowUpMessage ?? options.messages?.some((message) => message.job_id === job.id && message.type === "Follow-up Message"));
  const shouldSuggestCoverLetter = shouldRecommendCoverLetter(job, scoreValue);

  if (stage === "Closed") {
    return buildAction("no_action", { description: "Outcome recorded. No next step is needed." });
  }

  if (shouldPrioritizeFollowUp(job, stage, followUpStatus, options)) {
    if (followUpStatus === "overdue") return buildAction("follow_up_overdue");
    if (followUpStatus === "due") return buildAction("follow_up_today");
  }

  if (!hasAnalysis && !(isInterviewSoon(job, 48) && (stage === "Interview" || job.interview_date))) return buildAction("analyze_fit");

  if (stage === "Interview" || job.interview_date) {
    if (isInterviewSoon(job, 48)) {
      return buildAction("prepare_interview", {
        label: "Interview coming up",
        description: "Interview coming up soon. Review your focus areas, talking points, and thank-you note.",
        priority: 1.5,
      });
    }
    return buildAction("prepare_interview");
  }

  if (stage === "Applied" && !hasResume) return buildAction("generate_resume");

  if (stage === "Saved") {
    if (!hasResume) return buildAction("generate_resume");
    if (!hasCoverLetter) {
      return buildAction("generate_cover_letter", {
        description: asksForCoverLetter(job.job_description)
          ? "The job description asks for a cover letter. Draft a concise version before outreach."
          : shouldSuggestCoverLetter
            ? "This strong, client-facing role may benefit from a short tailored cover letter."
            : "Generate a concise cover letter now, or use this step to confirm one is not needed.",
        priority: 3,
      });
    }
    if (!hasMessage) return buildAction("generate_message", { label: "Draft recruiter message", description: "Create a short outreach note to pair with your tailored resume." });
    if (!hasInterviewPrep) return buildAction("prepare_interview", { label: "Continue Interview Prep", description: "Prepare likely questions, stories, and talking points before exporting your package.", priority: 3 });
    return buildAction("export_package");
  }

  if (stage === "Applied") {
    if (!hasFollowUpMessage) return buildAction("generate_message");
    if (scoreValue >= 85) return buildAction("move_to_interview");
    return buildAction("no_action", { label: "Waiting for response", description: getFollowUpDate(job) ? `Next follow-up is ${formatDate(getFollowUpDate(job))}.` : "No follow-up is due right now." });
  }

  if (scoreValue >= 75 && isStaleHighFit(job, options)) return buildAction("review_high_fit");

  return buildAction("no_action");
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

function shouldPrioritizeFollowUp(job, stage, followUpStatus, options = {}) {
  if (!["due", "overdue"].includes(followUpStatus)) return false;
  if (stage === "Applied" || stage === "Interview") return true;
  if (options.hasFollowUpMessage || options.hasMessage) return true;
  if (options.messages?.some((message) => message.job_id === job.id && (message.type === "Follow-up Message" || message.type === "Recruiter Message" || message.type === "Outreach Message"))) return true;
  if (options.activityEvents?.some((event) => ["message_generated", "followup_message_generated", "contact_contacted"].includes(event.type))) return true;
  return false;
}

function asksForCoverLetter(description = "") {
  return /\bcover\s+letter\b|\bletter\s+of\s+interest\b|\bstatement\s+of\s+interest\b/i.test(description);
}

function shouldRecommendCoverLetter(job = {}, scoreValue = 0) {
  if (asksForCoverLetter(job.job_description)) return true;
  if (scoreValue < 85) return false;
  return isProfessionalOrClientFacingRole(job);
}

function isProfessionalOrClientFacingRole(job = {}) {
  const text = `${job.job_title || ""} ${job.job_description || ""}`.toLowerCase();
  return /\b(manager|management|director|lead|consultant|solutions?|client|customer|success|account|implementation|onboarding|stakeholder|enterprise|professional services|project owner|program)\b/i.test(text);
}

export function getNextBestActionTone(tone) {
  return {
    danger: "bg-rose-50 text-rose-700 ring-rose-100",
    warning: "bg-amber-50 text-amber-800 ring-amber-100",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    info: "bg-brand-50 text-brand-800 ring-brand-100",
    neutral: "bg-slate-50 text-slate-600 ring-slate-100",
  }[tone] ?? "bg-slate-50 text-slate-600 ring-slate-100";
}

function buildAction(actionType, overrides = {}) {
  return {
    ...actionDefaults[actionType],
    ...overrides,
    actionType,
  };
}

function getScoreValue(score) {
  const value = Number(score?.score ?? score);
  return Number.isFinite(value) ? value : 0;
}

function isStaleHighFit(job, options) {
  const dates = [
    job.updated_at,
    job.created_at,
    options.latestScore?.created_at,
    options.score?.created_at,
    options.activityEvents?.[0]?.created_at,
  ].filter(Boolean);
  const latestDate = dates.map((date) => new Date(date)).filter((date) => !Number.isNaN(date.getTime())).sort((a, b) => b - a)[0];
  if (!latestDate) return false;
  const daysSince = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= 3;
}

function isInterviewSoon(job = {}, hours = 48) {
  const date = job.interview_date || job.interviewDate;
  if (!date) return false;
  const time = job.interview_time || job.interviewTime || "09:00";
  const [hour = "09", minute = "00"] = String(time).split(":");
  const interviewAt = new Date(`${date}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`);
  if (Number.isNaN(interviewAt.getTime())) return false;
  const diffHours = (interviewAt.getTime() - Date.now()) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours <= hours;
}
