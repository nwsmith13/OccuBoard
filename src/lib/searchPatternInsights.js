import { normalizeStage } from "./followUp.js";
import { getActiveJobs } from "./archive.js";
import { getDisplayCompanyName } from "./jobDisplay.js";

const keywordGroups = [
  { id: "implementation", label: "Implementation-focused roles", pattern: /\bimplementation|onboarding|rollout|deployment|professional services|solution consultant\b/i },
  { id: "customer", label: "Customer-facing roles", pattern: /\bcustomer|client|success|support|account|stakeholder|consultant\b/i },
  { id: "data", label: "Data/integration roles", pattern: /\bdata|integration|api|erp|crm|migration|mapping|reporting\b/i },
  { id: "remote", label: "Remote SaaS roles", pattern: /\bremote|saas|software|platform|cloud\b/i },
  { id: "process", label: "Workflow/process roles", pattern: /\bworkflow|process|operations|optimization|automation|project\b/i },
];

const encouragementPhrases = [
  "Momentum is building!",
  "Nice progress!",
  "Keep it going!",
  "You're creating opportunities!",
  "Good trends are emerging!",
  "Strong foundation so far!",
  "Your search is moving forward!",
];

export function buildSearchPatternInsights({ jobs = [], jobScores = [] } = {}) {
  jobs = getActiveJobs(jobs);
  const latestScores = getLatestScores(jobScores);
  const scoredJobs = jobs
    .map((job) => ({ job, score: Number(latestScores.get(job.id)?.score ?? 0) }))
    .filter((item) => item.score > 0);
  const groups = keywordGroups
    .map((group) => {
      const matches = scoredJobs.filter(({ job }) => group.pattern.test(`${job.job_title || ""} ${job.job_description || ""} ${job.remote_type || ""}`));
      const average = getAverage(matches.map((item) => item.score));
      return { ...group, matches, average };
    })
    .filter((group) => group.matches.length)
    .sort((a, b) => b.average - a.average || b.matches.length - a.matches.length);
  const bestGroup = groups[0];
  const strongestKeyword = getStrongestKeyword(scoredJobs);
  const interviewStats = getInterviewConversion(scoredJobs);
  const followUpStats = getFollowUpCompletion(jobs);
  const companyPattern = getCompanyPattern(jobs, latestScores);
  const analyzedCount = scoredJobs.length;

  return [
    analyzedCount >= 3 && bestGroup ? {
      id: "best-category",
      label: "Best Match Category",
      metric: `${bestGroup.average}% average match`,
      value: bestGroup.label,
      description: "This role category has produced your strongest average fit so far.",
      meta: pickEncouragement(analyzedCount + bestGroup.matches.length),
    } : null,
    {
      id: "recurring-keyword",
      label: "Strongest Keyword",
      metric: `${analyzedCount} job${analyzedCount === 1 ? "" : "s"} analyzed`,
      ...getKeywordInsight({ analyzedCount, strongestKeyword, bestGroup }),
    },
    {
      id: "interview-conversion",
      label: "Interview Pipeline",
      metric: `${interviewStats.interviews} interview${interviewStats.interviews === 1 ? "" : "s"}`,
      ...getInterviewInsight(interviewStats.interviews),
    },
    {
      id: "follow-up-completion",
      label: "Follow-Up Health",
      metric: followUpStats.total ? `${followUpStats.total} follow-up${followUpStats.total === 1 ? "" : "s"}` : "No follow-ups",
      ...getFollowUpInsight(followUpStats.total),
    },
    companyPattern ? {
      id: "company-momentum",
      label: "Company Momentum",
      metric: `${companyPattern.companyCount} active compan${companyPattern.companyCount === 1 ? "y" : "ies"}`,
      ...getCompanyInsight(companyPattern),
    } : null,
  ].filter(Boolean);
}

function getKeywordInsight({ analyzedCount, strongestKeyword, bestGroup }) {
  if (analyzedCount <= 2) {
    const remaining = Math.max(1, 3 - analyzedCount);
    return {
      value: "Building your profile",
      description: "We're still learning your search preferences. Analyze a few more jobs to uncover recurring strengths.",
      meta: `${remaining} more job${remaining === 1 ? "" : "s"} to unlock keyword trends!`,
    };
  }
  if (analyzedCount <= 4) {
    return {
      value: "Patterns are emerging",
      description: "Early signals are appearing in your strongest matches.",
      meta: "Just a couple more jobs and we'll identify recurring themes!",
    };
  }
  if (analyzedCount <= 9) {
    const trend = strongestKeyword?.label || bestGroup?.label?.replace(" roles", "") || "Skill";
    return {
      value: `${trend} trend`,
      description: "This skill appears repeatedly in your strongest opportunities.",
      meta: `Confidence is growing as more jobs are analyzed. ${pickEncouragement(analyzedCount)}`,
    };
  }
  return {
    value: "Strong recurring theme detected",
    description: "Your strongest opportunities consistently emphasize this skill area.",
    meta: "High confidence insight based on your search activity.",
  };
}

function getInterviewInsight(count) {
  if (count === 0) {
    return {
      value: "Interview opportunity ahead",
      description: "No active interviews yet, but strong-fit roles are building.",
      meta: "Keep applying - momentum often compounds quickly!",
    };
  }
  if (count === 1) {
    return {
      value: "Interview momentum started",
      description: "You have an active interview in progress.",
      meta: "Great work - preparation now has the highest impact!",
    };
  }
  if (count <= 4) {
    return {
      value: "Strong interview activity",
      description: "Several opportunities are moving forward.",
      meta: "Stay organized and prioritize follow-ups.",
    };
  }
  return {
    value: "Busy interview pipeline",
    description: "Multiple companies are actively engaging with you.",
    meta: "Excellent momentum - focus on preparation and follow-up.",
  };
}

function getFollowUpInsight(count) {
  if (count === 0) {
    return {
      value: "Follow-up opportunity",
      description: "No reminders are currently scheduled.",
      meta: "A simple follow-up can often restart a conversation!",
    };
  }
  if (count <= 3) {
    return {
      value: "Follow-up system active",
      description: "You're staying engaged with active opportunities.",
      meta: "Consistency helps keep your name top of mind.",
    };
  }
  return {
    value: "Strong engagement habits",
    description: "You're maintaining communication across opportunities.",
    meta: "Excellent job keeping momentum alive!",
  };
}

function getCompanyInsight(companyPattern) {
  if (companyPattern.companyCount === 1) {
    return {
      value: "One company showing traction",
      description: `${companyPattern.company} has ${companyPattern.count} active opportunit${companyPattern.count === 1 ? "y" : "ies"}${companyPattern.highestFit ? `, with a best fit of ${Math.round(companyPattern.highestFit)}%` : ""}.`,
      meta: "Keep nurturing this opportunity!",
    };
  }
  return {
    value: "Multiple companies active",
    description: `${companyPattern.company} currently has the most activity${companyPattern.highestFit ? `, with a best fit of ${Math.round(companyPattern.highestFit)}%` : ""}.`,
    meta: "Your search is generating interest across employers!",
  };
}

function pickEncouragement(seed = 0) {
  return encouragementPhrases[Math.abs(Number(seed) || 0) % encouragementPhrases.length];
}

function getStrongestKeyword(scoredJobs) {
  return keywordGroups
    .map((group) => ({
      label: group.label.replace(" roles", ""),
      count: scoredJobs.filter(({ job, score }) => score >= 85 && group.pattern.test(`${job.job_title || ""} ${job.job_description || ""} ${job.remote_type || ""}`)).length,
    }))
    .filter((item) => item.count)
    .sort((a, b) => b.count - a.count)[0];
}

function getInterviewConversion(scoredJobs) {
  const active = scoredJobs.filter(({ job }) => normalizeStage(job.status) !== "Closed");
  const interviews = active.filter(({ job }) => ["Phone Screen", "Interview", "Final Interview"].includes(normalizeStage(job.status))).length;
  return {
    total: active.length,
    interviews,
  };
}

function getFollowUpCompletion(jobs) {
  const tracked = jobs.filter((job) => job.followup_date || job.followUpDate || job.followup_completed_at || job.followUpCompletedAt);
  return { total: tracked.length };
}

function getCompanyPattern(jobs, latestScores) {
  const groups = new Map();
  jobs.forEach((job) => {
    const company = getDisplayCompanyName(job);
    const score = Number(latestScores.get(job.id)?.score ?? 0);
    if (!groups.has(company)) groups.set(company, { company, count: 0, highestFit: 0 });
    const group = groups.get(company);
    group.count += 1;
    group.highestFit = Math.max(group.highestFit, score);
  });
  const topCompany = [...groups.values()].sort((a, b) => b.count - a.count || b.highestFit - a.highestFit)[0];
  return topCompany ? { ...topCompany, companyCount: groups.size } : null;
}

function getAverage(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
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
