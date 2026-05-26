import { ArrowRightCircle, Bell, CheckCircle2, Circle, Clock, Download, Edit3, ExternalLink, FileText as FileTextIcon, MapPin, MessageCircle, Plus, Search, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiToolsPanel, CopyButton } from "../../components/ai/AiToolsPanel.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { CompanyLogo } from "../../components/ui/CompanyLogo.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { FitScoreBadge, getLatestFitScore } from "../../components/ui/FitScoreBadge.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { priorities, remoteTypes, stages } from "../../data/seedData.js";
import { formatDate, isOverdue, todayIso } from "../../lib/date.js";
import { addDaysIso, getFollowUpCompletedAt, getFollowUpDate, getFollowUpLabel, getFollowUpNote, getFollowUpSnoozedUntil, getFollowUpStatus, getFollowUpTone } from "../../lib/followUp.js";
import { canRunAi, generateAiOutput } from "../../lib/aiClient.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "../../lib/jobDisplay.js";
import { formatActivityDetails, formatActivityLabel, formatRelativeTime, getActivityColor, getActivityGroup, getActivityIcon } from "../../lib/jobActivity.js";
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
          onJobUpdate={(updated) => setSelected(updated)}
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

export function JobDetail({ job: initialJob, initialTab = "overview", onClose, onEdit, onDelete, onMove, onJobUpdate }) {
  const { user } = useAuth();
  const { profile, jobScores, resumeVersions, messages, jobActivityLogs, updateJob, saveMessage } = useWorkspaceStore();
  const [job, setModalJob] = useState(initialJob);
  const [activeTab, setActiveTab] = useState(initialTab || "overview");
  const fitSectionRef = useRef(null);
  const [exportedResumeIds, setExportedResumeIds] = useState(() => new Set(getResumeExportHistory().map((item) => item.resumeId).filter(Boolean)));
  const [showDescription, setShowDescription] = useState(false);
  const latestScore = [...jobScores].filter((score) => score.job_id === job.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const latestResume = [...resumeVersions].filter((version) => version.job_id === job.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const latestMessage = [...messages].filter((message) => message.job_id === job.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const jobScoreHistory = jobScores.filter((score) => score.job_id === job.id);
  const resumeHistory = resumeVersions.filter((version) => version.job_id === job.id);
  const messageHistory = messages.filter((message) => message.job_id === job.id);
  const descriptionPreview = getDescriptionPreview(job.job_description);
  const timelineEvents = mergeTimelineEvents(
    jobActivityLogs.filter((event) => event.job_id === job.id),
    getDerivedGenerationEvents({ job, scores: jobScoreHistory, resumes: resumeHistory, messages: messageHistory }),
  );
  const completedSteps = {
    fit: Boolean(latestScore),
    resume: Boolean(latestResume),
    message: Boolean(latestMessage),
    export: Boolean(latestResume?.id && exportedResumeIds.has(latestResume.id)),
  };

  useEffect(() => {
    setModalJob(initialJob);
  }, [initialJob]);

  function mergeJobUpdate(updatedJob) {
    const nextJob = { ...job, ...updatedJob };
    setModalJob(nextJob);
    onJobUpdate?.(nextJob);
    return nextJob;
  }

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
              <div className="flex min-w-0 items-start gap-3">
                <CompanyLogo companyName={getDisplayCompanyName(job)} companyDomain={job.company_domain} companyLogoUrl={job.company_logo_url} sourceUrl={job.source_url} size="lg" className="mt-0.5" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{getDisplayStage(job.status)}</Badge>
                    <PriorityBadge priority={job.priority} />
                    <FitScoreBadge score={latestScore} />
                  </div>
                  <h2 className="mt-2 text-lg font-bold text-ink sm:text-xl">{getDisplayJobTitle(job)}</h2>
                  <p className="mt-0.5 text-sm font-semibold text-brand-800">{getDisplayCompanyName(job)}</p>
                </div>
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
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
          {activeTab === "overview" && (
            <div className="grid gap-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="grid gap-5">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Location" value={`${job.location || "Not listed"} | ${job.remote_type || "Not set"}`} />
                  <Detail label="Salary" value={job.salary_range || "Not listed"} />
                  <Detail label="Date saved" value={formatDate(job.date_saved)} />
                  <Detail label="Follow-up" value={formatDate(getFollowUpDate(job))} />
                </dl>

                {job.source_url && (
                  <a className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900" href={job.source_url} target="_blank" rel="noreferrer">
                    Open source link <ExternalLink size={15} />
                  </a>
                )}

                <section>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold">Job description</h3>
                    <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => setShowDescription((value) => !value)} disabled={!job.job_description}>
                      {showDescription ? "Show less" : "See more..."}
                    </Button>
                  </div>
                  <div className="mt-2 overflow-hidden rounded-lg bg-brand-50">
                    {showDescription ? (
                      <p className="max-h-[460px] overflow-y-auto whitespace-pre-wrap p-4 text-sm leading-6 text-slate-700">{job.job_description || "No description saved."}</p>
                    ) : (
                      <p className="whitespace-pre-wrap p-4 text-sm leading-6 text-slate-700">{descriptionPreview || "No description saved."}</p>
                    )}
                  </div>
                </section>
              </div>

              <section>
                <h3 className="font-bold">Notes</h3>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-brand-50 p-4 text-sm leading-6 text-slate-700">{job.notes || "No notes yet."}</p>
                <FollowUpControls job={job} user={user} profile={profile} messages={messages} updateJob={updateJob} saveMessage={saveMessage} onJobUpdate={mergeJobUpdate} />
                <div className="sticky bottom-0 -mx-1 mt-6 flex flex-wrap gap-3 border-t border-brand-100 bg-white/95 px-1 py-4 backdrop-blur">
                  <Button onClick={onMove}>Move to Applied</Button>
                  <Button variant="secondary" onClick={onEdit}><Edit3 size={16} /> Edit</Button>
                  <Button variant="danger" onClick={onDelete}><Trash2 size={16} /> Delete</Button>
                </div>
              </section>
              </div>
              <JobActivityTimeline events={timelineEvents} />
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
            <div className="mx-auto max-w-5xl">
              <AiToolsPanel contentOnly job={job} activeTab="message" onTabChange={setActiveTab} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FollowUpControls({ job, user, profile, messages, updateJob, saveMessage, onJobUpdate }) {
  const [reminder, setReminder] = useState(job);
  const [date, setDate] = useState(getFollowUpDate(reminder));
  const [note, setNote] = useState(getFollowUpNote(reminder));
  const [customSnooze, setCustomSnooze] = useState("");
  const [saving, setSaving] = useState("");
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [message, setMessage] = useState("");
  const latestFollowUpMessage = [...messages]
    .filter((item) => item.job_id === job.id && item.type === "Follow-up Message")
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const draftReminder = { ...reminder, followup_date: date, followup_note: note };
  const status = getFollowUpStatus(draftReminder);
  const label = getFollowUpLabel(draftReminder);
  const completedAt = getFollowUpCompletedAt(reminder);
  const snoozedUntil = getFollowUpSnoozedUntil(reminder);

  useEffect(() => {
    setReminder(job);
    setDate(getFollowUpDate(job));
    setNote(getFollowUpNote(job));
  }, [job]);

  async function saveReminder(patch, successMessage) {
    setSaving(successMessage);
    setMessage("");
    try {
      const saved = await updateJob(user, job.id, patch);
      const nextReminder = { ...reminder, ...patch, ...saved };
      setReminder(nextReminder);
      setDate(getFollowUpDate(nextReminder));
      setNote(getFollowUpNote(nextReminder));
      onJobUpdate?.(nextReminder);
      setMessage(successMessage);
      window.setTimeout(() => setMessage(""), 2600);
    } finally {
      setSaving("");
    }
  }

  function saveFollowUp() {
    saveReminder(
      {
        followup_date: date || null,
        followup_note: note,
        followup_status: date ? "scheduled" : "none",
        followup_completed_at: null,
        followup_snoozed_until: null,
      },
      "Follow-up reminder saved.",
    );
  }

  function markCompleted() {
    saveReminder({ followup_status: "completed", followup_completed_at: new Date().toISOString(), followup_snoozed_until: null }, "Follow-up marked complete.");
  }

  function snooze(until) {
    if (!until) return;
    saveReminder({ followup_status: "snoozed", followup_snoozed_until: until, followup_completed_at: null }, `Snoozed until ${formatDate(until)}.`);
  }

  async function generateFollowUpMessage() {
    setMessageError("");
    if (!canRunAi(profile)) {
      setMessageError("Complete your profile target roles and base resume before generating a follow-up message.");
      return;
    }
    if (!job?.job_description?.trim()) {
      setMessageError("Paste the job description before generating a follow-up message.");
      return;
    }
    setGeneratingMessage(true);
    try {
      const result = await generateAiOutput("followupMessage", profile, job, {
        followUpStatus: status,
        followUpDate: date,
        followUpNote: note,
      });
      await saveMessage(user, job, { ...result, type: "Follow-up Message" });
      setMessage("Follow-up message generated.");
      window.setTimeout(() => setMessage(""), 2600);
    } catch (error) {
      setMessageError(error.message || "We couldn't generate the follow-up message yet.");
    } finally {
      setGeneratingMessage(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl bg-brand-50/70 p-4 ring-1 ring-brand-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">Next follow-up</h3>
          <p className="mt-1 text-sm text-slate-600">{label || "Add a follow-up date so this role comes back to your attention."}</p>
        </div>
        {label && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getFollowUpTone(status)}`}>{label}</span>}
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Follow-up date
          <input
            type="date"
            value={date || ""}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Follow-up note
          <textarea
            rows="2"
            value={note || ""}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add a short reminder for future you."
            className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="min-h-8 px-3 text-xs" onClick={saveFollowUp} disabled={Boolean(saving)}>Save follow-up</Button>
        <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={markCompleted} disabled={Boolean(saving || completedAt)}>Mark followed up</Button>
        <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={generateFollowUpMessage} disabled={generatingMessage}>
          {generatingMessage ? "Generating..." : "Generate follow-up message"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Snooze</span>
        <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => snooze(addDaysIso(1))}>Tomorrow</Button>
        <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => snooze(addDaysIso(3))}>3 days</Button>
        <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => snooze(addDaysIso(7))}>1 week</Button>
        <input
          type="date"
          value={customSnooze}
          onChange={(event) => {
            setCustomSnooze(event.target.value);
            snooze(event.target.value);
          }}
          aria-label="Custom snooze date"
          className="min-h-8 rounded-lg border border-brand-100 bg-white px-2 text-xs outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        />
      </div>
      {snoozedUntil && <p className="mt-2 text-xs font-semibold text-slate-500">Currently snoozed until {formatDate(snoozedUntil)}.</p>}
      {messageError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{messageError}</p>}
      {latestFollowUpMessage && (
        <div className="mt-3 rounded-lg bg-white/85 p-3 text-sm leading-6 text-slate-700 ring-1 ring-brand-100">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-ink">Latest follow-up message</p>
            <CopyButton text={latestFollowUpMessage.content} />
          </div>
          <p className="mt-2 whitespace-pre-wrap">{latestFollowUpMessage.content}</p>
        </div>
      )}
      {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p>}
    </div>
  );
}

function JobActivityTimeline({ events = [] }) {
  const sorted = [...events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const grouped = sorted.reduce((groups, event) => {
    const key = getActivityGroup(event.created_at);
    groups[key] = [...(groups[key] || []), event];
    return groups;
  }, {});
  const groupOrder = ["Today", "Yesterday", "This week", "Earlier"].filter((group) => grouped[group]?.length);

  return (
    <section className="rounded-xl bg-white/80 ring-1 ring-brand-100">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <h3 className="font-bold">Generation Activity</h3>
          <p className="mt-0.5 text-xs text-slate-500">{sorted.length ? `${sorted.length} event${sorted.length === 1 ? "" : "s"} recorded for this opportunity.` : "No activity recorded yet."}</p>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto border-t border-brand-100 px-3 py-3">
        {!sorted.length && <p className="rounded-lg bg-brand-50/70 px-3 py-2 text-sm text-slate-600">No activity recorded yet.</p>}
        {groupOrder.map((group) => (
          <div key={group} className="mb-4 last:mb-0">
            <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{group}</p>
            <div className="relative grid gap-1.5 before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-px before:bg-brand-100">
              {grouped[group].map((event) => <TimelineItem key={event.id} event={event} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getDerivedGenerationEvents({ job, scores, resumes, messages }) {
  const exports = getResumeExportHistory().filter((item) => item.jobTitle === getDisplayJobTitle(job) && item.company === getDisplayCompanyName(job));
  return [
    ...scores.map((score) => ({
      id: `score-${score.id}`,
      job_id: job.id,
      type: "analysis_generated",
      metadata: { score: score.score, recommendation: score.recommendation },
      created_at: score.created_at,
      derived: true,
    })),
    ...resumes.map((resume) => ({
      id: `resume-${resume.id}`,
      job_id: job.id,
      type: "resume_generated",
      metadata: { title: resume.title, resumeId: resume.id },
      created_at: resume.created_at,
      derived: true,
    })),
    ...messages.map((message) => ({
      id: `message-${message.id}`,
      job_id: job.id,
      type: message.type === "Follow-up Message" ? "followup_message_generated" : "message_generated",
      metadata: { type: message.type },
      created_at: message.created_at,
      derived: true,
    })),
    ...exports.map((item) => ({
      id: `export-${item.id}`,
      job_id: job.id,
      type: item.type === "DOCX" ? "resume_exported_docx" : "resume_exported_pdf",
      metadata: { resumeId: item.resumeId, fileType: item.type },
      created_at: item.created_at,
      derived: true,
    })),
  ];
}

function mergeTimelineEvents(events, derivedEvents) {
  const loggedKeys = new Set(events.map((event) => getTimelineDedupKey(event)));
  return [
    ...events,
    ...derivedEvents.filter((event) => !loggedKeys.has(getTimelineDedupKey(event))),
  ];
}

function getTimelineDedupKey(event) {
  const metadata = event.metadata && typeof event.metadata === "object" ? event.metadata : {};
  const stableId = metadata.resumeId || metadata.scoreId || metadata.messageId || metadata.fileType || "";
  return `${event.type}-${stableId}-${String(event.created_at || "").slice(0, 16)}`;
}

function TimelineItem({ event }) {
  const Icon = getTimelineIcon(event.type);
  const details = formatActivityDetails(event);
  const timestamp = formatDateTime(event.created_at);
  const relative = formatRelativeTime(event.created_at);
  return (
    <div className="group relative flex gap-3 rounded-lg px-1.5 py-2 transition hover:bg-brand-50/70">
      <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ${getActivityColor(event.type)}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-bold text-ink">{formatActivityLabel(event)}</p>
          <p className="text-xs text-slate-500">{relative || timestamp}</p>
        </div>
        {details && <p className="mt-0.5 text-xs leading-5 text-slate-600">{details}</p>}
        {relative && <p className="mt-0.5 text-[11px] text-slate-400">{timestamp}</p>}
      </div>
    </div>
  );
}

function getTimelineIcon(type) {
  return {
    "arrow-right-circle": ArrowRightCircle,
    bell: Bell,
    "check-circle": CheckCircle2,
    clock: Clock,
    download: Download,
    "file-text": FileTextIcon,
    "message-circle": MessageCircle,
    sparkles: Sparkles,
    upload: Upload,
    circle: Circle,
  }[getActivityIcon(type)] ?? Circle;
}

function formatDateTime(value) {
  if (!value) return "Not dated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not dated";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function WorkflowSteps({ activeTab, completed, score, onSelect }) {
  const steps = [
    ["overview", "Overview"],
    ["fit", "Analysis"],
    ["resume", "Resume"],
    ["message", "Message"],
    ["export", "Export"],
  ];
  const current = activeTab;
  return (
    <div className="border-t border-brand-100 bg-white/90 px-4 py-3 sm:px-5">
      <div className="grid gap-2 sm:grid-cols-5">
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
                {id === "overview" ? "1" : completion || index + 1}
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
  if (id === "overview") return "";
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
