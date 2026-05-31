import { Archive, CheckCircle2, ChevronRight, Copy, ExternalLink, FileText, Mail, Rows3, SquareKanban } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button.jsx";
import { CompanyLogo } from "../../components/ui/CompanyLogo.jsx";
import { FitScoreBadge, getLatestFitScore } from "../../components/ui/FitScoreBadge.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { getActiveJobs, getArchivedJobs, isArchivedJob } from "../../lib/archive.js";
import { stages } from "../../data/seedData.js";
import { formatDate, todayIso } from "../../lib/date.js";
import { getFollowUpLabel, getFollowUpStatus, getFollowUpTone, normalizeStage } from "../../lib/followUp.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "../../lib/jobDisplay.js";
import { getJobAiStatus, isCoverLetter } from "../../lib/jobAiStatus.js";
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
  const [draggingId, setDraggingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState("cards");
  const [archiveMode, setArchiveMode] = useState("active");
  const [showEmptyColumns, setShowEmptyColumns] = useState(() => window.localStorage.getItem("occuboard-show-empty-application-columns") === "true");
  const [success, setSuccess] = useState("");
  const highlightedStage = searchParams.get("stage");
  const activeJobs = useMemo(() => getActiveJobs(jobs), [jobs]);
  const archivedJobs = useMemo(() => getArchivedJobs(jobs), [jobs]);
  const visibleJobs = archiveMode === "archived" ? archivedJobs : activeJobs;
  const metrics = useMemo(() => getApplicationMetrics(activeJobs, jobScores, jobContacts), [activeJobs, jobContacts, jobScores]);

  const grouped = useMemo(
    () => Object.fromEntries(stages.map((stage) => [stage, visibleJobs.filter((item) => getPipelineStage(item.status) === stage)])),
    [visibleJobs],
  );
  const visibleStages = showEmptyColumns || archiveMode === "archived" ? stages : stages.filter((stage) => grouped[stage]?.length);
  const emptyStageCount = stages.filter((stage) => !grouped[stage]?.length).length;

  useEffect(() => {
    const openJobId = location.state?.openJobId || searchParams.get("jobId");
    if (!openJobId || !jobs.length) return;
    const job = jobs.find((item) => item.id === openJobId);
    if (job) {
      setSelected({
        ...job,
        initialTab: location.state?.openJobTab || location.state?.initialTab || searchParams.get("tab") || "overview",
        initialFocus: location.state?.focus || searchParams.get("focus") || "",
        initialContactId: location.state?.contactId || searchParams.get("contactId") || "",
      });
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
        onBack={() => navigate("/app/applications")}
      />
    );
  }

  async function moveApplication(stage) {
    if (!draggingId) return;
    const dragged = visibleJobs.find((job) => job.id === draggingId);
    await updateJob(user, draggingId, {
      status: stage,
      applied_date: isAppliedPipelineStage(stage) ? dragged?.applied_date || todayIso() : dragged?.applied_date || null,
    });
    setDraggingId(null);
    setSuccess(`Moved to ${stage}. Your application history is up to date.`);
    window.setTimeout(() => setSuccess(""), 2600);
  }

  async function moveToApplied(job) {
    await updateJob(user, job.id, { status: "Applied", applied_date: job.applied_date || todayIso() });
    setSuccess("Application saved to history.");
    setSelected(null);
  }

  async function restoreJob(job) {
    const restored = await updateJob(user, job.id, { archived_at: null, archived_reason: "", archived_by_user: false });
    setSelected(null);
    setArchiveMode("active");
    setSuccess("Opportunity restored.");
    toast.success("Opportunity restored.");
    window.setTimeout(() => setSuccess(""), 2600);
    return restored;
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Opportunity Pipeline</h2>
          <p className="mt-1 text-sm text-slate-600">A calmer view of where each opportunity stands.</p>
        </div>
        <div className="flex flex-wrap gap-2">
        <div className="flex w-fit rounded-lg bg-slate-100 p-1">
          <button type="button" className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold ${viewMode === "cards" ? "bg-white text-brand-900 shadow-sm" : "text-slate-600"}`} onClick={() => setViewMode("cards")}>
            <SquareKanban size={14} /> Cards
          </button>
          <button type="button" className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold ${viewMode === "list" ? "bg-white text-brand-900 shadow-sm" : "text-slate-600"}`} onClick={() => setViewMode("list")}>
            <Rows3 size={14} /> List
          </button>
        </div>
        <div className="flex w-fit rounded-lg bg-slate-100 p-1">
          <button type="button" className={`rounded-md px-3 py-2 text-xs font-bold ${archiveMode === "active" ? "bg-white text-brand-900 shadow-sm" : "text-slate-600"}`} onClick={() => setArchiveMode("active")}>Active</button>
          <button type="button" className={`rounded-md px-3 py-2 text-xs font-bold ${archiveMode === "archived" ? "bg-white text-brand-900 shadow-sm" : "text-slate-600"}`} onClick={() => setArchiveMode("archived")}>Archived {archivedJobs.length ? `(${archivedJobs.length})` : ""}</button>
        </div>
        </div>
      </div>

      {success && (
        <div className="mb-5 flex items-center gap-3 rounded-lg bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 shadow-sm">
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      {error && <div className="mb-5 rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      {archiveMode === "active" && <ApplicationDashboardMetrics metrics={metrics} />}

      {loading ? (
        <PipelineSkeleton />
      ) : !visibleJobs.length ? (
        <div className="rounded-xl bg-stone-50 p-8 text-center shadow-card">
          <h3 className="text-xl font-bold text-ink">{archiveMode === "archived" ? "No archived opportunities." : "No applications yet."}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{archiveMode === "archived" ? "Archived roles will appear here when you move them out of the active pipeline." : "Analyze a new job to start building your application history."}</p>
          {archiveMode === "active" && (
            <Link to="/app/new-jobs" className="mt-5 inline-flex">
              <Button>Analyze New Job</Button>
            </Link>
          )}
        </div>
      ) : viewMode === "cards" ? (
          <>
          {archiveMode === "active" && emptyStageCount > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/85 px-4 py-3 shadow-sm ring-1 ring-brand-100">
              <p className="text-sm font-bold text-slate-700">Empty Stages ({emptyStageCount})</p>
              <button
                type="button"
                className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-800 ring-1 ring-brand-100"
                onClick={() => {
                  const next = !showEmptyColumns;
                  setShowEmptyColumns(next);
                  window.localStorage.setItem("occuboard-show-empty-application-columns", String(next));
                }}
              >
                {showEmptyColumns ? "Hide Empty Columns" : "Show Empty Columns"}
              </button>
            </div>
          )}
          <div className="kanban-scroll grid snap-x grid-flow-col gap-2.5 overflow-x-auto pb-3 sm:gap-3">
            {visibleStages.map((stage) => (
              <div
              key={stage}
              className={`min-h-[210px] w-[min(296px,calc(100vw-2rem))] snap-start rounded-xl p-2 shadow-sm ring-1 sm:p-2.5 ${highlightedStage === stage ? "ring-4 ring-brand-200" : "ring-white/70"} ${getStageColumnTone(stage)}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveApplication(stage)}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">{stage}</h3>
                <span className="text-xs font-semibold text-slate-500">{grouped[stage].length}</span>
              </div>
              <div className="grid gap-2.5">
                {grouped[stage].map((job) => (
                  <ApplicationCard key={job.id} job={job} score={getLatestFitScore(jobScores, job.id)} status={getJobAiStatus(job.id, jobScores, resumeVersions, messages)} messages={messages} contacts={jobContacts.filter((contact) => contact.job_id === job.id)} timeline={getApplicationTimeline(job, { jobActivityLogs, messages, resumeVersions })} prep={interviewPrep.find((item) => item.job_id === job.id)} onOpen={() => navigate(`/app/applications/${job.id}`)} onRestore={isArchivedJob(job) ? () => restoreJob(job) : undefined} onDelete={isArchivedJob(job) ? () => deleteJob(user, job.id) : undefined} onDragStart={() => !isArchivedJob(job) && setDraggingId(job.id)} />
                ))}
                {!grouped[stage].length && <p className="rounded-lg bg-white/50 px-3 py-2.5 text-sm text-slate-600">Nothing here yet.</p>}
              </div>
            </div>
          ))}
        </div>
        </>
      ) : (
        <div className="grid gap-3">
          {visibleJobs.map((job) => (
            <ApplicationCard key={job.id} job={job} score={getLatestFitScore(jobScores, job.id)} status={getJobAiStatus(job.id, jobScores, resumeVersions, messages)} messages={messages} contacts={jobContacts.filter((contact) => contact.job_id === job.id)} timeline={getApplicationTimeline(job, { jobActivityLogs, messages, resumeVersions })} prep={interviewPrep.find((item) => item.job_id === job.id)} onOpen={() => navigate(`/app/applications/${job.id}`)} onRestore={isArchivedJob(job) ? () => restoreJob(job) : undefined} onDelete={isArchivedJob(job) ? () => deleteJob(user, job.id) : undefined} compact onDragStart={() => !isArchivedJob(job) && setDraggingId(job.id)} />
          ))}
        </div>
      )}

      {selected && (
        <JobDetail
          job={selected}
          initialTab={selected.initialTab}
          initialFocus={selected.initialFocus}
          initialContactId={selected.initialContactId}
          onClose={() => setSelected(null)}
          onEdit={() => setSelected(null)}
          onDelete={async () => { await deleteJob(user, selected.id); setSelected(null); }}
          onArchive={async (updated) => {
            setSelected(null);
            if (isArchivedJob(updated)) setArchiveMode("active");
          }}
          onMove={() => moveToApplied(selected)}
          onJobUpdate={(updated) => setSelected(updated)}
        />
      )}
    </div>
  );
}

function ApplicationDashboardMetrics({ metrics }) {
  return (
    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <MetricCard label="Active Applications" value={metrics.activeApplications} helper="Open opportunities in your current pipeline." />
      <MetricCard label="Interviews Scheduled" value={metrics.interviewsScheduled} helper="Interview or final interview stage roles." />
      <MetricCard label="Response Rate" value={`${metrics.responseRate}%`} helper="Roles with a recorded contact or interview." />
      <MetricCard label="Average Fit Score" value={metrics.averageFitScore ? `${metrics.averageFitScore}%` : "N/A"} helper="Average across analyzed active roles." />
      <MetricCard label="Follow-Ups Needed" value={metrics.followUpsNeeded} helper="Applications needing a timely touchpoint." />
      <MetricCard label="Applications This Month" value={metrics.applicationsThisMonth} helper="Roles moved into applied pipeline this month." />
    </section>
  );
}

function MetricCard({ label, value, helper }) {
  return (
    <div className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-ink">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function ApplicationWorkspacePage({ applicationId, onBack }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { jobs, jobScores, resumeVersions, messages, jobContacts, jobActivityLogs, interviewPrep, updateJob } = useWorkspaceStore();
  const job = jobs.find((item) => item.id === applicationId);
  const [stageDraft, setStageDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [tasks, setTasks] = useState(() => loadApplicationTasks(applicationId));

  useEffect(() => {
    if (!job) return;
    setStageDraft(getPipelineStage(job.status));
    setNotesDraft(job.notes || "");
  }, [job]);

  useEffect(() => {
    saveApplicationTasks(applicationId, tasks);
  }, [applicationId, tasks]);

  if (!job) {
    return (
      <section className="rounded-xl bg-white/90 p-6 text-center shadow-card ring-1 ring-brand-100">
        <h2 className="text-xl font-bold text-ink">Application not found</h2>
        <p className="mt-2 text-sm text-slate-600">This opportunity may have been deleted or archived.</p>
        <Button className="mt-4" onClick={onBack}>Back to Applications</Button>
      </section>
    );
  }

  const score = getLatestFitScore(jobScores, job.id);
  const contacts = jobContacts.filter((contact) => contact.job_id === job.id);
  const timeline = getApplicationTimeline(job, { jobActivityLogs, messages, resumeVersions });
  const health = getApplicationHealth(job, timeline);
  const latestResume = resumeVersions.filter((item) => item.job_id === job.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const coverLetter = messages.filter((item) => item.job_id === job.id && isCoverLetter(item)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const recruiterMessage = messages.filter((item) => item.job_id === job.id && !isCoverLetter(item)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const prep = interviewPrep.find((item) => item.job_id === job.id);
  const intelligence = getApplicationIntelligence(job, { score, messages, prep, timeline });
  const lastContact = getLastContactDate(contacts);
  const prepScore = prep ? getApplicationInterviewPrepScore(prep) : null;

  async function saveStage() {
    const saved = await updateJob(user, job.id, {
      status: stageDraft,
      applied_date: isAppliedPipelineStage(stageDraft) ? job.applied_date || todayIso() : job.applied_date || null,
    });
    if (saved) toast.success("Stage updated.");
  }

  async function saveNotes() {
    await updateJob(user, job.id, { notes: notesDraft });
    toast.success("Notes saved.");
  }

  async function archiveApplication() {
    await updateJob(user, job.id, { archived_at: new Date().toISOString(), archived_reason: "Archived from application workspace", archived_by_user: true });
    toast.success("Opportunity archived.");
    onBack();
  }

  function addTask(label) {
    if (!label.trim()) return;
    setTasks((current) => [...current, { id: window.crypto?.randomUUID?.() || `${Date.now()}`, label: label.trim(), done: false }]);
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl bg-white/95 p-4 shadow-card ring-1 ring-brand-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <button type="button" className="mb-3 text-xs font-bold text-brand-700 hover:text-brand-900" onClick={onBack}>Back to Applications</button>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={health.tone}>{health.label}</StatusPill>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-800 ring-1 ring-brand-100">{getPipelineStage(job.status)}</span>
              <FitScoreBadge score={score} compact />
            </div>
            <h1 className="mt-2 text-2xl font-black text-ink">{getDisplayJobTitle(job)}</h1>
            <p className="mt-1 text-sm font-bold text-brand-800">{getDisplayCompanyName(job)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={stageDraft} onChange={(event) => setStageDraft(event.target.value)}>
              {stages.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
            <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={saveStage}>Move Stage</Button>
            <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => navigate(`/app/job-tracker?jobId=${job.id}`)}>Edit</Button>
            <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => navigate("/app/applications", { state: { openJobId: job.id, openJobTab: "export" } })}>Export Package</Button>
            <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={archiveApplication}><Archive size={13} /> Archive</Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="grid gap-4">
          <WorkspaceCard title="Application Summary">
            <SummaryLine label="Company" value={getDisplayCompanyName(job)} />
            <SummaryLine label="Job Title" value={getDisplayJobTitle(job)} />
            <SummaryLine label="Stage" value={getPipelineStage(job.status)} />
            <SummaryLine label="Fit Score" value={score ? `${Math.round(Number(score.score))}%` : "Not analyzed"} />
            <SummaryLine label="Applied Date" value={job.applied_date ? formatShortDate(job.applied_date) : "Not applied"} />
            <SummaryLine label="Last Contact" value={lastContact ? formatShortDate(lastContact) : "No contact yet"} />
            <SummaryLine label="Interview Date" value={job.interview_date ? formatShortDate(job.interview_date) : "Not scheduled"} />
          </WorkspaceCard>
          <WorkspaceCard title="Contacts">
            {contacts.length ? contacts.map((contact) => (
              <div key={contact.id} className="rounded-lg bg-brand-50 p-3">
                <p className="font-bold text-ink">{contact.name || contact.email || "Contact"}</p>
                <p className="text-xs font-semibold text-slate-600">{contact.title || contact.source || "Contact"}</p>
                {contact.email && <p className="mt-1 truncate text-xs text-brand-700">{contact.email}</p>}
                {contact.linkedin_url && <a className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-brand-700" href={contact.linkedin_url} target="_blank" rel="noreferrer">LinkedIn <ExternalLink size={11} /></a>}
              </div>
            )) : <p className="text-sm text-slate-600">No contacts yet.</p>}
          </WorkspaceCard>
        </aside>

        <main className="grid gap-4">
          <WorkspaceCard title="Timeline">
            <div className="grid gap-2">
              {timeline.map((event) => <TimelineRow key={`${event.type}-${event.created_at}-${event.label}`} event={event} />)}
            </div>
          </WorkspaceCard>
          <WorkspaceCard title="Notes">
            <textarea className="min-h-36 w-full rounded-lg border border-brand-100 bg-white p-3 text-sm leading-6 text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} placeholder="Interview feedback, recruiter comments, salary discussion, follow-up reminders..." />
            <Button className="mt-3 min-h-8 px-3 text-xs" onClick={saveNotes}>Save notes</Button>
          </WorkspaceCard>
          <WorkspaceCard title="Tasks">
            <TaskList tasks={tasks} setTasks={setTasks} onAdd={addTask} />
          </WorkspaceCard>
        </main>

        <aside className="grid gap-4">
          <WorkspaceCard title="Materials">
            <MaterialAction title="Resume" item={latestResume} icon={FileText} />
            <MaterialAction title="Cover Letter" item={coverLetter} icon={FileText} />
            <MaterialAction title="Recruiter Message" item={recruiterMessage} icon={Mail} />
          </WorkspaceCard>
          {["Interview", "Final Interview"].includes(getPipelineStage(job.status)) && (
            <WorkspaceCard title="Interview Prep">
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">{"\u2713"} Interview Prep Available</p>
              <SummaryLine label="Readiness Score" value={prepScore ? `${prepScore}%` : "Not generated"} />
              <SummaryLine label="Risk Mitigation" value={prep?.content ? "Active" : "Pending"} />
              <SummaryLine label="Questions Practiced" value={`${prep?.practiced_questions?.length || 0}`} />
              <SummaryLine label="Story Readiness" value={prep?.content?.starStories?.length ? "Interview Ready" : "Needs stories"} />
              <Button className="mt-3 min-h-8 px-3 text-xs" onClick={() => navigate("/app/applications", { state: { openJobId: job.id, openJobTab: "interview" } })}>Launch Interview Prep</Button>
            </WorkspaceCard>
          )}
          <WorkspaceCard title="Application Intelligence">
            <SummaryLine label="Fit" value={intelligence.fit} />
            <SummaryLine label="Recruiter confidence" value={intelligence.confidence} />
            <SummaryLine label="Primary risk" value={intelligence.risk} />
            <SummaryLine label="Recommended action" value={intelligence.action} />
          </WorkspaceCard>
        </aside>
      </div>
    </div>
  );
}

function WorkspaceCard({ title, children }) {
  return (
    <section className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100">
      <h3 className="text-sm font-black uppercase tracking-[0.1em] text-brand-700">{title}</h3>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}

function SummaryLine({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right font-bold text-slate-800">{value || "Not set"}</span>
    </div>
  );
}

function TimelineRow({ event }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 rounded-lg bg-brand-50/70 px-3 py-2">
      <p className="text-xs font-bold text-slate-500">{formatShortDate(event.created_at)}</p>
      <div>
        <p className="text-sm font-bold text-ink">{formatTimelineLabel(event.label)}</p>
        <p className="text-xs font-semibold text-slate-500">{event.type}</p>
      </div>
    </div>
  );
}

function MaterialAction({ title, item, icon: Icon }) {
  const toast = useToast();
  async function copy() {
    if (!item?.content) return;
    await navigator.clipboard.writeText(item.content);
    toast.success(`${title} copied.`);
  }
  return (
    <div className="rounded-lg bg-brand-50 p-3">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-brand-700" />
        <p className="font-bold text-ink">{title}</p>
      </div>
      <p className="mt-1 text-xs font-semibold text-slate-500">{item ? "Ready" : "Not generated"}</p>
      {item && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="text-xs font-bold text-brand-700" onClick={copy}><Copy size={12} className="mr-1 inline" /> Copy</button>
        </div>
      )}
    </div>
  );
}

function TaskList({ tasks, setTasks, onAdd }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {tasks.map((task) => (
          <label key={task.id} className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={task.done} onChange={(event) => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: event.target.checked } : item))} />
            <span className={task.done ? "line-through opacity-60" : ""}>{task.label}</span>
          </label>
        ))}
        {!tasks.length && <p className="text-sm text-slate-600">No tasks yet.</p>}
      </div>
      <div className="flex gap-2">
        <input className="min-w-0 flex-1 rounded-lg border border-brand-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a task..." />
        <Button className="min-h-9 px-3 text-xs" onClick={() => { onAdd(draft); setDraft(""); }}>Add</Button>
      </div>
    </div>
  );
}

function loadApplicationTasks(jobId) {
  try {
    return JSON.parse(window.localStorage.getItem(`occuboard-application-tasks-${jobId}`) || "[]");
  } catch {
    return [];
  }
}

function saveApplicationTasks(jobId, tasks) {
  window.localStorage.setItem(`occuboard-application-tasks-${jobId}`, JSON.stringify(tasks));
}

function getApplicationIntelligence(job, { score, messages, prep, timeline }) {
  const next = getNextBestAction(job, { score, messages, activityEvents: timeline });
  const risk = score?.gaps?.[0] || score?.gapAssessments?.[0]?.gap || "No major risk identified";
  return {
    fit: score ? `${Math.round(Number(score.score))}% fit` : "Analysis pending",
    confidence: score && Number(score.score) >= 85 ? "High" : score ? "Moderate" : "Pending",
    risk,
    action: prep?.content ? "Keep interview prep fresh" : next?.label || "Review next step",
  };
}

function formatTimelineLabel(label = "") {
  return String(label).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStageColumnTone(stage) {
  return {
    Saved: "bg-[rgba(127,215,231,0.12)]",
    Applied: "bg-[rgba(15,94,168,0.10)]",
    "Recruiter Screen": "bg-[rgba(99,102,241,0.10)]",
    Interview: "bg-[rgba(52,211,153,0.10)]",
    "Final Interview": "bg-[rgba(20,184,166,0.12)]",
    Offer: "bg-[rgba(16,185,129,0.16)]",
    Rejected: "bg-[rgba(96,125,156,0.12)]",
  }[stage] ?? "bg-stone-50";
}

function getPipelineStage(status) {
  const normalized = normalizeStage(status);
  if (normalized === "Closed") return "Rejected";
  if (normalized === "Offer") return "Offer";
  if (normalized === "Final Interview") return "Final Interview";
  if (normalized === "Recruiter Screen") return "Recruiter Screen";
  if (normalized === "Interview") return "Interview";
  if (normalized === "Applied") return "Applied";
  return "Saved";
}

function ApplicationCard({ job, score, status, messages, contacts = [], timeline = [], prep, onOpen, onDragStart, onRestore, onDelete, compact = false }) {
  const nextBestAction = getNextBestAction(job, { score, aiStatus: status, messages });
  const hasCoverLetter = messages.some((message) => message.job_id === job.id && isCoverLetter(message));
  const archived = isArchivedJob(job);
  const stage = getPipelineStage(job.status);
  const health = getApplicationHealth(job, timeline);
  const reminder = getApplicationReminder(job, contacts, timeline);
  const lastContact = getLastContactDate(contacts);
  const interviewPrepScore = prep?.content ? getApplicationInterviewPrepScore(prep) : null;
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!archived}
      onDragStart={onDragStart}
      onClick={onOpen}
      aria-label={`Open ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group cursor-pointer rounded-xl bg-white/95 px-2.5 py-2 text-left shadow-sm ring-1 ring-white/70 transition-[transform,box-shadow,border-color,background-color] duration-[160ms] ease-out hover:-translate-y-0.5 hover:ring-brand-100 hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 sm:px-3"
    >
      <div className={`flex gap-2 ${compact ? "flex-col sm:flex-row sm:items-center sm:justify-between" : "flex-col"}`}>
        <div className="min-w-0">
          <div className="flex items-start gap-2.5">
            <CompanyLogo companyName={getDisplayCompanyName(job)} companyDomain={job.company_domain} companyLogoUrl={job.company_logo_url} sourceUrl={job.source_url} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <FitScoreBadge score={score} compact />
                <p className="min-w-0 flex-1 overflow-hidden text-base font-bold leading-snug text-ink" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{getDisplayJobTitle(job)}</p>
              </div>
              <p className="mt-1 text-sm font-medium leading-5 text-slate-600">{getDisplayCompanyName(job)} <span className="text-slate-300">/</span> {stage}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {contacts.length > 0 && <p className="text-xs font-bold text-brand-700">{contacts.length} contact{contacts.length === 1 ? "" : "s"}</p>}
                {hasCoverLetter && <p className="text-xs font-bold text-cyan-700">Cover letter</p>}
              </div>
            </div>
            <ChevronRight className="mt-1 shrink-0 text-slate-300 opacity-0 transition duration-[160ms] ease-out group-hover:translate-x-0.5 group-hover:opacity-100" size={15} />
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StatusPill tone={health.tone}>{health.label}</StatusPill>
        {reminder && <StatusPill tone="warning">{reminder}</StatusPill>}
      </div>
      <div className="mt-2 grid gap-1 text-xs font-semibold text-slate-500">
        {job.applied_date && <p>Applied {formatShortDate(job.applied_date)}</p>}
        {lastContact && <p>Last contact {formatShortDate(lastContact)}</p>}
      </div>
      {["Interview", "Final Interview"].includes(stage) && (
        <div className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-800 ring-1 ring-emerald-100">
          {"\u2713"} Interview Prep Available{interviewPrepScore ? `: ${interviewPrepScore}%` : ""}
        </div>
      )}
      <KanbanAiStatus status={status} />
      <FollowUpChip job={job} />
      {!archived && nextBestAction?.actionType !== "no_action" && (
        <p className={`mt-2 truncate text-xs font-semibold ${getActionLineTone(nextBestAction.tone)}`}>{nextBestAction.label}</p>
      )}
      {archived && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {onRestore && <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={(event) => { event.stopPropagation(); onRestore(); }}>Restore</Button>}
          {onDelete && <Button variant="danger" className="min-h-8 px-3 text-xs" onClick={(event) => { event.stopPropagation(); onDelete(); }}>Delete</Button>}
        </div>
      )}
    </div>
  );
}

function getActionLineTone(tone) {
  return {
    danger: "text-rose-700",
    warning: "text-amber-700",
    success: "text-emerald-700",
    info: "text-brand-700",
    neutral: "text-slate-500",
  }[tone] ?? "text-slate-500";
}

function StatusPill({ tone = "neutral", children }) {
  const styles = {
    healthy: "bg-emerald-50 text-emerald-800 ring-emerald-100",
    waiting: "bg-amber-50 text-amber-800 ring-amber-100",
    danger: "bg-rose-50 text-rose-700 ring-rose-100",
    warning: "bg-amber-50 text-amber-800 ring-amber-100",
    neutral: "bg-slate-50 text-slate-600 ring-slate-100",
  }[tone] ?? "bg-slate-50 text-slate-600 ring-slate-100";
  return <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${styles}`}>{children}</span>;
}

function getApplicationMetrics(activeJobs, jobScores, contacts) {
  const activeApplications = activeJobs.filter((job) => getPipelineStage(job.status) !== "Saved").length;
  const interviewsScheduled = activeJobs.filter((job) => ["Interview", "Final Interview"].includes(getPipelineStage(job.status)) || job.interview_date).length;
  const appliedOrBeyond = activeJobs.filter((job) => isAppliedPipelineStage(getPipelineStage(job.status)));
  const responded = appliedOrBeyond.filter((job) => contacts.some((contact) => contact.job_id === job.id && contact.last_contacted_at) || ["Recruiter Screen", "Interview", "Final Interview", "Offer"].includes(getPipelineStage(job.status))).length;
  const scored = activeJobs.map((job) => getLatestFitScore(jobScores, job.id)?.score).filter((value) => Number.isFinite(Number(value)));
  return {
    activeApplications,
    interviewsScheduled,
    responseRate: appliedOrBeyond.length ? Math.round((responded / appliedOrBeyond.length) * 100) : 0,
    averageFitScore: scored.length ? Math.round(scored.reduce((sum, value) => sum + Number(value), 0) / scored.length) : 0,
    followUpsNeeded: activeJobs.filter((job) => getApplicationHealth(job, getApplicationTimeline(job, {})).tone === "danger").length,
    applicationsThisMonth: activeJobs.filter((job) => isThisMonth(job.applied_date)).length,
  };
}

function isAppliedPipelineStage(stage) {
  return ["Applied", "Recruiter Screen", "Interview", "Final Interview", "Offer", "Rejected"].includes(stage);
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

function PipelineSkeleton() {
  return (
    <div className="kanban-scroll grid snap-x grid-flow-col gap-2.5 overflow-x-auto pb-3 sm:gap-3">
      {stages.map((stage) => (
        <div key={stage} className={`min-h-[210px] w-[min(296px,calc(100vw-2rem))] snap-start rounded-xl p-2 shadow-sm ring-1 ring-white/70 sm:p-2.5 ${getStageColumnTone(stage)}`}>
          <div className="mb-2.5 flex items-center justify-between">
            <div className="h-4 w-20 rounded-full bg-white/80" />
            <div className="h-4 w-6 rounded-full bg-white/80" />
          </div>
          <div className="grid gap-2.5">
            {[0, 1].map((item) => <div key={item} className="h-24 rounded-xl bg-white/75 shadow-sm" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function getNextAction(job, status) {
  return getNextBestAction(job, { aiStatus: status }).label;
}

function FollowUpChip({ job }) {
  const status = getFollowUpStatus(job);
  const label = getFollowUpLabel(job);
  if (!label) return null;

  return (
    <span className={`mt-2 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${getFollowUpTone(status)}`}>
      {label}
    </span>
  );
}

function KanbanAiStatus({ status }) {
  const ready = [
    status.analyzed && "Analysis",
    status.resumeDrafted && "Resume",
    status.messageDrafted && "Message",
  ].filter(Boolean);

  if (!ready.length) return null;

  return (
    <div className="mt-2 flex flex-nowrap items-center gap-3 overflow-hidden whitespace-nowrap">
      {ready.map((item) => (
        <span key={item} aria-label={`${item} complete`} className="shrink-0 text-xs font-bold text-emerald-700">
          <span aria-hidden="true">{"\u2713"}</span> {item}
        </span>
      ))}
    </div>
  );
}

