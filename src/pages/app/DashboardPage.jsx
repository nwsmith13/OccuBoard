import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { CompanyLogo } from "../../components/ui/CompanyLogo.jsx";
import { FitScoreBadge, getFitScoreTone, getLatestFitScore } from "../../components/ui/FitScoreBadge.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getCompletenessTone } from "../../lib/completenessTone.js";
import { formatDate, isThisWeek } from "../../lib/date.js";
import { getFollowUpStatus, normalizeStage } from "../../lib/followUp.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "../../lib/jobDisplay.js";
import { getJobAiStatus } from "../../lib/jobAiStatus.js";
import { getProfileCompleteness } from "../../lib/profile.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { buildDashboardInsights } from "../../utils/dashboardInsights.js";
import { getNextBestAction } from "../../utils/nextBestAction.js";
import { JobDetail } from "./JobsPage.jsx";

const tinyLabelClass = "text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500";
const metadataTextClass = "text-xs font-semibold leading-5 text-slate-600";
const helperTextClass = "mt-1 text-[13px] leading-5 text-slate-700";

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { jobs, profile, activityLogs, jobActivityLogs, resumeVersions, jobScores, messages, jobContacts, interviewPrep, loading, error, updateJob, deleteJob } = useWorkspaceStore();
  const [activityOpen, setActivityOpen] = useState(true);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const completeness = getProfileCompleteness(profile);
  const completenessTone = getCompletenessTone(completeness);
  const focusItems = getFocusItems({ jobs, jobScores, resumeVersions, messages, jobContacts });
  const followUpsDue = jobs.filter((job) => ["due", "overdue"].includes(getFollowUpStatus(job))).length;
  const bestMatchRoles = getBestMatchRoles(jobScores, jobs, profile, resumeVersions, messages);
  const momentum = getMomentumSummary({ jobs, resumeVersions, jobScores, messages });
  const insights = buildDashboardInsights({ jobs, jobScores, resumeVersions, messages, jobActivityLogs, interviewPrep });
  const visibleActivity = showAllActivity ? activityLogs : activityLogs.slice(0, 4);

  async function moveToApplied(job) {
    const saved = await updateJob(user, job.id, { status: "Applied", applied_date: job.applied_date || new Date().toISOString().slice(0, 10) });
    setSelectedJob(saved ? { ...saved, initialTab: "overview" } : null);
  }

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <main className="grid min-w-0 gap-5">
        {error && <div className="rounded-lg bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        <section className="overflow-hidden rounded-xl bg-gradient-to-br from-stone-100 via-white to-emerald-50 px-4 py-3 shadow-card transition duration-[160ms] ease-out hover:shadow-soft sm:px-5">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className={tinyLabelClass}>Momentum</p>
              <h2 className="mt-1 text-xl font-bold text-ink">{momentum.headline}</h2>
              <p className={helperTextClass}>{momentum.summary}</p>
            </div>
            <Link to="/app/new-jobs" className="inline-flex shrink-0 self-start rounded-lg bg-white/55 p-0.5 shadow-sm transition duration-[160ms] ease-out hover:bg-white/85 hover:shadow-card">
              <Button className="min-h-8 px-3.5 py-1.5">Analyze New Job</Button>
            </Link>
          </div>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
            {momentum.items.map((item) => (
              <div key={item.label} className="rounded-lg bg-white/70 px-3 py-1.5 shadow-sm transition duration-[160ms] ease-out hover:bg-white/90">
                <p className="text-lg font-black text-slate-900">{item.value}</p>
                <p className={metadataTextClass}>{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-white/95 p-4 shadow-card sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Today</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-ink">Today&apos;s Focus</h2>
                {followUpsDue > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-100">{followUpsDue} follow-up{followUpsDue === 1 ? "" : "s"} due</span>}
              </div>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-700">The next few things worth your attention.</p>
          </div>
          <div className="mt-4 grid gap-3.5">
            {focusItems.map((item) => (
              <button
                key={`${item.kind}-${item.id}`}
                type="button"
                className={`group flex cursor-pointer gap-4 rounded-xl p-3.5 text-left shadow-sm ring-1 ring-transparent transition-[transform,box-shadow,border-color,background-color] duration-[160ms] ease-out hover:-translate-y-0.5 hover:ring-emerald-100 hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 sm:p-4 ${getFocusTone(item.nextBestAction?.tone)}`}
                onClick={() => setSelectedJob({ ...item, initialTab: getFocusInitialTab(item) })}
                aria-label={`Open ${getDisplayJobTitle(item)} at ${getDisplayCompanyName(item)}`}
              >
                <span className={`mt-1 h-auto w-2 shrink-0 rounded-full ${getFocusAccent(item.nextBestAction?.tone)}`} />
                <CompanyLogo companyName={getDisplayCompanyName(item)} companyDomain={item.company_domain} companyLogoUrl={item.company_logo_url} sourceUrl={item.source_url} size="lg" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FitScoreBadge score={getLatestFitScore(jobScores, item.id)} compact />
                    <p className="text-lg font-bold leading-snug">{getDisplayJobTitle(item)}</p>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-700">{getDisplayCompanyName(item)}</p>
                  <p className={`mt-3 text-sm font-semibold ${getFocusTextTone(item.nextBestAction?.tone)}`}>{getFocusActionLabel(item)}</p>
                  {item.nextBestAction?.description && <p className="mt-1 text-sm leading-5 text-slate-600">{item.nextBestAction.description}</p>}
                </div>
                <ChevronRight className="mt-1 shrink-0 text-slate-300 opacity-0 transition duration-[160ms] ease-out group-hover:translate-x-0.5 group-hover:opacity-100" size={18} />
              </button>
            ))}
            {!focusItems.length && (
              <div className="flex gap-3 rounded-lg bg-stone-50 p-4">
                <CheckCircle2 className="text-emerald-700" size={20} />
                <p className="text-sm font-semibold text-slate-800">Nothing urgent. Add or review saved jobs when you are ready.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-white/70 p-4 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-xl font-bold">Best Match Roles</h2>
            <p className="text-sm text-slate-600">A light signal from your profile and analyzed jobs.</p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {bestMatchRoles.map((item, index) => (
              <button key={`${item.label}-${index}`} type="button" className={`group rounded-xl p-3.5 text-left shadow-sm ring-1 ring-white/70 transition-[transform,box-shadow,border-color,background-color] duration-[160ms] ease-out hover:-translate-y-0.5 hover:bg-white/90 hover:ring-brand-100 hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${item.job ? getBestMatchTone(item.stage) : "bg-white/65"}`} onClick={() => item.job && setSelectedJob({ ...item.job, initialTab: "overview" })}>
                <div className="flex items-center gap-3">
                  {item.job ? <CompanyLogo companyName={item.company} companyDomain={item.job.company_domain} companyLogoUrl={item.job.company_logo_url} sourceUrl={item.job.source_url} size="md" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-xs font-bold text-brand-800">{index + 1}</span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 font-bold leading-tight text-brand-900">{item.label}</p>
                      {item.score && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${getFitScoreTone(item.score.score).className.replace("ring-1 ", "")}`}>{Math.round(Number(item.score.score))}%</span>}
                    </div>
                  </div>
                  {item.job && <ChevronRight className="shrink-0 text-slate-300 opacity-0 transition duration-[160ms] ease-out group-hover:translate-x-0.5 group-hover:opacity-100" size={16} />}
                </div>
                {item.company && <p className="mt-2 text-sm font-semibold text-slate-800">{item.company}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {item.stage && <span className="rounded-full bg-white/75 px-2 py-0.5 text-xs font-bold text-slate-700 ring-1 ring-slate-100">{item.stage}</span>}
                  {item.matchLabel && <span className={metadataTextClass}>{item.matchLabel}</span>}
                </div>
                {item.action && <p className="mt-2 truncate text-xs font-bold text-brand-800">{item.action}</p>}
                {item.reason && <p className="mt-1 truncate text-[13px] font-medium leading-5 text-slate-700">{item.reason}</p>}
              </button>
            ))}
          </div>
        </section>

        <SearchInsights
          insights={insights}
          onOpenJob={(job, initialTab = "overview") => setSelectedJob({ ...job, initialTab })}
          onOpenStage={(stage) => navigate(`/app/applications?stage=${encodeURIComponent(stage)}`)}
        />
      </main>

      <aside className="grid gap-4 xl:sticky xl:top-24 xl:self-start">
        <Card className="bg-white/75 p-3.5 shadow-sm">
          <h2 className="text-lg font-bold">Profile Completeness</h2>
          <p className={helperTextClass}>A stronger profile makes guidance sharper.</p>
          <div className={`mt-3 rounded-lg p-2.5 ${completenessTone.panel}`}>
            <div className="flex items-center justify-between gap-3">
              <span className={`text-sm font-bold ${completenessTone.text}`}>{completenessTone.label}</span>
              <span className={`text-sm font-bold ${completenessTone.text}`}>{completeness}%</span>
            </div>
            <div className={`mt-2.5 h-2 rounded-full ${completenessTone.track}`}>
              <div className={`h-2 rounded-full transition-all duration-300 ${completenessTone.bar}`} style={{ width: `${completeness}%` }} />
            </div>
          </div>
        </Card>

        <Card className="bg-white/70 p-0 shadow-sm">
          <button type="button" className="flex w-full items-center justify-between px-3.5 py-2.5 text-left" onClick={() => setActivityOpen((value) => !value)}>
            <span className={tinyLabelClass}>Recent Activity</span>
            {activityOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          {activityOpen && (
            <div className="border-t border-slate-100 p-2.5">
              <div className="grid gap-1.5">
                {visibleActivity.map((item) => {
                  const activity = formatActivity(item);
                  return (
                    <div key={item.id} className="rounded-lg bg-stone-50/60 px-2.5 py-1.5 transition hover:bg-stone-50">
                      <p className="text-sm font-medium leading-5 text-slate-700">
                        {activity.action}
                        {activity.company && (
                          <>
                            <span className="mx-1.5 text-slate-300">{"\u2022"}</span>
                            {activity.company}
                          </>
                        )}
                      </p>
                      <p className={metadataTextClass}>{formatDate(item.created_at?.slice(0, 10))}</p>
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
      {selectedJob && (
        <JobDetail
          job={selectedJob}
          initialTab={selectedJob.initialTab}
          onClose={() => setSelectedJob(null)}
          onEdit={() => setSelectedJob(null)}
          onDelete={async () => { await deleteJob(user, selectedJob.id); setSelectedJob(null); }}
          onMove={() => moveToApplied(selectedJob)}
          onJobUpdate={(updated) => setSelectedJob(updated)}
        />
      )}
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

function SearchInsights({ insights, onOpenJob, onOpenStage }) {
  const dueJob = insights.followUps.overdueJobs[0] || insights.followUps.dueJobs[0];
  const bestMatch = insights.fit.best;
  const upcomingInterview = insights.interviews.upcomingJobs[0];
  const maxStage = Math.max(1, insights.pipeline.total);

  return (
    <section className="rounded-xl bg-white/90 p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={tinyLabelClass}>Search Insights</p>
          <h2 className="mt-1 text-xl font-bold text-ink">Search Insights</h2>
          <p className={helperTextClass}>Your job search progress at a glance.</p>
        </div>
        <Link to="/app/applications" className="text-sm font-semibold text-brand-700 hover:text-brand-900">View applications</Link>
      </div>

      <div className="mt-4 grid gap-3.5 lg:grid-cols-2">
        <InsightCard title="Pipeline Snapshot" insight={insights.pipeline.insight}>
          <div className="grid gap-2">
            {["Saved", "Applied", "Interview", "Closed"].map((stage) => {
              const count = insights.pipeline.counts[stage] || 0;
              return (
                <button key={stage} type="button" className="group rounded-lg px-2 py-1 text-left transition-[transform,box-shadow,border-color,background-color] duration-[160ms] ease-out hover:-translate-y-0.5 hover:bg-brand-50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100" onClick={() => onOpenStage(stage)} aria-label={`Open ${stage} applications`}>
                  <div className="mb-1 flex items-center justify-between text-[13px] font-semibold leading-5 text-slate-700">
                    <span>{stage}</span>
                    <span className="inline-flex items-center gap-1">{count}<ChevronRight className="opacity-0 transition duration-[160ms] ease-out group-hover:translate-x-0.5 group-hover:opacity-60" size={13} /></span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full transition-all group-hover:brightness-95 ${getStageBar(stage)}`} style={{ width: `${Math.max(count ? 8 : 0, (count / maxStage) * 100)}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </InsightCard>

        <InsightCard title="Weekly Activity" insight={insights.weekly.insight}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MiniStat label="Jobs analyzed" value={insights.weekly.analyzed} />
            <MiniStat label="Resumes" value={insights.weekly.resumes} />
            <MiniStat label="Cover letters" value={insights.weekly.coverLetters} />
            <MiniStat label="Recruiter messages" value={insights.weekly.recruiterMessages} />
            <MiniStat label="Follow-up messages" value={insights.weekly.followUpMessages} />
            <MiniStat label="Exports" value={insights.weekly.exports} />
          </div>
        </InsightCard>

        <InsightCard title="Follow-up Health" insight={insights.followUps.insight}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Due today" value={insights.followUps.dueToday} tone="warning" onClick={insights.followUps.dueJobs[0] ? () => onOpenJob(insights.followUps.dueJobs[0], "overview") : undefined} />
            <MiniStat label="Overdue" value={insights.followUps.overdue} tone="danger" onClick={insights.followUps.overdueJobs[0] ? () => onOpenJob(insights.followUps.overdueJobs[0], "overview") : undefined} />
            <MiniStat label="Scheduled" value={insights.followUps.scheduled} />
            <MiniStat label="Completed" value={insights.followUps.completedThisWeek} tone="success" />
          </div>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[13px] font-semibold leading-5 text-slate-700">{getFollowUpStatusCopy(insights.followUps)}</p>
          {dueJob && (
            <Button variant="secondary" className="mt-3 min-h-8 px-3 text-xs" onClick={() => onOpenJob(dueJob, "overview")}>
              Review follow-ups
            </Button>
          )}
        </InsightCard>

        <InsightCard title="Interview Momentum" insight={insights.interviews.insight}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MiniStat label="Scheduled" value={insights.interviews.scheduled} tone="success" />
            <MiniStat label="This week" value={insights.interviews.thisWeek} tone="success" />
            <MiniStat label="Prep ready" value={insights.interviews.prepStarted} />
            <MiniStat label="Thank-you notes" value={insights.interviews.thankYouSaved} />
            <MiniStat label="Follow-ups due" value={insights.interviews.followUpsDue} tone={insights.interviews.followUpsDue ? "warning" : "neutral"} />
          </div>
          {insights.interviews.nextInterviewDate && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] font-bold leading-5 text-emerald-800">Next interview: {formatDate(insights.interviews.nextInterviewDate)}</p>}
          {upcomingInterview && (
            <Button variant="secondary" className="mt-3 min-h-8 px-3 text-xs" onClick={() => onOpenJob(upcomingInterview, "interview")}>
              Open interview prep
            </Button>
          )}
        </InsightCard>

        <InsightCard title="Fit Score Insights" insight={insights.fit.insight}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Average fit" value={insights.fit.scoredCount ? `${insights.fit.average}%` : "Not yet"} />
            <MiniStat label="Strong" value={insights.fit.strong} tone="success" />
            <MiniStat label="Good" value={insights.fit.good} />
            <MiniStat label="Low" value={insights.fit.low} tone="neutral" />
          </div>
          {bestMatch && (
            <button type="button" className="group mt-3 flex w-full items-center justify-between gap-3 rounded-lg bg-brand-50 px-3 py-2 text-left text-sm transition-[transform,box-shadow,border-color,background-color] duration-[160ms] ease-out hover:-translate-y-0.5 hover:bg-brand-100 hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100" onClick={() => onOpenJob(bestMatch.job, "overview")}>
              <span className="min-w-0">
              <span className="block font-bold text-brand-900">Best current match: {getDisplayJobTitle(bestMatch.job)}</span>
              <span className="text-[13px] font-semibold text-slate-700">{getDisplayCompanyName(bestMatch.job)} {"\u2022"} {Math.round(Number(bestMatch.score.score))}% fit</span>
              </span>
              <ChevronRight className="shrink-0 text-brand-400 opacity-0 transition duration-[160ms] ease-out group-hover:translate-x-0.5 group-hover:opacity-100" size={16} />
            </button>
          )}
        </InsightCard>

        <InsightCard title="Company Activity" insight={insights.companies.length ? "The companies showing the most activity in your search." : "Company patterns will appear as you track more roles."}>
          <div className="grid gap-2">
            {insights.companies.map((company) => (
              <button key={company.company} type="button" className="group flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-left transition-[transform,box-shadow,border-color,background-color] duration-[160ms] ease-out hover:-translate-y-0.5 hover:bg-brand-50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100" onClick={() => onOpenJob(company.job, "overview")}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-ink">{company.company}</span>
                  <span className="text-[13px] leading-5 text-slate-600">{formatCompanyActivity(company)}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {company.stages.map((stage) => <span key={stage} className="rounded-full bg-white/85 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-100">{stage}</span>)}
                    {company.lastActive && <span className="py-0.5 text-[11px] font-semibold text-slate-500">active {formatDate(company.lastActive)}</span>}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold text-brand-800 ring-1 ring-brand-100">{company.highestFit ? `${Math.round(company.highestFit)}%` : "New"}<ChevronRight className="opacity-0 transition duration-[160ms] ease-out group-hover:translate-x-0.5 group-hover:opacity-70" size={12} /></span>
              </button>
            ))}
            {!insights.companies.length && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-slate-600">Analyze your first job to start building insights.</p>}
          </div>
        </InsightCard>
      </div>
    </section>
  );
}

function InsightCard({ title, insight, children }) {
  return (
    <article className="rounded-xl bg-white/80 p-3.5 shadow-sm ring-1 ring-brand-100 sm:p-4">
      <h3 className="font-bold text-ink">{title}</h3>
      <p className="mt-1 min-h-8 text-[13px] leading-5 text-slate-700">{insight}</p>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function MiniStat({ label, value, tone = "info", onClick }) {
  const className = `group rounded-lg px-3 py-2 text-left ring-1 transition-[transform,box-shadow,border-color,background-color] duration-[160ms] ease-out ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100" : ""} ${getMiniStatTone(tone)}`;
  const content = (
    <>
      <p className="text-lg font-black">{value}</p>
      <p className="mt-0.5 text-xs font-semibold leading-4 opacity-85">{label}</p>
    </>
  );
  if (onClick) return <button type="button" className={className} onClick={onClick}>{content}</button>;
  return <div className={className}>{content}</div>;
}

function getMiniStatTone(tone) {
  return {
    danger: "bg-rose-50 text-rose-700 ring-rose-100",
    warning: "bg-amber-50 text-amber-800 ring-amber-100",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    neutral: "bg-slate-50 text-slate-600 ring-slate-100",
    info: "bg-brand-50 text-brand-800 ring-brand-100",
  }[tone] ?? "bg-brand-50 text-brand-800 ring-brand-100";
}

function getStageBar(stage) {
  return {
    Saved: "bg-cyan-300",
    Applied: "bg-brand-500",
    Interview: "bg-emerald-400",
    Closed: "bg-slate-300",
  }[stage] ?? "bg-brand-300";
}

function getFollowUpStatusCopy(followUps) {
  const attention = followUps.dueToday + followUps.overdue;
  if (attention === 1) return "1 follow-up still needs attention.";
  if (attention > 1) return `${attention} follow-ups still need attention.`;
  if (followUps.completedThisWeek > 0) return "Strong consistency this week.";
  return "You're staying current.";
}

function formatCompanyActivity(company) {
  const stageParts = ["Interview", "Applied", "Saved", "Closed"]
    .filter((stage) => company.stageCounts?.[stage])
    .map((stage) => `${company.stageCounts[stage]} ${stage.toLowerCase()}`);
  const stageSummary = stageParts.length ? stageParts.join(" \u2022 ") : company.stages.join(", ");
  return `${company.count} role${company.count === 1 ? "" : "s"} \u2022 ${stageSummary}${company.highestFit ? ` \u2022 best fit ${Math.round(company.highestFit)}%` : ""}`;
}

function getBestMatchRoles(jobScores, jobs, profile, resumeVersions = [], messages = []) {
  const strongScores = jobScores.filter((score) => Number(score.score) >= 65);
  const topJobs = [...strongScores]
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, 3)
    .map((score) => {
      const job = jobs.find((item) => item.id === score.job_id);
      const aiStatus = job ? getJobAiStatus(job.id, jobScores, resumeVersions, messages) : {};
      const nextBestAction = job ? getNextBestAction(job, { score, aiStatus, messages }) : null;
      return job ? {
        label: getDisplayJobTitle(job),
        company: getDisplayCompanyName(job),
        matchLabel: getFitScoreTone(score.score).label,
        score,
        job,
        stage: normalizeStage(job.status),
        action: getBestMatchAction(nextBestAction, score),
        reason: getMatchReason(job, score),
      } : null;
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

function getBestMatchAction(nextBestAction, score) {
  if (nextBestAction?.actionType && nextBestAction.actionType !== "no_action") return nextBestAction.label;
  if (Number(score?.score ?? 0) >= 85) return "Strong implementation match";
  return "Review match";
}

function getMatchReason(job, score) {
  const text = `${job.job_title || ""} ${job.job_description || ""}`.toLowerCase();
  if (/\bimplementation|onboarding|rollout|deployment|solution design\b/.test(text)) return "Strong implementation overlap";
  if (/\bcustomer|client|success|account|stakeholder|consultant|support\b/.test(text)) return "Customer-facing SaaS alignment";
  if (/\bworkflow|process|operations|optimization|automation\b/.test(text)) return "Workflow/process experience match";
  if (/\bdata mapping|integration|api|erp|crm|migration|reporting\b/.test(text)) return "Data mapping experience match";
  if (Number(score?.score ?? 0) >= 85) return "High fit with current resume";
  return "Good alignment with your profile";
}

function getBestMatchTone(stage) {
  return {
    Saved: "bg-cyan-50/70",
    Applied: "bg-brand-50/70",
    Interview: "bg-emerald-50/70",
    Closed: "bg-slate-50",
  }[stage] ?? "bg-white/65";
}

function getFocusTone(tone) {
  return {
    danger: "bg-rose-50/80",
    warning: "bg-amber-50/80",
    success: "bg-emerald-50/80",
    info: "bg-brand-50/80",
    neutral: "bg-slate-50",
  }[tone] ?? "bg-slate-50";
}

function getFocusAccent(tone) {
  return {
    danger: "bg-rose-400",
    warning: "bg-amber-400",
    success: "bg-emerald-400",
    info: "bg-brand-300",
    neutral: "bg-slate-300",
  }[tone] ?? "bg-brand-300";
}

function getFocusTextTone(tone) {
  return {
    danger: "text-rose-700",
    warning: "text-amber-700",
    success: "text-emerald-700",
    info: "text-brand-800",
    neutral: "text-slate-600",
  }[tone] ?? "text-brand-800";
}

function getFocusInitialTab(item) {
  const actionType = item.nextBestAction?.actionType;
  if (actionType === "prepare_interview") return "interview";
  if (["follow_up_due", "follow_up_overdue", "follow_up_today", "move_to_interview"].includes(actionType)) return "overview";
  if (actionType === "review_high_fit") return "fit";
  if (["generate_resume", "apply_now"].includes(actionType)) return "resume";
  if (actionType === "generate_message") return "message";
  return "overview";
}

function getReadyToSendCount(jobs, resumeVersions, messages) {
  return jobs.filter((job) => {
    const hasResume = resumeVersions.some((version) => version.job_id === job.id);
    const hasMessage = messages.some((message) => message.job_id === job.id);
    return hasResume && hasMessage && normalizeDashboardStage(job.status) !== "Closed";
  }).length;
}

function normalizeDashboardStage(status) {
  return normalizeStage(status);
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

function getFocusItems({ jobs, jobScores, resumeVersions, messages, jobContacts }) {
  return jobs
    .map((job) => {
      const score = getLatestFitScore(jobScores, job.id);
      const aiStatus = getJobAiStatus(job.id, jobScores, resumeVersions, messages);
      const nextBestAction = getNextBestAction(job, { score, aiStatus, messages });
      const contacts = jobContacts.filter((contact) => contact.job_id === job.id);
      return { ...job, kind: nextBestAction.actionType, nextBestAction, score, contacts };
    })
    .filter((job) => job.nextBestAction.actionType !== "no_action")
    .sort((a, b) => {
      if (a.nextBestAction.priority !== b.nextBestAction.priority) return a.nextBestAction.priority - b.nextBestAction.priority;
      return Number(b.score?.score ?? 0) - Number(a.score?.score ?? 0);
    })
    .slice(0, 5);
}

function getFocusActionLabel(item) {
  const actionType = item.nextBestAction?.actionType;
  const firstName = item.contacts?.[0]?.name?.split(/\s+/)[0];
  if (firstName && actionType === "follow_up_today") return `Follow up with ${firstName} today`;
  if (firstName && actionType === "follow_up_overdue") return `Follow up with ${firstName} (overdue)`;
  return item.nextBestAction?.label || item.message;
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


