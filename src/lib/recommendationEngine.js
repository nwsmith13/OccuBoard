import { formatDate, todayIso } from "./date.js";
import { isArchivedJob } from "./archive.js";
import { getFollowUpDate, getFollowUpStatus, normalizeStage } from "./followUp.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "./jobDisplay.js";
import { isCoverLetter, isRecruiterMessage } from "./jobAiStatus.js";
import { daysSince, getJobMomentumScore, getLatestActivityDate, isInterviewWithinHours } from "./jobMomentum.js";

const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };
const urgencyRank = { overdue: 0, today: 1, upcoming: 2, suggested: 3 };
const visibleTypeLimits = {
  HIGH_MOMENTUM_ROLE: 1,
  COVER_LETTER_RECOMMENDED: 2,
  READY_TO_APPLY: 1,
};
const urgentBypassTypes = new Set(["FOLLOW_UP_OVERDUE", "FOLLOW_UP_DUE", "INTERVIEW_SOON"]);

export const recommendationTypes = {
  FOLLOW_UP_DUE: "FOLLOW_UP_DUE",
  FOLLOW_UP_OVERDUE: "FOLLOW_UP_OVERDUE",
  INTERVIEW_SOON: "INTERVIEW_SOON",
  STRONG_MATCH_NEEDS_OUTREACH: "STRONG_MATCH_NEEDS_OUTREACH",
  COVER_LETTER_RECOMMENDED: "COVER_LETTER_RECOMMENDED",
  INTERVIEW_PREP_INCOMPLETE: "INTERVIEW_PREP_INCOMPLETE",
  STALE_APPLICATION: "STALE_APPLICATION",
  READY_TO_APPLY: "READY_TO_APPLY",
  HIGH_MOMENTUM_ROLE: "HIGH_MOMENTUM_ROLE",
  ARCHIVE_CANDIDATE: "ARCHIVE_CANDIDATE",
};

export function generateRecommendations({
  jobs = [],
  messages = [],
  interviews = [],
  followups = [],
  generatedAssets = {},
  activityHistory = [],
} = {}) {
  const jobScores = generatedAssets.jobScores ?? generatedAssets.scores ?? [];
  const resumeVersions = generatedAssets.resumeVersions ?? generatedAssets.resumes ?? [];
  const interviewPrep = generatedAssets.interviewPrep ?? interviews ?? [];
  const latestScores = getLatestScores(jobScores);
  const recommendations = [];

  const jobsToEvaluate = (jobs.length ? jobs : followups).filter((job) => !isArchivedJob(job));

  jobsToEvaluate.forEach((job) => {
    const score = latestScores.get(job.id);
    const scoreValue = Number(score?.score ?? 0);
    const stage = normalizeStage(job.status);
    const jobMessages = messages.filter((message) => message.job_id === job.id);
    const hasRecruiterMessage = jobMessages.some(isRecruiterMessage);
    const hasCoverLetter = jobMessages.some(isCoverLetter);
    const hasResume = resumeVersions.some((version) => version.job_id === job.id);
    const hasInterviewPrep = interviewPrep.some((prep) => prep.job_id === job.id);
    const followUpStatus = getFollowUpStatus(job);
    const followUpDate = getFollowUpDate(job);
    const latestActivity = getLatestActivityDate(job, activityHistory);
    const inactiveDays = daysSince(latestActivity);
    const momentum = getJobMomentumScore(job, { score, messages, resumeVersions, interviewPrep, activityHistory });
    const momentumScore = momentum.score;

    if (followUpStatus === "overdue") {
      recommendations.push(buildRecommendation(job, {
        type: recommendationTypes.FOLLOW_UP_OVERDUE,
        priority: "critical",
        urgency: "overdue",
        title: "Follow-up is overdue.",
        description: `${getDisplayCompanyName(job)} has a follow-up past due${followUpDate ? ` since ${formatDate(followUpDate)}` : ""}.`,
        actionLabel: "Open follow-up",
        actionTab: "overview",
        score: momentumScore + 30,
        reasoningText: getFollowUpReasoning(followUpDate, latestActivity),
        reasoningSignals: ["followup_overdue", ...momentum.factors],
        confidence: 0.96,
      }));
    }

    if (followUpStatus === "due") {
      recommendations.push(buildRecommendation(job, {
        type: recommendationTypes.FOLLOW_UP_DUE,
        priority: "high",
        urgency: "today",
        title: "Follow-up is due today.",
        description: `This opportunity is ready for a short touchpoint with ${getDisplayCompanyName(job)}.`,
        actionLabel: "Open follow-up",
        actionTab: "overview",
        score: momentumScore + 24,
        reasoningText: getFollowUpReasoning(followUpDate, latestActivity),
        reasoningSignals: ["followup_due", ...momentum.factors],
        confidence: 0.94,
      }));
    }

    if (stage === "Interview" && isInterviewWithinHours(job, 48) && !hasInterviewPrep) {
      recommendations.push(buildRecommendation(job, {
        type: recommendationTypes.INTERVIEW_SOON,
        priority: "critical",
        urgency: "upcoming",
        title: "Interview prep should be your next focus.",
        description: "Interview coming up soon. Prep has not been started.",
        actionLabel: "Open interview prep",
        actionTab: "interview",
        score: momentumScore + 26,
        reasoningText: getInterviewReasoning(job, hasInterviewPrep),
        reasoningSignals: ["interview_soon", "prep_missing", ...momentum.factors],
        confidence: 0.93,
      }));
    }

    if (job.interview_date && !hasInterviewPrep) {
      recommendations.push(buildRecommendation(job, {
        type: recommendationTypes.INTERVIEW_PREP_INCOMPLETE,
        priority: "high",
        urgency: "upcoming",
        title: "Interview prep has not been started.",
        description: `${getDisplayJobTitle(job)} has an interview date saved, but prep is not generated yet.`,
        actionLabel: "Prepare interview",
        actionTab: "interview",
        score: momentumScore + 18,
        reasoningText: getInterviewReasoning(job, hasInterviewPrep),
        reasoningSignals: ["interview_scheduled", "prep_missing", ...momentum.factors],
        confidence: 0.9,
      }));
    }

    if (scoreValue >= 85 && ["Saved", "Applied"].includes(stage) && !hasRecruiterMessage) {
      recommendations.push(buildRecommendation(job, {
        type: recommendationTypes.STRONG_MATCH_NEEDS_OUTREACH,
        priority: "high",
        urgency: "suggested",
        title: "This strong-fit role still needs outreach.",
        description: `${Math.round(scoreValue)}% fit. A concise recruiter message may help create momentum.`,
        actionLabel: "Draft recruiter message",
        actionTab: "message",
        score: momentumScore + 16,
        reasoningText: `${Math.round(scoreValue)}% fit + ${stage.toLowerCase()} stage + no recruiter message.`,
        reasoningSignals: ["high_fit", "message_missing", stage.toLowerCase(), ...momentum.factors],
        confidence: 0.88,
      }));
    }

    if (scoreValue >= 85 && !hasCoverLetter && shouldRecommendCoverLetter(job)) {
      recommendations.push(buildRecommendation(job, {
        type: recommendationTypes.COVER_LETTER_RECOMMENDED,
        priority: "medium",
        urgency: "suggested",
        title: "Cover letter may strengthen this application.",
        description: asksForCoverLetter(job.job_description) ? "The job description asks for a cover letter." : "This strong, client-facing role may benefit from one concise letter.",
        actionLabel: "Generate cover letter",
        actionTab: "coverLetter",
        score: momentumScore + 8,
        reasoningText: asksForCoverLetter(job.job_description) ? "Employer asks for a cover letter." : "Client-facing implementation role with strong fit.",
        reasoningSignals: ["high_fit", "cover_letter_missing", "client_facing", ...momentum.factors],
        confidence: asksForCoverLetter(job.job_description) ? 0.9 : 0.75,
      }));
    }

    if (stage === "Saved" && hasResume && scoreValue > 0 && !hasRecruiterMessage) {
      recommendations.push(buildRecommendation(job, {
        type: recommendationTypes.READY_TO_APPLY,
        priority: "medium",
        urgency: "suggested",
        title: "Application materials are nearly ready.",
        description: "Fit analysis and tailored resume are complete. Outreach is the next missing piece.",
        actionLabel: "Review materials",
        actionTab: "resume",
        score: momentumScore + 10,
        reasoningText: `Resume ready + ${Math.round(scoreValue)}% fit + outreach missing.`,
        reasoningSignals: ["resume_ready", "message_missing", ...momentum.factors],
        confidence: 0.82,
      }));
    }

    if (scoreValue >= 85 && inactiveDays <= 4 && hasRecruiterMessage) {
      recommendations.push(buildRecommendation(job, {
        type: recommendationTypes.HIGH_MOMENTUM_ROLE,
        priority: "medium",
        urgency: "suggested",
        title: "High-momentum role is active.",
        description: "Recent activity and a strong fit make this worth keeping visible.",
        actionLabel: "Open opportunity",
        actionTab: "overview",
        score: momentumScore + 6,
        reasoningText: `${Math.round(scoreValue)}% fit + recent activity + recruiter message ready.`,
        reasoningSignals: ["high_fit", "recent_activity", "recruiter_message_ready", ...momentum.factors],
        confidence: 0.78,
      }));
    }

    if (["Applied", "Saved"].includes(stage) && inactiveDays >= 10 && !job.interview_date && !followUpDate) {
      recommendations.push(buildRecommendation(job, {
        type: recommendationTypes.STALE_APPLICATION,
        priority: "low",
        urgency: "suggested",
        title: "This role has been quiet.",
        description: `No recent activity for ${inactiveDays} days and no follow-up is scheduled.`,
        actionLabel: "Review role",
        actionTab: "overview",
        score: momentumScore - 4,
        reasoningText: `No activity for ${inactiveDays} days.`,
        reasoningSignals: ["stale_activity", ...momentum.factors],
        confidence: 0.72,
      }));
    }

    if ((stage === "Closed" || inactiveDays >= 30) && !job.interview_date && followUpStatus === "none") {
      recommendations.push(buildRecommendation(job, {
        type: recommendationTypes.ARCHIVE_CANDIDATE,
        priority: "low",
        urgency: "suggested",
        title: "Consider archiving this opportunity.",
        description: stage === "Closed" ? "Outcome is recorded." : "This opportunity has been inactive for a while.",
        actionLabel: "Review archive option",
        actionTab: "overview",
        score: Math.max(1, momentumScore - 12),
        reasoningText: stage === "Closed" ? "Closed stage with outcome recorded." : `No activity for ${inactiveDays} days.`,
        reasoningSignals: [stage === "Closed" ? "closed_stage" : "very_stale", ...momentum.factors],
        confidence: 0.68,
      }));
    }
  });

  return dedupeRecommendations(recommendations)
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || urgencyRank[a.urgency] - urgencyRank[b.urgency] || b.score - a.score);
}

export function filterRecommendationsForDashboard(recommendations = [], limit = 5) {
  const sorted = [...recommendations].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || urgencyRank[a.urgency] - urgencyRank[b.urgency] || b.score - a.score);
  const selected = [];
  const counts = {};

  sorted.forEach((recommendation) => {
    if (selected.length >= limit) return;
    if (urgentBypassTypes.has(recommendation.type)) {
      selected.push(recommendation);
      counts[recommendation.type] = (counts[recommendation.type] || 0) + 1;
      return;
    }
    const max = visibleTypeLimits[recommendation.type] ?? 2;
    if ((counts[recommendation.type] || 0) >= max) return;
    selected.push(recommendation);
    counts[recommendation.type] = (counts[recommendation.type] || 0) + 1;
  });

  if (selected.length >= limit) return selected;
  sorted.forEach((recommendation) => {
    if (selected.length >= limit) return;
    if (selected.some((item) => item.id === recommendation.id)) return;
    selected.push(recommendation);
  });
  return selected;
}

function buildRecommendation(job, recommendation) {
  return {
    id: `${recommendation.type}-${job.id}`,
    relatedJobId: job.id,
    actionRoute: "/app/applications",
    createdAt: new Date().toISOString(),
    ...recommendation,
    confidence: recommendation.confidence ?? 0.7,
    reasoningSignals: [...new Set(recommendation.reasoningSignals ?? [])],
    metadata: {
      jobTitle: getDisplayJobTitle(job),
      company: getDisplayCompanyName(job),
      stage: normalizeStage(job.status),
    },
  };
}

function dedupeRecommendations(recommendations) {
  const seen = new Set();
  return recommendations.filter((recommendation) => {
    const key = `${recommendation.type}-${recommendation.relatedJobId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shouldRecommendCoverLetter(job = {}) {
  if (asksForCoverLetter(job.job_description)) return true;
  const text = `${job.job_title || ""} ${job.job_description || ""}`.toLowerCase();
  return /\b(manager|consultant|client|customer|success|account|implementation|onboarding|stakeholder|enterprise|professional services)\b/i.test(text);
}

function asksForCoverLetter(description = "") {
  return /\bcover\s+letter\b|\bletter\s+of\s+interest\b|\bstatement\s+of\s+interest\b/i.test(description);
}

function getLatestScores(jobScores) {
  const latest = new Map();
  [...jobScores]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .forEach((score) => {
      if (!latest.has(score.job_id)) latest.set(score.job_id, score);
    });
  return latest;
}

export function getRecommendationTone(priority) {
  return {
    critical: "bg-rose-50 text-rose-700 ring-rose-100",
    high: "bg-amber-50 text-amber-800 ring-amber-100",
    medium: "bg-brand-50 text-brand-800 ring-brand-100",
    low: "bg-slate-50 text-slate-600 ring-slate-100",
  }[priority] ?? "bg-slate-50 text-slate-600 ring-slate-100";
}

export function getRecommendationIcon(type) {
  return {
    FOLLOW_UP_DUE: "bell",
    FOLLOW_UP_OVERDUE: "bell",
    INTERVIEW_SOON: "calendar",
    STRONG_MATCH_NEEDS_OUTREACH: "message",
    COVER_LETTER_RECOMMENDED: "document",
    INTERVIEW_PREP_INCOMPLETE: "sparkles",
    STALE_APPLICATION: "clock",
    READY_TO_APPLY: "arrow",
    HIGH_MOMENTUM_ROLE: "trending",
    ARCHIVE_CANDIDATE: "archive",
  }[type] ?? "sparkles";
}

export function getRecommendationMeta(recommendation = {}) {
  const parts = [recommendation.metadata?.company, recommendation.metadata?.stage, recommendation.urgency === "today" ? "Today" : ""].filter(Boolean);
  return parts.join(" · ");
}

function getFollowUpReasoning(followUpDate, latestActivity) {
  if (latestActivity) return `No touchpoint logged since ${formatDate(latestActivity.toISOString().slice(0, 10))}.`;
  if (followUpDate) return `Follow-up date set for ${formatDate(followUpDate)}.`;
  return "Follow-up reminder is active.";
}

function getInterviewReasoning(job, hasInterviewPrep) {
  const relative = getRelativeInterviewLabel(job);
  return `${relative}${hasInterviewPrep ? "" : " + prep not started"}.`;
}

function getRelativeInterviewLabel(job) {
  if (!job.interview_date) return "Interview scheduled";
  const today = todayIso();
  const diffDays = Math.round((new Date(`${job.interview_date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
  if (diffDays === 0) return "Interview today";
  if (diffDays === 1) return "Interview tomorrow";
  if (diffDays > 1) return `Interview in ${diffDays} days`;
  return "Interview date passed";
}
