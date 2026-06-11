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
  const remainingForTrends = Math.max(0, 3 - analyzedCount);
  const hasTrendData = remainingForTrends === 0;
  const trendUnlockCopy = `Analyze ${remainingForTrends} more job${remainingForTrends === 1 ? "" : "s"} to unlock keyword trends.`;
  const noClearTrendCopy = "No recurring trend is strong enough yet. Analyze more jobs to sharpen this insight.";
  const freshness = analyzedCount ? `Based on ${analyzedCount} analyzed job${analyzedCount === 1 ? "" : "s"} · updated today` : "No analyzed jobs yet";

  return [
    {
      id: "best-category",
      label: "Best Match Category",
      value: hasTrendData && bestGroup ? bestGroup.label : "Not enough data yet",
      description: hasTrendData && bestGroup ? "Highest average fit across your analyzed active roles." : remainingForTrends ? trendUnlockCopy : noClearTrendCopy,
      meta: hasTrendData && bestGroup ? `${bestGroup.average}% avg match` : freshness,
    },
    {
      id: "recurring-keyword",
      label: "Strongest Keyword",
      value: hasTrendData && strongestKeyword ? strongestKeyword.label : "Not enough data yet",
      description: hasTrendData && strongestKeyword ? "Appears across multiple strong-match roles." : remainingForTrends ? trendUnlockCopy : noClearTrendCopy,
      meta: hasTrendData && strongestKeyword ? `${strongestKeyword.count} strong match${strongestKeyword.count === 1 ? "" : "es"}` : freshness,
    },
    {
      id: "interview-conversion",
      label: "Interview Pipeline",
      value: `${interviewStats.interviews} Active Interview${interviewStats.interviews === 1 ? "" : "s"}`,
      description: interviewStats.interviews ? `${interviewStats.interviews} of ${interviewStats.total} active scored roles are in interview stages.` : "No roles currently in interview stages.",
      meta: "Current active search",
    },
    {
      id: "follow-up-completion",
      label: "Follow-Up Health",
      value: followUpStats.total ? `${followUpStats.completed} of ${followUpStats.total} Complete` : "0 Follow-ups Scheduled",
      description: followUpStats.total ? "Tracked reminders help keep employer conversations moving." : "Set reminders to improve consistency.",
      meta: followUpStats.total ? `${followUpStats.percent}% completion` : "No reminders tracked",
    },
    {
      id: "company-momentum",
      label: "Company Momentum",
      value: companyPattern?.company || "Not enough data yet",
      description: companyPattern ? `${companyPattern.count} active opportunit${companyPattern.count === 1 ? "y" : "ies"}.` : "Track your first application to begin company-level trends.",
      meta: companyPattern?.highestFit ? `Best fit: ${Math.round(companyPattern.highestFit)}%` : "No company trends yet",
    },
  ];
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
  const interviews = active.filter(({ job }) => normalizeStage(job.status) === "Interview").length;
  return {
    total: active.length,
    interviews,
    percent: active.length ? Math.round((interviews / active.length) * 100) : 0,
  };
}

function getFollowUpCompletion(jobs) {
  const tracked = jobs.filter((job) => job.followup_date || job.followUpDate || job.followup_completed_at || job.followUpCompletedAt);
  const completed = tracked.filter((job) => job.followup_completed_at || job.followUpCompletedAt).length;
  return {
    total: tracked.length,
    completed,
    percent: tracked.length ? Math.round((completed / tracked.length) * 100) : 0,
  };
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
  return [...groups.values()].sort((a, b) => b.count - a.count || b.highestFit - a.highestFit)[0] || null;
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
