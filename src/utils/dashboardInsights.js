import { isThisWeek, todayIso } from "../lib/date.js";
import { getFollowUpCompletedAt, getFollowUpStatus, normalizeStage } from "../lib/followUp.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "../lib/jobDisplay.js";
import { isCoverLetter, isRecruiterMessage } from "../lib/jobAiStatus.js";

const stages = ["Saved", "Applied", "Interview", "Closed"];

export function buildDashboardInsights({ jobs = [], jobScores = [], resumeVersions = [], messages = [], jobActivityLogs = [], interviewPrep = [] }) {
  const latestScores = getLatestScores(jobScores);
  const stageCounts = getStageCounts(jobs);
  const weekly = getWeeklyCounts({ jobScores, resumeVersions, messages, jobActivityLogs });
  const followUps = getFollowUpCounts(jobs);
  const interviews = getInterviewCounts({ jobs, interviewPrep, jobActivityLogs });
  const fit = getFitSummary({ jobs, latestScores });
  const companies = getTopCompanies({ jobs, latestScores });

  return {
    pipeline: {
      counts: stageCounts,
      total: jobs.length,
      insight: getPipelineInsight(stageCounts, jobs.length),
    },
    weekly: {
      ...weekly,
      insight: getWeeklyInsight(weekly),
    },
    followUps: {
      ...followUps,
      insight: getFollowUpInsight(followUps),
    },
    interviews: {
      ...interviews,
      insight: getInterviewInsight(interviews),
    },
    fit: {
      ...fit,
      insight: getFitInsight(fit),
    },
    companies,
  };
}

function getStageCounts(jobs) {
  return stages.reduce((counts, stage) => {
    counts[stage] = jobs.filter((job) => normalizeStage(job.status) === stage).length;
    return counts;
  }, {});
}

function getWeeklyCounts({ jobScores, resumeVersions, messages, jobActivityLogs }) {
  return {
    analyzed: jobScores.filter((score) => isThisWeek(getDatePart(score.created_at))).length,
    resumes: resumeVersions.filter((version) => isThisWeek(getDatePart(version.created_at || version.updated_at))).length,
    coverLetters: messages.filter((message) => isCoverLetter(message) && isThisWeek(getDatePart(message.created_at || message.updated_at))).length,
    recruiterMessages: messages.filter((message) => isRecruiterMessage(message) && isThisWeek(getDatePart(message.created_at || message.updated_at))).length,
    followUpMessages: messages.filter((message) => message.type === "Follow-up Message" && isThisWeek(getDatePart(message.created_at || message.updated_at))).length,
    exports: jobActivityLogs.filter((event) => event.type?.includes("exported") && isThisWeek(getDatePart(event.created_at))).length,
  };
}

function getFollowUpCounts(jobs) {
  const counts = { dueToday: 0, overdue: 0, scheduled: 0, completedThisWeek: 0, dueJobs: [], overdueJobs: [] };
  jobs.forEach((job) => {
    const status = getFollowUpStatus(job);
    if (status === "due") {
      counts.dueToday += 1;
      counts.dueJobs.push(job);
    }
    if (status === "overdue") {
      counts.overdue += 1;
      counts.overdueJobs.push(job);
    }
    if (status === "scheduled") counts.scheduled += 1;
    if (isThisWeek(getDatePart(getFollowUpCompletedAt(job)))) counts.completedThisWeek += 1;
  });
  return counts;
}

function getInterviewCounts({ jobs, interviewPrep, jobActivityLogs }) {
  const scheduledJobs = jobs.filter((job) => Boolean(job.interview_date));
  const thisWeekJobs = scheduledJobs.filter((job) => isThisWeek(job.interview_date));
  const upcomingJobs = scheduledJobs.filter((job) => job.interview_date >= todayIso()).sort((a, b) => String(a.interview_date).localeCompare(String(b.interview_date)));
  const prepStarted = new Set(interviewPrep.map((prep) => prep.job_id)).size;
  const thankYouSaved = jobActivityLogs.filter((event) => event.type === "interview_thank_you_generated" && isThisWeek(getDatePart(event.created_at))).length;
  const interviewFollowUpsDue = jobs.filter((job) => normalizeStage(job.status) === "Interview" && ["due", "overdue"].includes(getFollowUpStatus(job))).length;

  return {
    scheduled: scheduledJobs.length,
    thisWeek: thisWeekJobs.length,
    prepStarted,
    thankYouSaved,
    followUpsDue: interviewFollowUpsDue,
    upcomingJobs,
    nextInterviewDate: upcomingJobs[0]?.interview_date || "",
  };
}

function getFitSummary({ jobs, latestScores }) {
  const scored = jobs
    .map((job) => ({ job, score: latestScores.get(job.id) }))
    .filter((item) => item.score);
  const values = scored.map((item) => Number(item.score.score)).filter(Number.isFinite);
  const average = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const strong = scored.filter((item) => Number(item.score.score) >= 85);
  const good = scored.filter((item) => Number(item.score.score) >= 70 && Number(item.score.score) < 85);
  const low = scored.filter((item) => Number(item.score.score) < 70);
  const best = [...scored].sort((a, b) => Number(b.score.score) - Number(a.score.score))[0] || null;

  return {
    average,
    strong: strong.length,
    good: good.length,
    low: low.length,
    best,
    scoredCount: scored.length,
  };
}

function getTopCompanies({ jobs, latestScores }) {
  const groups = new Map();
  jobs.forEach((job) => {
    const company = getDisplayCompanyName(job);
    if (!groups.has(company)) {
      groups.set(company, { company, jobs: [], stages: new Set(), stageCounts: {}, highestFit: 0, bestJob: null });
    }
    const group = groups.get(company);
    const score = latestScores.get(job.id);
    const stage = normalizeStage(job.status);
    const fit = Number(score?.score ?? 0);
    group.jobs.push(job);
    group.stages.add(stage);
    group.stageCounts[stage] = (group.stageCounts[stage] || 0) + 1;
    if (fit >= group.highestFit) {
      group.highestFit = fit;
      group.bestJob = job;
    }
  });

  return [...groups.values()]
    .sort((a, b) => b.jobs.length - a.jobs.length || b.highestFit - a.highestFit)
    .slice(0, 5)
    .map((group) => ({
      company: group.company,
      count: group.jobs.length,
      highestFit: group.highestFit,
      stages: [...group.stages],
      stageCounts: group.stageCounts,
      job: group.bestJob || group.jobs[0],
    }));
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

function getPipelineInsight(counts, total) {
  if (!total) return "Track a few roles and your pipeline shape will appear here.";
  if ((counts.Interview || 0) > 0) return "Interview activity is building.";
  if ((counts.Saved || 0) > Math.max(counts.Applied || 0, counts.Closed || 0)) return "Most opportunities are still saved.";
  if (!(counts.Closed || 0)) return "No closed outcomes yet.";
  return "Your pipeline has movement across stages.";
}

function getWeeklyInsight(weekly) {
  const total = Object.values(weekly).reduce((sum, value) => sum + Number(value || 0), 0);
  if (!total) return "Analyze your first job this week to start building momentum.";
  if (weekly.resumes || weekly.recruiterMessages || weekly.coverLetters) return "Application materials are moving this week.";
  if (weekly.analyzed) return "Fit analysis is helping you spot better opportunities.";
  return "Your metrics will become more useful as you track more roles.";
}

function getFollowUpInsight(counts) {
  const attention = counts.dueToday + counts.overdue;
  if (attention) return `${attention} follow-up${attention === 1 ? "" : "s"} need attention.`;
  if (counts.completedThisWeek) return "Strong follow-up discipline this week.";
  return "You're current on follow-ups.";
}

function getInterviewInsight(counts) {
  if (counts.thisWeek) return `${counts.thisWeek} interview${counts.thisWeek === 1 ? " is" : "s are"} coming up this week.`;
  if (counts.scheduled) return `${counts.scheduled} interview${counts.scheduled === 1 ? " is" : "s are"} scheduled.`;
  return "No interviews scheduled yet - strong matches will surface here.";
}

function getFitInsight(fit) {
  if (!fit.scoredCount) return "Analyze your first job to start seeing fit patterns.";
  if (fit.strong) return `${fit.strong} strong match${fit.strong === 1 ? "" : "es"} identified.`;
  if (fit.average >= 70) return "Your current opportunities are trending positive.";
  return "Fit scores can help you focus on better-aligned roles.";
}

function getDatePart(value) {
  return value ? String(value).slice(0, 10) : "";
}

export function getInsightJobTitle(item) {
  return item?.job ? getDisplayJobTitle(item.job) : "";
}
