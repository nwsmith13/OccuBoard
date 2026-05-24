import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { CompanyLogo } from "../../components/ui/CompanyLogo.jsx";
import { FitScoreBadge, getFitScoreTone, getLatestFitScore } from "../../components/ui/FitScoreBadge.jsx";
import { getCompletenessTone } from "../../lib/completenessTone.js";
import { formatDate, isOverdue, isThisWeek } from "../../lib/date.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "../../lib/jobDisplay.js";
import { getProfileCompleteness } from "../../lib/profile.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";

export function DashboardPage() {
  const { jobs, profile, activityLogs, resumeVersions, jobScores, messages, loading, error } = useWorkspaceStore();
  const [activityOpen, setActivityOpen] = useState(true);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const completeness = getProfileCompleteness(profile);
  const completenessTone = getCompletenessTone(completeness);
  const focusItems = getFocusItems(jobs);
  const bestMatchRoles = getBestMatchRoles(jobScores, jobs, profile);
  const momentum = getMomentumSummary({ jobs, resumeVersions, jobScores, messages });
  const visibleActivity = showAllActivity ? activityLogs : activityLogs.slice(0, 4);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <main className="grid min-w-0 gap-6">
        {error && <div className="rounded-lg bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        <section className="overflow-hidden rounded-xl bg-gradient-to-br from-stone-100 via-white to-emerald-50 px-5 py-4 shadow-card transition hover:shadow-soft sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Momentum</p>
              <h2 className="mt-1 text-xl font-bold text-ink">{momentum.headline}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">{momentum.summary}</p>
            </div>
            <Link to="/app/new-jobs" className="inline-flex shrink-0 self-start rounded-lg bg-white/55 p-0.5 shadow-sm transition hover:bg-white/85 hover:shadow-card">
              <Button className="min-h-8 px-3.5 py-1.5">Analyze New Job</Button>
            </Link>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {momentum.items.map((item) => (
              <div key={item.label} className="rounded-lg bg-white/70 px-3.5 py-2 shadow-sm transition hover:bg-white/90">
                <p className="text-lg font-black text-slate-900">{item.value}</p>
                <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-600">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-white/95 p-6 shadow-card sm:p-7">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Today</p>
              <h2 className="mt-1 text-2xl font-bold text-ink">Today&apos;s Focus</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-600">The next few things worth your attention.</p>
          </div>
          <div className="mt-5 grid gap-4">
            {focusItems.map((item) => (
              <div key={`${item.kind}-${item.id}`} className={`group flex cursor-pointer gap-4 rounded-xl p-5 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:-translate-y-0.5 hover:ring-emerald-100 hover:shadow-card ${getFocusTone(item.kind)}`}>
                <span className={`mt-1 h-auto w-2 shrink-0 rounded-full ${getFocusAccent(item.kind)}`} />
                <CompanyLogo companyName={getDisplayCompanyName(item)} companyDomain={item.company_domain} companyLogoUrl={item.company_logo_url} sourceUrl={item.source_url} size="lg" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FitScoreBadge score={getLatestFitScore(jobScores, item.id)} compact />
                    <p className="text-lg font-bold leading-snug">{getDisplayJobTitle(item)}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{getDisplayCompanyName(item)}</p>
                  <p className={`mt-3 text-sm font-semibold ${item.kind === "Overdue" ? "text-rose-700" : item.kind === "Upcoming" ? "text-amber-700" : "text-brand-800"}`}>{item.message}</p>
                </div>
                <ChevronRight className="mt-1 shrink-0 text-slate-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" size={18} />
              </div>
            ))}
            {!focusItems.length && (
              <div className="flex gap-3 rounded-lg bg-stone-50 p-4">
                <CheckCircle2 className="text-emerald-700" size={20} />
                <p className="text-sm font-semibold text-slate-800">Nothing urgent. Add or review saved jobs when you are ready.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-white/70 p-5 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-xl font-bold">Best Match Roles</h2>
            <p className="text-sm text-slate-600">A light signal from your profile and analyzed jobs.</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {bestMatchRoles.map((item, index) => (
              <div key={`${item.label}-${index}`} className="rounded-xl bg-white/65 p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-card">
                <div className="flex items-center gap-3">
                  {item.job ? <CompanyLogo companyName={item.company} companyDomain={item.job.company_domain} companyLogoUrl={item.job.company_logo_url} sourceUrl={item.job.source_url} size="md" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-xs font-bold text-brand-800">{index + 1}</span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 font-bold leading-tight text-brand-900">{item.label}</p>
                      {item.score && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${getFitScoreTone(item.score.score).className.replace("ring-1 ", "")}`}>{Math.round(Number(item.score.score))}%</span>}
                    </div>
                  </div>
                </div>
                {item.company && <p className="mt-2.5 text-sm font-semibold text-slate-800">{item.company}</p>}
                {item.matchLabel && <p className="mt-1 text-xs font-semibold text-slate-500">{item.matchLabel}</p>}
              </div>
            ))}
          </div>
        </section>
      </main>

      <aside className="grid gap-5 xl:sticky xl:top-24 xl:self-start">
        <Card className="bg-white/75 p-4 shadow-sm">
          <h2 className="text-lg font-bold">Profile Completeness</h2>
          <p className="mt-2 text-sm text-slate-600">A stronger profile makes guidance sharper.</p>
          <div className={`mt-4 rounded-lg p-3 ${completenessTone.panel}`}>
            <div className="flex items-center justify-between gap-3">
              <span className={`text-sm font-bold ${completenessTone.text}`}>{completenessTone.label}</span>
              <span className={`text-sm font-bold ${completenessTone.text}`}>{completeness}%</span>
            </div>
            <div className={`mt-3 h-2 rounded-full ${completenessTone.track}`}>
              <div className={`h-2 rounded-full transition-all duration-300 ${completenessTone.bar}`} style={{ width: `${completeness}%` }} />
            </div>
          </div>
        </Card>

        <Card className="bg-white/70 p-0 shadow-sm">
          <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setActivityOpen((value) => !value)}>
            <span className="text-sm font-bold uppercase tracking-[0.12em] text-slate-500">Recent Activity</span>
            {activityOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          {activityOpen && (
            <div className="border-t border-slate-100 p-3">
              <div className="grid gap-1.5">
                {visibleActivity.map((item) => {
                  const activity = formatActivity(item);
                  return (
                    <div key={item.id} className="rounded-lg bg-stone-50/60 px-2.5 py-2 transition hover:bg-stone-50">
                      <p className="text-sm font-medium leading-5 text-slate-700">
                        {activity.action}
                        {activity.company && (
                          <>
                            <span className="mx-1.5 text-slate-300">{"\u2022"}</span>
                            {activity.company}
                          </>
                        )}
                      </p>
                      <p className="mt-0 text-xs text-slate-500">{formatDate(item.created_at?.slice(0, 10))}</p>
                    </div>
                  );
                })}
                {!activityLogs.length && <p className="text-sm text-slate-500">Activity will appear as you save jobs and generate AI outputs.</p>}
              </div>
              {activityLogs.length > 4 && (
                <Button variant="ghost" className="mt-4 min-h-8 px-2 text-xs" onClick={() => setShowAllActivity((value) => !value)}>
                  {showAllActivity ? "Show less" : "View all"}
                </Button>
              )}
            </div>
          )}
        </Card>
      </aside>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <main className="grid min-w-0 gap-6">
        <section className="rounded-xl bg-white/80 p-5 shadow-card">
          <div className="occu-skeleton h-4 w-28 rounded-full bg-slate-100" />
          <div className="occu-skeleton mt-4 h-7 w-2/3 max-w-md rounded-full bg-slate-100" />
          <div className="occu-skeleton mt-3 h-4 w-full max-w-xl rounded-full bg-slate-100" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((item) => <div key={item} className="occu-skeleton h-20 rounded-lg bg-slate-100/80" />)}
          </div>
        </section>
        <section className="rounded-xl bg-white/80 p-5 shadow-card">
          <div className="occu-skeleton h-7 w-48 rounded-full bg-slate-100" />
          <div className="mt-5 grid gap-4">
            {[0, 1, 2].map((item) => <div key={item} className="occu-skeleton h-24 rounded-xl bg-slate-100/80" />)}
          </div>
        </section>
      </main>
      <aside className="grid gap-5">
        <div className="h-40 rounded-lg bg-white/80 shadow-sm" />
        <div className="h-64 rounded-lg bg-white/80 shadow-sm" />
      </aside>
    </div>
  );
}

function getBestMatchRoles(jobScores, jobs, profile) {
  const strongScores = jobScores.filter((score) => Number(score.score) >= 65);
  const topJobs = [...strongScores]
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, 3)
    .map((score) => {
      const job = jobs.find((item) => item.id === score.job_id);
      return job ? { label: getDisplayJobTitle(job), company: getDisplayCompanyName(job), matchLabel: getFitScoreTone(score.score).label, score, job } : null;
    })
    .filter(Boolean);
  if (topJobs.length) return topJobs;

  const roleCounts = new Map();
  strongScores.forEach((score) => {
    const job = jobs.find((item) => item.id === score.job_id);
    if (!job?.job_title) return;
    roleCounts.set(job.job_title, (roleCounts.get(job.job_title) ?? 0) + 1);
  });

  const roles = [...roleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => ({ label, matchLabel: `${count} analyzed match${count === 1 ? "" : "es"}` }));

  if (roles.length) return roles;

  const targetRoles = String(profile?.target_roles ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((label) => ({ label, matchLabel: "From your target roles" }));

  if (targetRoles.length) return targetRoles;

  return [{ label: "Analyze a few jobs", matchLabel: "Best-match insights will appear here." }];
}

function getFocusTone(kind) {
  return {
    Overdue: "bg-rose-50/80",
    Upcoming: "bg-amber-50/80",
    Priority: "bg-emerald-50/80",
    Recent: "bg-slate-50",
  }[kind] ?? "bg-slate-50";
}

function getFocusAccent(kind) {
  return {
    Overdue: "bg-rose-400",
    Upcoming: "bg-amber-400",
    Priority: "bg-emerald-400",
    Recent: "bg-brand-300",
  }[kind] ?? "bg-brand-300";
}

function getReadyToSendCount(jobs, resumeVersions, messages) {
  return jobs.filter((job) => {
    const hasResume = resumeVersions.some((version) => version.job_id === job.id);
    const hasMessage = messages.some((message) => message.job_id === job.id);
    return hasResume && hasMessage && normalizeDashboardStage(job.status) !== "Closed";
  }).length;
}

function normalizeDashboardStage(status) {
  if (status === "Tailoring") return "Saved";
  if (["Offer", "Rejected", "Closed"].includes(status)) return "Closed";
  return status || "Saved";
}

function getMomentumSummary({ jobs, resumeVersions, jobScores, messages }) {
  const weekResumeCount = resumeVersions.filter((version) => isThisWeek(version.created_at?.slice(0, 10) || version.updated_at?.slice(0, 10))).length;
  const analyzedJobs = new Set(jobScores.map((score) => score.job_id)).size;
  const tailoredResumes = resumeVersions.filter((version) => version.title?.startsWith("Tailored Resume")).length;
  const strongFits = jobScores.filter((score) => Number(score.score) >= 75).length;
  const readyToSend = getReadyToSendCount(jobs, resumeVersions, messages);

  const headline = jobs.length ? "You are building momentum." : "Your job search workspace is ready.";
  return {
    headline,
    items: [
      { label: "resumes tailored this week", value: weekResumeCount },
      { label: "strong-fit opportunities identified", value: strongFits },
      { label: "applications ready to send", value: readyToSend },
    ],
    summary: jobs.length
      ? `You analyzed ${analyzedJobs} jobs and created ${weekResumeCount || tailoredResumes} tailored resumes this week.`
      : "Analyze a job, then turn it into a tailored resume and recruiter message.",
  };
}

function getFocusItems(jobs) {
  const overdue = jobs
    .filter((job) => job.followup_date && isOverdue(job.followup_date))
    .map((job) => ({ ...job, kind: "Overdue", message: `Follow-up was due ${formatDate(job.followup_date)}` }));
  const upcoming = jobs
    .filter((job) => job.followup_date && !isOverdue(job.followup_date))
    .sort((a, b) => new Date(a.followup_date) - new Date(b.followup_date))
    .slice(0, 2)
    .map((job) => ({ ...job, kind: "Upcoming", message: `Follow up on ${formatDate(job.followup_date)}` }));
  const highPriority = jobs
    .filter((job) => job.priority === "High" && normalizeDashboardStage(job.status) === "Saved")
    .map((job) => ({ ...job, kind: "Priority", message: "High-priority saved job needs a next step" }));
  const recent = [...jobs]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3)
    .map((job) => ({ ...job, kind: "Recent", message: `Recently saved on ${formatDate(job.date_saved)}` }));

  const seen = new Set();
  return [...overdue, ...upcoming, ...highPriority, ...recent].filter((job) => {
    if (seen.has(job.id)) return false;
    seen.add(job.id);
    return true;
  }).slice(0, 5);
}

function formatActivity(item) {
  const description = item.description ?? "";
  const company = extractActivityCompany(description);
  const action = getActivityAction(item.type, description);
  return { action, company };
}

function getActivityAction(type, description) {
  if (/resume/i.test(description)) return "Resume generated";
  if (/analyz/i.test(description)) return "Fit analyzed";
  if (/saved/i.test(description)) return "Job saved";
  if (/updated/i.test(description)) return "Job updated";
  if (/profile/i.test(type) || /profile/i.test(description)) return "Profile updated";
  if (/message/i.test(description)) return "Message generated";
  return type || "Activity";
}

function extractActivityCompany(description) {
  const atMatch = description.match(/\s+at\s+(.+)$/i);
  if (atMatch?.[1]) return atMatch[1].trim();
  const forMatch = description.match(/\s+for\s+(.+)$/i);
  return forMatch?.[1]?.trim() ?? "";
}

