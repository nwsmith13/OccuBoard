import { CheckCircle2, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button.jsx";
import { getFitScoreTone, getLatestFitScore } from "../../components/ui/FitScoreBadge.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { getActiveJobs, getArchivedJobs, isArchivedJob } from "../../lib/archive.js";
import { formatDate, todayIso } from "../../lib/date.js";
import { normalizeStage } from "../../lib/followUp.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "../../lib/jobDisplay.js";
import { getJobAiStatus, isCoverLetter, isCoverLetterSkipped } from "../../lib/jobAiStatus.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { getNextBestAction } from "../../utils/nextBestAction.js";
import { JobDetail } from "./JobsPage.jsx";

const FOLLOW_UP_RULES = {
  followUpSoonDays: 1,
  noResponseDays: 14,
  interviewFollowUpDays: 1,
  healthyActivityDays: 7,
  waitingWindowDays: 14,
};

export function ApplicationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { jobs, jobScores, resumeVersions, messages, jobContacts, jobActivityLogs, interviewPrep, loading, error, updateJob, deleteJob } = useWorkspaceStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { applicationId } = useParams();
  const [searchParams] = useSearchParams();
  const [smartFilter, setSmartFilter] = useState("All");
  const [archiveMode, setArchiveMode] = useState("active");
  const [success, setSuccess] = useState("");
  const activeJobs = useMemo(() => getActiveJobs(jobs), [jobs]);
  const archivedJobs = useMemo(() => getArchivedJobs(jobs), [jobs]);
  const baseVisibleJobs = archiveMode === "archived" || smartFilter === "Archived" ? archivedJobs : activeJobs;
  const metrics = useMemo(() => getApplicationMetrics(activeJobs, { jobScores, jobContacts, resumeVersions, messages, jobActivityLogs }), [activeJobs, jobActivityLogs, jobContacts, jobScores, messages, resumeVersions]);
  const enrichedJobs = useMemo(
    () => baseVisibleJobs.map((job) => getApplicationCardModel(job, { jobScores, resumeVersions, messages, jobContacts, jobActivityLogs, interviewPrep })),
    [baseVisibleJobs, jobActivityLogs, jobContacts, jobScores, interviewPrep, messages, resumeVersions],
  );
  const visibleJobs = useMemo(() => enrichedJobs.filter((model) => matchesSmartFilter(model, smartFilter)), [enrichedJobs, smartFilter]);
  const actionQueue = useMemo(() => getActionQueue(enrichedJobs.filter((model) => !model.archived)), [enrichedJobs]);
  const focusJobs = useMemo(() => getFocusViewJobs(actionQueue), [actionQueue]);
  const filterCounts = useMemo(() => getWorkflowFilterCounts(enrichedJobs, archivedJobs.length, focusJobs.length), [archivedJobs.length, enrichedJobs, focusJobs.length]);
  const displayedJobs = visibleJobs;

  useEffect(() => {
    const openJobId = location.state?.openJobId || searchParams.get("jobId");
    if (!openJobId || !jobs.length) return;
    const job = jobs.find((item) => item.id === openJobId);
    if (job) {
      navigate(`/app/applications/${openJobId}`, {
        replace: true,
        state: {
          openJobTab: location.state?.openJobTab || location.state?.initialTab || searchParams.get("tab") || "overview",
          focus: location.state?.focus || searchParams.get("focus") || "",
          contactId: location.state?.contactId || searchParams.get("contactId") || "",
        },
      });
      return;
    } else {
      setSuccess("That opportunity could not be found.");
      window.setTimeout(() => setSuccess(""), 2600);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [jobs, location.pathname, location.state, navigate, searchParams]);

  if (applicationId) {
    return (
      <ApplicationWorkspacePage
        applicationId={applicationId}
        initialTab={location.state?.openJobTab || location.state?.initialTab || searchParams.get("tab") || "overview"}
        initialFocus={location.state?.focus || searchParams.get("focus") || ""}
        initialContactId={location.state?.contactId || searchParams.get("contactId") || ""}
        onBack={() => navigate("/app/applications")}
      />
    );
  }

  async function restoreJob(job) {
    const restored = await updateJob(user, job.id, { archived_at: null, archived_reason: "", archived_by_user: false });
    setArchiveMode("active");
    setSmartFilter("All");
    setSuccess("Opportunity restored.");
    toast.success("Opportunity restored.");
    window.setTimeout(() => setSuccess(""), 2600);
    return restored;
  }

  async function skipCoverLetter(job) {
    try {
      await updateJob(user, job.id, {
        cover_letter_status: "skipped",
        cover_letter_skipped_at: new Date().toISOString(),
      });
      toast.success("Cover letter skipped.");
    } catch {
      toast.error("Could not skip cover letter.");
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Application Command Center</h2>
          <p className="mt-1 text-sm text-slate-600">Today&apos;s priorities, ready-to-apply roles, and active opportunities in one calm workspace.</p>
        </div>
        <Link to="/app/new-jobs" className="w-fit">
          <Button>Analyze New Job</Button>
        </Link>
      </div>

      {success && (
        <div className="mb-5 flex items-center gap-3 rounded-lg bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 shadow-sm">
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      {error && <div className="mb-5 rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      {archiveMode === "active" && <ActionQueueSection queue={actionQueue} onOpen={(jobId) => navigate(`/app/applications/${jobId}`)} />}

      <CareerMomentumPanel metrics={metrics} />

      <WorkflowStagePills
        active={smartFilter}
        counts={filterCounts}
        onChange={(filter) => {
          setSmartFilter(filter);
          setArchiveMode(filter === "Archived" ? "archived" : "active");
        }}
      />

      {loading ? (
        <ApplicationCardsSkeleton />
      ) : !displayedJobs.length ? (
        <EmptyApplicationState filter={smartFilter} archiveMode={archiveMode} noApplications={!activeJobs.length && archiveMode === "active"}>
          {archiveMode === "active" && smartFilter !== "All" && (
            <Button variant="secondary" className="mt-5 mr-2 inline-flex" onClick={() => setSmartFilter("All")}>Back to All</Button>
          )}
          {archiveMode === "active" && smartFilter === "All" && (
            <Link to="/app/new-jobs" className="mt-5 inline-flex">
              <Button>Analyze Job</Button>
            </Link>
          )}
        </EmptyApplicationState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {displayedJobs.map((model) => (
            <ApplicationCard key={model.job.id} model={model} onOpen={() => navigate(`/app/applications/${model.job.id}`)} onSkipCoverLetter={model.action?.actionType === "generate_cover_letter" ? () => skipCoverLetter(model.job) : undefined} onRestore={model.archived ? () => restoreJob(model.job) : undefined} onDelete={model.archived ? () => deleteJob(user, model.job.id) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function CareerMomentumPanel({ metrics }) {
  return (
    <section className="mb-5 rounded-2xl bg-white/90 p-4 shadow-card ring-1 ring-brand-100">
      <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-brand-600">Career Momentum</p>
      <p className="text-sm font-semibold leading-7 text-slate-700 sm:text-base">
        You have{" "}
        <span className="font-black text-emerald-700">{metrics.readyToApply}</span>{" "}
        {metrics.readyToApply === 1 ? "role" : "roles"} ready to apply and{" "}
        <span className="font-black text-brand-700">{metrics.interviewsScheduled}</span>{" "}
        active {metrics.interviewsScheduled === 1 ? "interview" : "interviews"}. Your strongest opportunity is{" "}
        <span className="font-black text-ink">{metrics.topOpportunity.roleTitle}</span>{" "}
        <span className="font-black text-emerald-700">({metrics.topOpportunity.matchLabel})</span>.
      </p>
    </section>
  );
}

function ActionQueueSection({ queue, onOpen }) {
  const sections = [
    {
      title: "Apply Today",
      items: queue.applyToday,
      action: "Open ready role",
      dotClass: "bg-emerald-500",
      rowClass: "bg-emerald-50/45 hover:bg-emerald-50",
      badgeClass: "bg-emerald-100 text-emerald-800 ring-emerald-200",
      buttonClass: "bg-emerald-50 text-emerald-800 ring-emerald-100 hover:bg-emerald-100",
    },
    {
      title: "Needs Action",
      items: queue.needsAttention,
      action: "Review action",
      dotClass: "bg-amber-400",
      rowClass: "bg-amber-50/45 hover:bg-amber-50",
      badgeClass: "bg-amber-100 text-amber-800 ring-amber-200",
      buttonClass: "bg-amber-50 text-amber-800 ring-amber-100 hover:bg-amber-100",
    },
    {
      title: "Follow Up",
      items: queue.followUp,
      action: "Open follow-up",
      dotClass: "bg-brand-500",
      rowClass: "bg-brand-50/45 hover:bg-brand-50",
      badgeClass: "bg-brand-100 text-brand-800 ring-brand-200",
      buttonClass: "bg-brand-50 text-brand-800 ring-brand-100 hover:bg-brand-100",
    },
  ];
  return (
    <section className="mb-4 rounded-2xl bg-white/90 p-3 shadow-sm ring-1 ring-brand-100">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-brand-600">Today&apos;s Priorities</p>
      <div className="grid gap-1.5">
        {sections.map(({ title, items, dotClass, rowClass, badgeClass }) => {
          const top = items[0];
          return (
            <button key={title} type="button" disabled={!top} onClick={() => top && onOpen(top.job.id)} className={`flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-default disabled:opacity-70 ${rowClass}`}>
              <span className="flex min-w-0 items-center gap-2.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-black text-ink">{title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ring-1 ${badgeClass}`}>{items.length}</span>
                  </span>
                  <span className="block truncate text-sm font-semibold text-slate-600">{top ? getDisplayJobTitle(top.job) : "Nothing waiting here"}</span>
                </span>
              </span>
              {top && <ChevronRight size={14} className="shrink-0 text-slate-400" />}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {sections.filter((section) => section.items.length > 0).map(({ title, items, action, buttonClass }) => (
          <button key={`${title}-action`} type="button" onClick={() => onOpen(items[0].job.id)} className={`inline-flex min-h-8 items-center justify-center rounded-lg px-3 text-xs font-black ring-1 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${buttonClass}`}>
            {action}
          </button>
        ))}
      </div>
    </section>
  );
}

function WorkflowStagePills({ active, counts, onChange }) {
  const filters = ["All", "Saved", "Applied", "Interviewing", "In Progress", "Archived"];
  return (
    <div className="mb-4 rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-brand-100">
      <p className="mb-2 text-sm font-semibold text-slate-600">
        Showing: <span className="font-black text-ink">{active}</span> — {getWorkflowFilterHelper(active)}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => onChange(filter)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-black ring-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${active === filter ? "bg-brand-700 text-white ring-brand-700 shadow-md" : "bg-white text-slate-700 ring-brand-100 hover:bg-brand-50 hover:ring-brand-200"}`}
          >
            {filter}{Number.isFinite(counts[filter]) ? ` (${counts[filter]})` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function getWorkflowFilterHelper(filter) {
  return {
    All: "all active opportunities.",
    Saved: "saved roles still being prepared.",
    "In Progress": "roles still missing a key preparation step.",
    Interviewing: "roles in interview stages.",
    Applied: "submitted applications still in motion.",
    Archived: "roles removed from the active search.",
  }[filter] ?? "all opportunities in this view.";
}

function EmptyApplicationState({ filter, archiveMode, noApplications, children }) {
  const archived = archiveMode === "archived" || filter === "Archived";
  const emptyCopy = getEmptyStateCopy({ filter, archived, noApplications });
  return (
    <div className="rounded-xl bg-white/90 p-8 text-center shadow-card ring-1 ring-brand-100">
      <h3 className="text-xl font-bold text-ink">{emptyCopy.title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{emptyCopy.copy}</p>
      {noApplications && (
        <div className="mx-auto mt-4 grid max-w-md gap-1.5 text-left text-sm font-semibold text-slate-700 sm:grid-cols-2">
          {["Fit Analysis", "Tailored Resumes", "Recruiter View", "Interview Prep"].map((item) => (
            <span key={item} className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 ring-1 ring-brand-100">
              <CheckCircle2 size={14} className="text-brand-700" aria-hidden="true" /> {item}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

function getEmptyStateCopy({ filter, archived, noApplications }) {
  if (noApplications) {
    return {
      title: "No Applications Yet",
      copy: "Add your first opportunity to unlock fit analysis, tailored materials, recruiter perspective, and interview preparation.",
    };
  }
  if (filter === "All") {
    return {
      title: "No active opportunities yet.",
      copy: "Analyze a job to create your first opportunity.",
    };
  }
  if (archived) {
    return {
      title: "No archived opportunities.",
      copy: "Archived roles will stay recoverable here when you need them.",
    };
  }
  const copyByFilter = {
    "In Progress": ["Start your command center.", "Analyze your first role and OccuBoard will organize the next steps here."],
    Saved: ["No saved roles.", "Saved roles you are still preparing will appear here."],
    Interviewing: ["No active interviews yet.", "Interview-stage roles will appear here with prep shortcuts."],
    Applied: ["No applied roles in this view.", "Once you mark roles applied, they will collect here."],
  };
  const [title, copy] = copyByFilter[filter] || [`No roles match ${filter}.`, "Try another filter or keep preparing your strongest roles."];
  return { title, copy };
}

function ApplicationWorkspacePage({ applicationId, initialTab = "overview", initialFocus = "", initialContactId = "", onBack }) {
  const { user } = useAuth();
  const { jobs, updateJob, deleteJob } = useWorkspaceStore();
  const job = jobs.find((item) => item.id === applicationId);

  if (!job) {
    return (
      <section className="rounded-xl bg-white/90 p-6 text-center shadow-card ring-1 ring-brand-100">
        <h2 className="text-xl font-bold text-ink">Application not found</h2>
        <p className="mt-2 text-sm text-slate-600">This opportunity may have been deleted or archived.</p>
        <Button className="mt-4" onClick={onBack}>Back to Applications</Button>
      </section>
    );
  }

  return (
    <JobDetail
      job={job}
      initialTab={initialFocus === "contacts" ? "contacts" : initialTab}
      initialFocus={initialFocus}
      initialContactId={initialContactId}
      pageMode
      onClose={onBack}
      onEdit={undefined}
      onDelete={async () => {
        await deleteJob(user, job.id);
        onBack();
      }}
      onArchive={onBack}
      onMove={async () => {
        await updateJob(user, job.id, { status: "Applied", applied_date: job.applied_date || todayIso() });
      }}
      onJobUpdate={() => {}}
    />
  );
}

function getPipelineStage(status) {
  const normalized = normalizeStage(status);
  if (normalized === "Closed") return "Closed";
  if (normalized === "Rejected") return "Rejected";
  if (normalized === "Offer") return "Offer";
  if (normalized === "Final Interview") return "Final Interview";
  if (normalized === "Recruiter Contacted") return "Recruiter Contacted";
  if (normalized === "Phone Screen") return "Phone Screen";
  if (normalized === "Interview") return "Interview";
  if (normalized === "Applied") return "Applied";
  return "Saved";
}

function ApplicationCard({ model, onOpen, onSkipCoverLetter, onRestore, onDelete }) {
  const { job, score, archived, stage, lastContact, action, category } = model;
  const categoryTone = getApplicationCategoryTone(category);
  const scoreModel = getOpportunityScoreModel(score);
  const actionModel = getPrimaryActionModel(action, category, stage);
  const sizing = getOpportunityCardSizing({ category, stage });
  const updatedLabel = getOpportunityDateLabel({ job, lastContact });
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      aria-label={`Open ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`group cursor-pointer rounded-xl border-l-4 bg-white/95 text-left shadow-sm ring-1 ring-white/70 transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out hover:-translate-y-0.5 hover:ring-brand-200 hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 ${categoryTone} ${sizing}`}
    >
      <div className="flex items-start gap-2.5">
        <OpportunityScoreBadge model={scoreModel} />
        <div className="min-w-0 flex-1">
          <p className="overflow-hidden text-base font-bold leading-snug text-ink" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{getDisplayJobTitle(job)}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-600">{getDisplayCompanyName(job)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-700 ring-1 ring-slate-100">{stage}</span>
          </div>
        </div>
        <ChevronRight className="mt-1 shrink-0 text-slate-300 opacity-0 transition duration-150 ease-out group-hover:translate-x-0.5 group-hover:opacity-100" size={15} />
      </div>
      {!archived && actionModel && (
        <div className={`mt-2 flex flex-col gap-1 rounded-lg px-2.5 py-1.5 ring-1 sm:flex-row sm:items-center sm:justify-between ${actionModel.cardClass}`}>
          <span className="min-w-0">
            <span className="mr-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Next step</span>
            <span className={`text-sm font-black ${actionModel.textClass}`}>{actionModel.label}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            {onSkipCoverLetter && (
              <button type="button" className="rounded-full bg-white/75 px-2 py-0.5 text-[11px] font-black text-slate-600 ring-1 ring-slate-200 transition hover:bg-white hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200" onClick={(event) => { event.stopPropagation(); onSkipCoverLetter(); }}>
                Skip cover letter
              </button>
            )}
            <ChevronRight size={13} className={`shrink-0 opacity-80 ${actionModel.textClass}`} />
          </span>
        </div>
      )}
      {updatedLabel && <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-xs font-semibold text-slate-500">{updatedLabel}</p>}
      {archived && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {onRestore && <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={(event) => { event.stopPropagation(); onRestore(); }}>Restore</Button>}
          {onDelete && <Button variant="danger" className="min-h-8 px-3 text-xs" onClick={(event) => { event.stopPropagation(); onDelete(); }}>Delete</Button>}
        </div>
      )}
    </div>
  );
}

function OpportunityScoreBadge({ model }) {
  return (
    <span className={`inline-flex min-w-[84px] shrink-0 flex-col items-center justify-center rounded-xl px-2.5 py-1.5 text-center font-black ring-1 ${model.className}`}>
      <span className="text-lg leading-none">{model.value}</span>
      <span className="mt-1 text-[10px] leading-tight">{model.label}</span>
    </span>
  );
}

function getOpportunityScoreModel(score) {
  const value = Number(score?.score);
  if (!Number.isFinite(value)) {
    return {
      value: "--",
      label: "Not Scored",
      className: "bg-slate-50 text-slate-600 ring-slate-100",
      textClass: "text-slate-500",
    };
  }
  const rounded = `${Math.round(value)}%`;
  const tone = getFitScoreTone(value);
  return {
    value: rounded,
    label: tone.label,
    className: tone.className,
    textClass: value >= 80 ? "text-emerald-700" : value >= 70 ? "text-brand-700" : value >= 60 ? "text-amber-700" : "text-rose-700",
  };
}

function getPrimaryActionModel(action, category, stage) {
  if (!action || action.actionType === "no_action" || ["Archived", "Not Active"].includes(category) || stage === "Rejected") return null;
  const label = getPrimaryActionLabel(action.label, category, stage);
  const tone = action.tone || (category === "Ready To Apply" ? "success" : "info");
  const styles = {
    danger: ["bg-rose-50/55 ring-rose-100/80", "text-rose-800"],
    warning: ["bg-amber-50/55 ring-amber-100/80", "text-amber-800"],
    success: ["bg-emerald-50/55 ring-emerald-100/80", "text-emerald-800"],
    info: ["bg-brand-50/55 ring-brand-100/80", "text-brand-800"],
    neutral: ["bg-slate-50/70 ring-slate-100/80", "text-slate-700"],
  }[tone] ?? ["bg-brand-50/55 ring-brand-100/80", "text-brand-800"];
  return {
    label,
    cardClass: styles[0],
    textClass: styles[1],
  };
}

function getPrimaryActionLabel(label, category, stage) {
  const lower = String(label || "").toLowerCase();
  if (category === "Ready To Apply") return "Submit Application";
  if (["Interview", "Final Interview", "Phone Screen"].includes(stage) && lower.includes("interview")) return "Prepare For Interview";
  if (lower.includes("follow")) return "Send Follow Up";
  if (lower.includes("cover")) return "Generate Cover Letter";
  if (lower.includes("resume")) return "Generate Resume";
  if (lower.includes("message")) return "Draft Recruiter Message";
  return label || "Open Opportunity";
}

function getOpportunityCardSizing({ category, stage }) {
  if (category === "Archived") return "px-3 py-2 opacity-90";
  if (stage === "Rejected" || category === "Not Active") return "px-3 py-2";
  if (category === "Ready To Apply" || ["Interview", "Final Interview", "Phone Screen"].includes(stage)) return "px-3 py-2.5";
  return "px-3 py-2.5";
}

function getOpportunityDateLabel({ job, lastContact }) {
  if (job.applied_date) return `Applied ${formatShortDate(job.applied_date)}`;
  if (lastContact) return `Last contact ${formatShortDate(lastContact)}`;
  const updated = job.updated_at || job.created_at || job.date_saved;
  if (!updated) return "";
  const days = daysSince(updated);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 90) return `Updated ${days} days ago`;
  return `Saved ${formatShortDate(updated)}`;
}

function getApplicationCardModel(job, { jobScores = [], resumeVersions = [], messages = [], jobContacts = [], jobActivityLogs = [], interviewPrep = [] }) {
  const score = getLatestFitScore(jobScores, job.id);
  const status = getJobAiStatus(job.id, jobScores, resumeVersions, messages, job);
  const contacts = jobContacts.filter((contact) => contact.job_id === job.id);
  const timeline = getApplicationTimeline(job, { jobActivityLogs, messages, resumeVersions });
  const prep = interviewPrep.find((item) => item.job_id === job.id);
  const stage = getPipelineStage(job.status);
  const archived = isArchivedJob(job);
  const health = getApplicationHealth(job, timeline);
  const reminder = getApplicationReminder(job, contacts, timeline);
  const hasCoverLetter = messages.some((message) => message.job_id === job.id && isCoverLetter(message));
  const coverLetterSkipped = isCoverLetterSkipped(job);
  const coverLetterResolved = hasCoverLetter || coverLetterSkipped || !asksForCoverLetter(job.job_description);
  const action = getNextBestAction(job, { score, aiStatus: status, messages, hasCoverLetter: coverLetterResolved, coverLetterSkipped });
  const interviewPrepScore = prep?.content ? getApplicationInterviewPrepScore(prep) : null;
  return {
    job,
    score,
    status,
    contacts,
    timeline,
    prep,
    stage,
    archived,
    health,
    reminder,
    action,
    hasCoverLetter,
    coverLetterSkipped,
    coverLetterResolved,
    interviewPrepScore,
    lastContact: getLastContactDate(contacts),
    category: getApplicationCategory({ archived, stage, status, coverLetterResolved, health }),
  };
}

function getApplicationCategory({ archived, stage, status, coverLetterResolved, health }) {
  if (archived) return "Archived";
  if (stage === "Rejected") return "Not Active";
  if (["Interview", "Final Interview", "Phone Screen"].includes(stage)) return "Interviewing";
  if (status.resumeDrafted && coverLetterResolved && stage === "Saved") return "Ready To Apply";
  if (health.tone === "danger" || !status.resumeDrafted || !coverLetterResolved) return "Needs Attention";
  return "Active";
}

function asksForCoverLetter(description = "") {
  return /\bcover\s+letter\b|\bletter\s+of\s+interest\b|\bstatement\s+of\s+interest\b/i.test(description);
}

function getApplicationCategoryTone(category) {
  return {
    "Ready To Apply": "border-l-emerald-400 bg-emerald-50/30 ring-emerald-100",
    "Needs Attention": "border-l-amber-300 bg-amber-50/20 ring-amber-100",
    Interviewing: "border-l-brand-500 bg-brand-50/35 ring-brand-100",
    Archived: "border-l-slate-300 opacity-90",
    "Not Active": "border-l-slate-300 bg-slate-50/70 opacity-90",
    Active: "border-l-slate-200",
  }[category] ?? "border-l-slate-200";
}

function matchesSmartFilter(model, filter) {
  if (filter === "All") return !model.archived;
  if (filter === "Archived") return model.archived;
  if (filter === "Saved") return !model.archived && model.stage === "Saved";
  if (filter === "In Progress") return !model.archived && !["Ready To Apply", "Interviewing", "Not Active"].includes(model.category) && model.stage !== "Applied";
  if (filter === "Interviewing") return model.category === "Interviewing";
  if (filter === "Applied") return model.stage === "Applied";
  return true;
}

function getActionQueue(models) {
  return {
    applyToday: models.filter((model) => model.category === "Ready To Apply").slice(0, 5),
    needsAttention: models.filter((model) => model.category === "Needs Attention").slice(0, 5),
    followUp: models.filter((model) => model.health.tone === "danger" || model.reminder).slice(0, 5),
    interviewing: models.filter((model) => model.category === "Interviewing").slice(0, 5),
  };
}

function getFocusViewJobs(queue) {
  const seen = new Set();
  return [queue.applyToday, queue.followUp, queue.interviewing, queue.needsAttention]
    .flat()
    .filter((model) => {
      if (seen.has(model.job.id)) return false;
      seen.add(model.job.id);
      return true;
    })
    .slice(0, 12);
}

function getWorkflowFilterCounts(models, archivedCount) {
  return {
    All: models.filter((model) => !model.archived).length,
    Saved: models.filter((model) => !model.archived && model.stage === "Saved").length,
    "In Progress": models.filter((model) => !model.archived && !["Ready To Apply", "Interviewing", "Not Active"].includes(model.category) && model.stage !== "Applied").length,
    Interviewing: models.filter((model) => model.category === "Interviewing").length,
    Applied: models.filter((model) => model.stage === "Applied").length,
    Archived: archivedCount,
  };
}

function getApplicationMetrics(activeJobs, { jobScores = [], jobContacts = [], resumeVersions = [], messages = [], jobActivityLogs = [] }) {
  const activeApplications = activeJobs.filter((job) => getPipelineStage(job.status) !== "Saved").length;
  const interviewsScheduled = activeJobs.filter((job) => ["Interview", "Final Interview"].includes(getPipelineStage(job.status)) || job.interview_date).length;
  const interviewsThisMonth = activeJobs.filter((job) => (["Interview", "Final Interview"].includes(getPipelineStage(job.status)) && isThisMonth(job.updated_at || job.created_at)) || isThisMonth(job.interview_date)).length;
  const appliedOrBeyond = activeJobs.filter((job) => isAppliedPipelineStage(getPipelineStage(job.status)));
  const responded = appliedOrBeyond.filter((job) => jobContacts.some((contact) => contact.job_id === job.id && contact.last_contacted_at) || ["Recruiter Contacted", "Phone Screen", "Interview", "Final Interview", "Offer"].includes(getPipelineStage(job.status))).length;
  const scored = activeJobs.map((job) => getLatestFitScore(jobScores, job.id)?.score).filter((value) => Number.isFinite(Number(value)));
  const topJob = getTopOpportunity(activeJobs, jobScores);
  const followUpsNeeded = activeJobs.filter((job) => getApplicationHealth(job, getApplicationTimeline(job, {})).tone === "danger").length;
  const readyToApply = activeJobs.filter((job) => {
    const status = getJobAiStatus(job.id, jobScores, resumeVersions, messages, job);
    const hasCoverLetter = messages.some((message) => message.job_id === job.id && isCoverLetter(message));
    return getPipelineStage(job.status) === "Saved" && status.resumeDrafted && (hasCoverLetter || isCoverLetterSkipped(job) || !asksForCoverLetter(job.job_description));
  }).length;
  const bestMove = getBestNextMove({ readyToApply, interviewsThisMonth, followUpsNeeded, activeApplications });
  return {
    activeApplications,
    interviewsScheduled,
    interviewsThisMonth,
    readyToApply,
    currentStreak: getCurrentActivityStreak(activeJobs, { jobActivityLogs, messages, resumeVersions }),
    topOpportunity: topJob,
    bestNextMove: bestMove,
    responseRate: appliedOrBeyond.length ? Math.round((responded / appliedOrBeyond.length) * 100) : 0,
    averageFitScore: scored.length ? Math.round(scored.reduce((sum, value) => sum + Number(value), 0) / scored.length) : 0,
    followUpsNeeded,
    applicationsThisMonth: activeJobs.filter((job) => isThisMonth(job.applied_date)).length,
  };
}

function isAppliedPipelineStage(stage) {
  return ["Applied", "Recruiter Contacted", "Phone Screen", "Interview", "Final Interview", "Offer", "Rejected", "Closed"].includes(stage);
}

function getTopOpportunity(activeJobs, jobScores) {
  const top = activeJobs
    .filter((job) => getPipelineStage(job.status) !== "Rejected")
    .map((job) => ({ job, score: Number(getLatestFitScore(jobScores, job.id)?.score) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score)[0];
  if (!top) return { title: "Not scored yet", roleTitle: "your next analyzed role", matchLabel: "match pending", helper: "Analyze roles to reveal the strongest match." };
  return {
    title: `${Math.round(top.score)}%`,
    roleTitle: getDisplayJobTitle(top.job),
    matchLabel: `${Math.round(top.score)}% match`,
    helper: `${getDisplayJobTitle(top.job)} at ${getDisplayCompanyName(top.job)}`,
  };
}

function getBestNextMove({ readyToApply, interviewsThisMonth, followUpsNeeded, activeApplications }) {
  if (readyToApply > 0) return { title: "Submit ready role", helper: `${readyToApply} package${readyToApply === 1 ? " is" : "s are"} ready.` };
  if (followUpsNeeded > 0) return { title: "Follow up", helper: `${followUpsNeeded} touchpoint${followUpsNeeded === 1 ? "" : "s"} need attention.` };
  if (interviewsThisMonth > 0) return { title: "Practice interview", helper: "Keep prep fresh for active interview momentum." };
  if (activeApplications > 0) return { title: "Advance one role", helper: "Pick the strongest opportunity and complete the next asset." };
  return { title: "Analyze a role", helper: "Start with a job analysis to build momentum." };
}

function getApplicationTimeline(job, { jobActivityLogs = [], messages = [], resumeVersions = [] }) {
  const events = [
    job.created_at && { type: "saved", label: "Saved", created_at: job.created_at },
    job.applied_date && { type: "applied", label: "Applied", created_at: job.applied_date },
    job.interview_date && { type: "interview_scheduled", label: "Interview Scheduled", created_at: job.interview_date },
    ...resumeVersions.filter((item) => item.job_id === job.id).map((item) => ({ type: "resume_generated", label: "Resume Generated", created_at: item.created_at })),
    ...messages.filter((item) => item.job_id === job.id).map((item) => ({ type: "message_generated", label: `${item.type || "Message"} Generated`, created_at: item.created_at })),
    ...jobActivityLogs.filter((item) => item.job_id === job.id).map((item) => ({ type: item.type, label: item.metadata?.detail || item.type || "Activity", created_at: item.created_at })),
  ].filter(Boolean);
  return events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getApplicationHealth(job, timeline) {
  const days = daysSince(getLatestActivityDate(job, timeline));
  if (days <= FOLLOW_UP_RULES.healthyActivityDays) return { label: "Healthy", tone: "healthy" };
  if (days <= FOLLOW_UP_RULES.waitingWindowDays) return { label: "Waiting", tone: "waiting" };
  return { label: "Needs Follow-Up", tone: "danger" };
}

function getApplicationReminder(job, contacts, timeline) {
  const stage = getPipelineStage(job.status);
  const followUpDate = job.followup_date || job.followUpDate;
  const daysToFollowUp = followUpDate ? daysUntil(followUpDate) : null;
  if (daysToFollowUp === FOLLOW_UP_RULES.followUpSoonDays) return "Follow Up Tomorrow";
  if (["Interview", "Final Interview"].includes(stage) && daysSince(job.interview_date) >= FOLLOW_UP_RULES.interviewFollowUpDays) return "Interview Follow-Up Recommended";
  const lastContact = getLastContactDate(contacts);
  const reference = lastContact || job.applied_date || getLatestActivityDate(job, timeline);
  if (isAppliedPipelineStage(stage) && daysSince(reference) >= FOLLOW_UP_RULES.noResponseDays) return `No Response For ${FOLLOW_UP_RULES.noResponseDays} Days`;
  return "";
}

function getLatestActivityDate(job, timeline) {
  return timeline[0]?.created_at || job.updated_at || job.created_at || job.date_saved;
}

function getLastContactDate(contacts = []) {
  return contacts.map((contact) => contact.last_contacted_at).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || "";
}

function getApplicationInterviewPrepScore(prep) {
  const content = prep?.content || {};
  const questions = Array.isArray(content.questions) ? content.questions.length : 0;
  const stories = Array.isArray(content.starStories) ? content.starStories.length : 0;
  return Math.min(100, 45 + questions * 5 + stories * 10);
}

function daysSince(value) {
  if (!value) return 999;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 999;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function daysUntil(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function formatShortDate(value) {
  return formatDate(String(value).slice(0, 10));
}

function isThisMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function getCurrentActivityStreak(activeJobs, { jobActivityLogs = [], messages = [], resumeVersions = [] }) {
  const activeIds = new Set(activeJobs.map((job) => job.id));
  const activityDates = new Set();
  activeJobs.forEach((job) => {
    [job.created_at, job.updated_at, job.applied_date, job.interview_date].filter(Boolean).forEach((value) => activityDates.add(toDateKey(value)));
  });
  [...jobActivityLogs, ...messages, ...resumeVersions].forEach((item) => {
    if (activeIds.has(item.job_id) && item.created_at) activityDates.add(toDateKey(item.created_at));
  });

  let streak = 0;
  const cursor = new Date();
  while (activityDates.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function ApplicationCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="rounded-xl border-l-4 border-l-slate-200 bg-white/90 px-3 py-3 shadow-sm ring-1 ring-white/70">
          <div className="flex items-start gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-slate-100" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-3/4 rounded-full bg-slate-100" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-slate-100" />
              <div className="mt-3 flex gap-1.5">
                <div className="h-5 w-20 rounded-full bg-slate-100" />
                <div className="h-5 w-16 rounded-full bg-slate-100" />
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            <div className="h-3 w-full rounded-full bg-slate-100" />
            <div className="h-3 w-2/3 rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function getNextAction(job, status) {
  return getNextBestAction(job, { aiStatus: status }).label;
}
