import { formatDate, todayIso } from "./date.js";
import { getFollowUpDate, getFollowUpStatus, normalizeStage } from "./followUp.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "./jobDisplay.js";
import { isCoverLetter, isRecruiterMessage } from "./jobAiStatus.js";
import { daysSince, getJobMomentumScore, getLatestActivityDate, isInterviewWithinHours } from "./jobMomentum.js";

const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };
const urgencyRank = { overdue: 0, today: 1, upcoming: 2, suggested: 3 };

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

  const jobsToEvaluate = jobs.length ? jobs : followups;

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
    const momentumScore = getJobMomentumScore(job, { score, messages, resumeVersions, interviewPrep, activityHistory });

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
      }));
    }

    if ((stage === "Closed" || inactiveDays >= 30) && !job.interview_date && followUpStatus === "none") {
      recommendations.push(buildRecommendation(job, {
        type: recommendationTypes.ARCHIVE_CANDIDATE,
        priority: "low",
        urgency: "suggested",
        title: "Consider archiving this opportunity.",
        description: stage === "Closed" ? "Outcome is recorded." : "This opportunity has been inactive for a while.",
        actionLabel: "Review outcome",
        actionTab: "overview",
        score: Math.max(1, momentumScore - 12),
      }));
    }
  });

  return dedupeRecommendations(recommendations)
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || urgencyRank[a.urgency] - urgencyRank[b.urgency] || b.score - a.score);
}

function buildRecommendation(job, recommendation) {
  return {
    id: `${recommendation.type}-${job.id}`,
    relatedJobId: job.id,
    actionRoute: "/app/applications",
    createdAt: new Date().toISOString(),
    ...recommendation,
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
  const parts = [recommendation.metadata?.company, recommendation.metadata?.stage, recommendation.urgency === "today" ? todayIso() : ""].filter(Boolean);
  return parts.join(" · ");
}
