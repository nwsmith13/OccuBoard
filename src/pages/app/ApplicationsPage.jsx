import { CheckCircle2, Rows3, SquareKanban } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button.jsx";
import { CompanyLogo } from "../../components/ui/CompanyLogo.jsx";
import { FitScoreBadge, getLatestFitScore } from "../../components/ui/FitScoreBadge.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { stages } from "../../data/seedData.js";
import { todayIso } from "../../lib/date.js";
import { getFollowUpLabel, getFollowUpStatus, getFollowUpTone, normalizeStage } from "../../lib/followUp.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "../../lib/jobDisplay.js";
import { getJobAiStatus } from "../../lib/jobAiStatus.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { getNextBestAction } from "../../utils/nextBestAction.js";
import { JobDetail } from "./JobsPage.jsx";

export function ApplicationsPage() {
  const { user } = useAuth();
  const { jobs, jobScores, resumeVersions, messages, jobContacts, loading, error, updateJob, deleteJob } = useWorkspaceStore();
  const [draggingId, setDraggingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState("cards");
  const [success, setSuccess] = useState("");

  const grouped = useMemo(
    () => Object.fromEntries(stages.map((stage) => [stage, jobs.filter((item) => getPipelineStage(item.status) === stage)])),
    [jobs],
  );

  async function moveApplication(stage) {
    if (!draggingId) return;
    const dragged = jobs.find((job) => job.id === draggingId);
    await updateJob(user, draggingId, {
      status: stage,
      applied_date: stage === "Applied" ? dragged?.applied_date || todayIso() : dragged?.applied_date || null,
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

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Opportunity Pipeline</h2>
          <p className="mt-1 text-sm text-slate-600">A calmer view of where each opportunity stands.</p>
        </div>
        <div className="flex w-fit rounded-lg bg-slate-100 p-1">
          <button type="button" className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold ${viewMode === "cards" ? "bg-white text-brand-900 shadow-sm" : "text-slate-600"}`} onClick={() => setViewMode("cards")}>
            <SquareKanban size={14} /> Cards
          </button>
          <button type="button" className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold ${viewMode === "list" ? "bg-white text-brand-900 shadow-sm" : "text-slate-600"}`} onClick={() => setViewMode("list")}>
            <Rows3 size={14} /> List
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-5 flex items-center gap-3 rounded-lg bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 shadow-sm">
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      {error && <div className="mb-5 rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      {loading ? (
        <PipelineSkeleton />
      ) : !jobs.length ? (
        <div className="rounded-xl bg-stone-50 p-8 text-center shadow-card">
          <h3 className="text-xl font-bold text-ink">No applications yet.</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Analyze a new job to start building your application history.</p>
          <Link to="/app/new-jobs" className="mt-5 inline-flex">
            <Button>Analyze New Job</Button>
          </Link>
        </div>
      ) : viewMode === "cards" ? (
          <div className="kanban-scroll grid snap-x grid-flow-col gap-4 overflow-x-auto pb-3 sm:gap-6">
            {stages.map((stage) => (
              <div
                key={stage}
              className={`min-h-[260px] w-[min(315px,calc(100vw-2rem))] snap-start rounded-xl p-3 shadow-sm ring-1 ring-white/70 sm:p-4 ${getStageColumnTone(stage)}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveApplication(stage)}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">{stage}</h3>
                <span className="text-xs font-semibold text-slate-400">{grouped[stage].length}</span>
              </div>
              <div className="grid gap-4">
                {grouped[stage].map((job) => (
                  <ApplicationCard key={job.id} job={job} score={getLatestFitScore(jobScores, job.id)} status={getJobAiStatus(job.id, jobScores, resumeVersions, messages)} messages={messages} contacts={jobContacts.filter((contact) => contact.job_id === job.id)} onOpen={() => setSelected(job)} onDragStart={() => setDraggingId(job.id)} />
                ))}
                {!grouped[stage].length && <p className="rounded-lg bg-white/50 px-4 py-3 text-sm text-slate-500">Nothing here yet.</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <ApplicationCard key={job.id} job={job} score={getLatestFitScore(jobScores, job.id)} status={getJobAiStatus(job.id, jobScores, resumeVersions, messages)} messages={messages} contacts={jobContacts.filter((contact) => contact.job_id === job.id)} onOpen={() => setSelected(job)} compact onDragStart={() => setDraggingId(job.id)} />
          ))}
        </div>
      )}

      {selected && (
        <JobDetail
          job={selected}
          onClose={() => setSelected(null)}
          onEdit={() => setSelected(null)}
          onDelete={async () => { await deleteJob(user, selected.id); setSelected(null); }}
          onMove={() => moveToApplied(selected)}
          onJobUpdate={(updated) => setSelected(updated)}
        />
      )}
    </div>
  );
}

function getStageColumnTone(stage) {
  return {
    Saved: "bg-[rgba(127,215,231,0.12)]",
    Applied: "bg-[rgba(15,94,168,0.10)]",
    Interview: "bg-[rgba(52,211,153,0.10)]",
    Closed: "bg-[rgba(96,125,156,0.12)]",
  }[stage] ?? "bg-stone-50";
}

function getPipelineStage(status) {
  return normalizeStage(status);
}

function ApplicationCard({ job, score, status, messages, contacts = [], onOpen, onDragStart, compact = false }) {
  const nextBestAction = getNextBestAction(job, { score, aiStatus: status, messages });
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      aria-label={`Open ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="rounded-xl bg-white/95 px-3.5 py-3 text-left shadow-sm ring-1 ring-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 sm:px-4"
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
              <p className="mt-1 text-sm font-medium text-slate-500">{getDisplayCompanyName(job)} <span className="text-slate-300">/</span> {getPipelineStage(job.status)}</p>
              {contacts.length > 0 && <p className="mt-1 text-[11px] font-bold text-brand-700">{contacts.length} contact{contacts.length === 1 ? "" : "s"}</p>}
            </div>
          </div>
        </div>
      </div>
      <KanbanAiStatus status={status} />
      <FollowUpChip job={job} />
      {nextBestAction?.actionType !== "no_action" && (
        <p className={`mt-2 truncate text-xs font-semibold ${getActionLineTone(nextBestAction.tone)}`}>{nextBestAction.label}</p>
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

function PipelineSkeleton() {
  return (
    <div className="kanban-scroll grid snap-x grid-flow-col gap-4 overflow-x-auto pb-3 sm:gap-6">
      {stages.map((stage) => (
        <div key={stage} className={`min-h-[260px] w-[min(315px,calc(100vw-2rem))] snap-start rounded-xl p-3 shadow-sm ring-1 ring-white/70 sm:p-4 ${getStageColumnTone(stage)}`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="h-4 w-20 rounded-full bg-white/80" />
            <div className="h-4 w-6 rounded-full bg-white/80" />
          </div>
          <div className="grid gap-4">
            {[0, 1].map((item) => <div key={item} className="h-28 rounded-xl bg-white/75 shadow-sm" />)}
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
    <span className={`mt-2 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${getFollowUpTone(status)}`}>
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
        <span key={item} aria-label={`${item} complete`} className="shrink-0 text-[11px] font-bold text-emerald-700">
          <span aria-hidden="true">{"\u2713"}</span> {item}
        </span>
      ))}
    </div>
  );
}
