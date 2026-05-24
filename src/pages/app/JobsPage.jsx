import { CheckCircle2, Edit3, ExternalLink, MapPin, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiToolsPanel, GenerationHistory } from "../../components/ai/AiToolsPanel.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { FitScoreBadge, getLatestFitScore } from "../../components/ui/FitScoreBadge.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { priorities, remoteTypes, stages } from "../../data/seedData.js";
import { formatDate, isOverdue, todayIso } from "../../lib/date.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "../../lib/jobDisplay.js";
import { getJobAiStatus } from "../../lib/jobAiStatus.js";
import { getResumeExportHistory } from "../../lib/resumeExport.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";

const emptyJob = {
  company_name: "",
  job_title: "",
  location: "",
  remote_type: "Remote",
  salary_range: "",
  source_url: "",
  job_description: "",
  priority: "Medium",
  status: "Saved",
  date_saved: todayIso(),
  applied_date: "",
  followup_date: "",
  notes: "",
};

export function JobsPage() {
  const { user } = useAuth();
  const { jobs, jobScores, resumeVersions, messages, createJob, updateJob, deleteJob } = useWorkspaceStore();
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [remoteFilter, setRemoteFilter] = useState("All");
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyJob);
  const [highlightedId, setHighlightedId] = useState("");
  const [savedJob, setSavedJob] = useState(null);
  const listTopRef = useRef(null);
  const jobCardRefs = useRef({});

  const filteredJobs = useMemo(() => {
    const value = query.toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch = `${job.company_name} ${job.job_title} ${job.location} ${job.status}`.toLowerCase().includes(value);
      return (
        matchesSearch &&
        (stageFilter === "All" || getDisplayStage(job.status) === stageFilter) &&
        (priorityFilter === "All" || job.priority === priorityFilter) &&
        (remoteFilter === "All" || job.remote_type === remoteFilter)
      );
    });
  }, [jobs, priorityFilter, query, remoteFilter, stageFilter]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "job_description" && !current.salary_range?.trim()) {
        const parsedSalary = detectSalaryRange(value);
        if (parsedSalary) next.salary_range = parsedSalary;
      }
      return next;
    });
  };

  async function saveJob(event) {
    event.preventDefault();
    try {
      let saved;
      if (editingId) {
        saved = await updateJob(user, editingId, form);
      } else {
        saved = await createJob(user, form);
      }
      setEditingId(null);
      setForm(emptyJob);
      setSavedJob(saved ?? null);
      if (saved?.id) {
        setHighlightedId(saved.id);
        window.setTimeout(() => {
          jobCardRefs.current[saved.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
          jobCardRefs.current[saved.id]?.focus?.({ preventScroll: true });
        }, 80);
        window.setTimeout(() => setHighlightedId(""), 2400);
      }
      listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setSavedJob({ error: error.message || "Could not save this job. Please try again." });
    }
  }

  function editJob(job) {
    setEditingId(job.id);
    setSelected(null);
    setForm({ ...emptyJob, ...job, status: getDisplayStage(job.status), followup_date: job.followup_date ?? "", applied_date: job.applied_date ?? "" });
  }

  async function moveToApplied(job) {
    await updateJob(user, job.id, { status: "Applied", applied_date: job.applied_date || todayIso() });
    setSelected(null);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)] 2xl:grid-cols-[520px_minmax(0,1fr)]">
      <Card className="self-start bg-brand-50/45">
        <div className="border-b border-brand-100 pb-4">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Plus size={20} /> {editingId ? "Edit job" : "Add job"}</h2>
          <p className="mt-1 text-sm text-slate-600">Capture the role details first. OccuBoard will guide you to analysis next.</p>
        </div>
        <form className="mt-5 grid gap-4" onSubmit={saveJob}>
          <Field id="company_name" label="Company name" name="company_name" value={form.company_name} onChange={update} required />
          <Field id="job_title" label="Job title" name="job_title" value={form.job_title} onChange={update} required />
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Field id="location" label="Location" name="location" value={form.location ?? ""} onChange={update} />
            <Select label="Remote type" name="remote_type" value={form.remote_type} options={remoteTypes} onChange={update} />
            <Field id="salary_range" label="Salary range" name="salary_range" value={form.salary_range ?? ""} onChange={update} />
            <Select label="Priority" name="priority" value={form.priority} options={priorities} onChange={update} />
            <Select label="Stage" name="status" value={form.status} options={stages} onChange={update} />
            <Field id="date_saved" label="Date saved" name="date_saved" type="date" value={form.date_saved ?? ""} onChange={update} />
            <Field id="followup_date" label="Follow-up date" name="followup_date" type="date" value={form.followup_date ?? ""} onChange={update} />
          </div>
          <Field id="source_url" label="Source URL" name="source_url" value={form.source_url ?? ""} onChange={update} />
          <Field id="job_description" label="Job description" as="textarea" name="job_description" rows="5" value={form.job_description ?? ""} onChange={update} />
          <Field id="notes" label="Notes" as="textarea" name="notes" rows="3" value={form.notes ?? ""} onChange={update} />
          <div className="flex gap-3">
            <Button type="submit">{editingId ? "Save changes" : "Add Job"}</Button>
            {editingId && <Button variant="secondary" onClick={() => { setEditingId(null); setForm(emptyJob); }}>Cancel</Button>}
          </div>
        </form>
      </Card>

      <section className="min-w-0">
        <div ref={listTopRef} />
        {savedJob && (
          <div className={`mb-4 rounded-lg border p-4 text-sm shadow-card ${savedJob.error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold">{savedJob.error ? "Job was not saved." : "Job saved."}</p>
                <p className="mt-1">{savedJob.error || "Open job details to generate AI insights and decide the next step."}</p>
              </div>
              {!savedJob.error && <Button className="w-fit" onClick={() => setSelected({ ...savedJob, initialTab: "fit" })}>Analyze this job</Button>}
            </div>
          </div>
        )}
        <div className="mb-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-[1fr_repeat(3,160px)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="w-full rounded-lg border border-brand-200 bg-white py-2 pl-10 pr-3 text-sm outline-none hover:border-brand-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              placeholder="Search jobs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Filter value={stageFilter} onChange={setStageFilter} options={["All", ...stages]} />
          <Filter value={priorityFilter} onChange={setPriorityFilter} options={["All", ...priorities]} />
          <Filter value={remoteFilter} onChange={setRemoteFilter} options={["All", ...remoteTypes]} />
        </div>

        <div className="grid gap-4">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              ref={(element) => {
                if (element) jobCardRefs.current[job.id] = element;
              }}
              className={`cursor-pointer rounded-lg text-left transition ${highlightedId === job.id ? "ring-4 ring-emerald-200" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(job)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelected(job);
                }
              }}
            >
              <Card className="transition hover:border-brand-200 hover:shadow-soft">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-bold">{getDisplayJobTitle(job)}</h3>
                      <FitScoreBadge score={getLatestFitScore(jobScores, job.id)} compact />
                      <Badge>{getDisplayStage(job.status)}</Badge>
                      {highlightedId === job.id && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">New</span>}
                      <PriorityBadge priority={job.priority} />
                    </div>
                    <p className="mt-1 font-semibold text-brand-800">{getDisplayCompanyName(job)}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <MapPin size={15} /> {job.location || "Location not listed"} | {job.remote_type} | {job.salary_range || "Salary not listed"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <span>Saved {formatDate(job.date_saved)}</span>
                      {job.followup_date && <FollowUpBadge date={job.followup_date} />}
                    </div>
                    <AiStatusRow status={getJobAiStatus(job.id, jobScores, resumeVersions, messages)} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="px-3" onClick={(event) => { event.stopPropagation(); editJob(job); }}><Edit3 size={16} /></Button>
                    <Button variant="danger" className="px-3" onClick={(event) => { event.stopPropagation(); deleteJob(user, job.id); }}><Trash2 size={16} /></Button>
                  </div>
                </div>
              </Card>
            </div>
          ))}
          {!filteredJobs.length && <Card>{jobs.length ? "No jobs match these filters." : "Save your first opportunity to begin organizing your search."}</Card>}
        </div>
      </section>

      {selected && (
        <JobDetail
          job={selected}
          initialTab={selected.initialTab}
          onClose={() => setSelected(null)}
          onEdit={() => editJob(selected)}
          onDelete={async () => { await deleteJob(user, selected.id); setSelected(null); }}
          onMove={() => moveToApplied(selected)}
        />
      )}
    </div>
  );
}

function Select({ label, name, value, options, onChange }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
      {label}
      <select name={name} value={value ?? ""} onChange={onChange} className="min-w-0 rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Filter({ value, options, onChange }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

export function PriorityBadge({ priority }) {
  if (priority !== "High") return null;
  return <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">{priority}</span>;
}

function getDisplayStage(status) {
  if (status === "Tailoring") return "Saved";
  if (["Offer", "Rejected", "Closed"].includes(status)) return "Closed";
  return status || "Saved";
}

export function JobDetail({ job, initialTab = "overview", onClose, onEdit, onDelete, onMove }) {
  const { jobScores, resumeVersions, messages } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState(initialTab || "overview");
  const fitSectionRef = useRef(null);
  const [exportedResumeIds, setExportedResumeIds] = useState(() => new Set(getResumeExportHistory().map((item) => item.resumeId).filter(Boolean)));
  const [showDescription, setShowDescription] = useState(!(jobScores.some((score) => score.job_id === job.id) || resumeVersions.some((version) => version.job_id === job.id) || messages.some((message) => message.job_id === job.id)));
  const latestScore = [...jobScores].filter((score) => score.job_id === job.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const latestResume = [...resumeVersions].filter((version) => version.job_id === job.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const latestMessage = [...messages].filter((message) => message.job_id === job.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const jobScoreHistory = jobScores.filter((score) => score.job_id === job.id);
  const resumeHistory = resumeVersions.filter((version) => version.job_id === job.id);
  const messageHistory = messages.filter((message) => message.job_id === job.id);
  const descriptionPreview = getDescriptionPreview(job.job_description);
  const completedSteps = {
    fit: Boolean(latestScore),
    resume: Boolean(latestResume),
    message: Boolean(latestMessage),
    export: Boolean(latestResume?.id && exportedResumeIds.has(latestResume.id)),
  };

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (activeTab === "fit" && latestScore) {
      window.setTimeout(() => fitSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }
  }, [activeTab, latestScore]);

  return (
    <div className="fixed inset-0 z-50 bg-ink/35 p-0 sm:p-4" onMouseDown={onClose}>
      <section className="mx-auto flex h-[100dvh] max-w-[1200px] flex-col overflow-hidden bg-white shadow-soft sm:h-[calc(100dvh-2rem)] sm:rounded-lg" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sticky top-0 z-20 border-b border-brand-100 bg-white/95 shadow-sm backdrop-blur">
          <div className="px-4 py-3 sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{getDisplayStage(job.status)}</Badge>
                  <PriorityBadge priority={job.priority} />
                  <FitScoreBadge score={latestScore} />
                </div>
                <h2 className="mt-2 text-lg font-bold text-ink sm:text-xl">{getDisplayJobTitle(job)}</h2>
                <p className="mt-0.5 text-sm font-semibold text-brand-800">{getDisplayCompanyName(job)}</p>
              </div>
              <button type="button" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-brand-50" onClick={onClose} aria-label="Close job details">
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="border-t border-brand-100 px-4 py-2 sm:px-5">
            <AiToolsPanel compact job={job} activeTab={activeTab === "overview" ? "fit" : activeTab === "export" ? "resume" : activeTab} onTabChange={setActiveTab} />
          </div>
          <WorkflowSteps activeTab={activeTab} completed={completedSteps} score={latestScore} onSelect={setActiveTab} />
          <nav className="flex gap-2 overflow-x-auto border-t border-brand-100 bg-white/70 px-4 py-2 sm:px-5">
            <button
              type="button"
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activeTab === "overview" ? "bg-brand-100 text-brand-900" : "text-slate-500 hover:bg-brand-50 hover:text-brand-800"}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
          {activeTab === "overview" && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="grid gap-5">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Location" value={`${job.location || "Not listed"} | ${job.remote_type || "Not set"}`} />
                  <Detail label="Salary" value={job.salary_range || "Not listed"} />
                  <Detail label="Date saved" value={formatDate(job.date_saved)} />
                  <Detail label="Follow-up" value={formatDate(job.followup_date)} />
                </dl>

                {job.source_url && (
                  <a className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900" href={job.source_url} target="_blank" rel="noreferrer">
                    Open source link <ExternalLink size={15} />
                  </a>
                )}

                <section>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold">Job description</h3>
                    <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => setShowDescription((value) => !value)}>
                      {showDescription ? "Hide description" : "Show full job description"}
                    </Button>
                  </div>
                  <div className="relative mt-2 overflow-hidden rounded-lg bg-brand-50">
                    {showDescription ? (
                      <p className="max-h-[460px] overflow-y-auto whitespace-pre-wrap p-4 text-sm leading-6 text-slate-700">{job.job_description || "No description saved."}</p>
                    ) : (
                      <>
                        <p className="max-h-36 overflow-hidden whitespace-pre-wrap p-4 text-sm leading-6 text-slate-700">{descriptionPreview || "No description saved."}</p>
                        {job.job_description && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-brand-50 to-brand-50/0" />}
                      </>
                    )}
                  </div>
                </section>
              </div>

              <section>
                <h3 className="font-bold">Notes</h3>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-brand-50 p-4 text-sm leading-6 text-slate-700">{job.notes || "No notes yet."}</p>
                <div className="sticky bottom-0 -mx-1 mt-6 flex flex-wrap gap-3 border-t border-brand-100 bg-white/95 px-1 py-4 backdrop-blur">
                  <Button onClick={onMove}>Move to Applied</Button>
                  <Button variant="secondary" onClick={onEdit}><Edit3 size={16} /> Edit</Button>
                  <Button variant="danger" onClick={onDelete}><Trash2 size={16} /> Delete</Button>
                </div>
              </section>
            </div>
          )}

          {activeTab === "fit" && (
            <div ref={fitSectionRef} className="mx-auto max-w-5xl scroll-mt-44">
              <AiToolsPanel contentOnly job={job} activeTab="fit" onTabChange={setActiveTab} />
            </div>
          )}
          {(activeTab === "resume" || activeTab === "export") && (
            <div className="mx-auto max-w-5xl">
              <AiToolsPanel
                contentOnly
                job={job}
                activeTab="resume"
                onTabChange={setActiveTab}
                onExportComplete={(resume) => {
                  if (resume?.id) setExportedResumeIds((current) => new Set([...current, resume.id]));
                }}
              />
            </div>
          )}
          {activeTab === "message" && (
            <div className="mx-auto max-w-4xl">
              <AiToolsPanel contentOnly job={job} activeTab="message" onTabChange={setActiveTab} />
            </div>
          )}
          {activeTab !== "overview" && (
            <div className="mx-auto max-w-5xl">
              <GenerationHistory scores={jobScoreHistory} resumes={resumeHistory} messages={messageHistory} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function WorkflowSteps({ activeTab, completed, score, onSelect }) {
  const steps = [
    ["fit", "Analysis"],
    ["resume", "Resume"],
    ["message", "Message"],
    ["export", "Export"],
  ];
  const current = activeTab;
  return (
    <div className="border-t border-brand-100 bg-white/90 px-4 py-3 sm:px-5">
      <div className="grid gap-2 sm:grid-cols-4">
        {steps.map(([id, label], index) => {
          const selected = current === id;
          const done = completed[id];
          const completion = getStepCompletionLabel(id, score, done);
          const completionTone = id === "fit" && score ? getStepScoreTone(score.score) : "bg-emerald-100 text-emerald-800";
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold transition ${
                selected ? "bg-brand-700 text-white shadow-card" : done ? "bg-emerald-50 text-emerald-800" : "bg-brand-50 text-slate-600 hover:bg-brand-100"
              }`}
            >
              <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] ${selected ? "bg-white/20 text-white" : done ? completionTone : "bg-white text-slate-600"}`}>
                {completion || index + 1}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getStepCompletionLabel(id, score, done) {
  if (!done) return "";
  if (id === "fit" && Number.isFinite(Number(score?.score))) return `${Math.round(Number(score.score))}%`;
  return "Ready";
}

function getStepScoreTone(score) {
  const value = Number(score);
  if (value >= 75) return "bg-emerald-100 text-emerald-800";
  if (value >= 45) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-700";
}

function getDescriptionPreview(description = "") {
  const trimmed = description.trim();
  if (trimmed.length <= 520) return trimmed;
  return `${trimmed.slice(0, 520).trim()}...`;
}

function detectSalaryRange(text = "") {
  const patterns = [
    /\$\s?\d{2,3}(?:,\d{3})?\s?(?:-|to)\s?\$?\s?\d{2,3}(?:,\d{3})?\s?(?:\/?\s?(?:year|yr|annually|hour|hr))?/i,
    /\$\s?\d{2,3}(?:,\d{3})?\s?(?:k|K)\s?(?:-|to)\s?\$?\s?\d{2,3}(?:k|K)\s?(?:\/?\s?(?:year|yr|annually))?/i,
    /\b\d{2,3}\s?(?:k|K)\s?(?:-|to)\s?\d{2,3}\s?(?:k|K)\b/i,
    /\$\s?\d{2,3}(?:,\d{3})?\s?(?:per hour|\/hr|hourly)/i,
  ];
  const match = patterns.map((pattern) => text.match(pattern)?.[0]).find(Boolean);
  return match?.replace(/\s+/g, " ").trim() ?? "";
}

function AiStatusRow({ status }) {
  const items = [
    ["Analyzed", status.analyzed],
    ["Resume Ready", status.resumeDrafted],
    ["Message Ready", status.messageDrafted],
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map(([label, done]) => (
        <span key={label} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${done ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-500"}`}>
          <CheckCircle2 size={13} /> {label}
        </span>
      ))}
    </div>
  );
}

function FollowUpBadge({ date }) {
  const overdue = isOverdue(date);
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${overdue ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
      {overdue ? "Overdue" : "Follow-up"} {formatDate(date)}
    </span>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-lg bg-brand-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-500">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
