import { Archive, ArrowRightCircle, Bell, CalendarDays, CheckCircle2, Circle, Clock, Download, Edit3, ExternalLink, FileText as FileTextIcon, Loader2, Mail, MapPin, MessageCircle, Plus, Search, Sparkles, Trash2, Upload, User, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiToolsPanel, ApplicationReadinessCard, CopyButton, CoverageMatrix, RecruiterConfidenceIndicator, RecoveryBar, RewriteInsightCard, RewriteVisibilityPanel } from "../../components/ai/AiToolsPanel.jsx";
import { ResumeExportPanel } from "../../components/resume/ResumeExportPanel.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { CompanyLogo } from "../../components/ui/CompanyLogo.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { FitScoreBadge, getLatestFitScore } from "../../components/ui/FitScoreBadge.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { priorities, remoteTypes, stages } from "../../data/seedData.js";
import { formatDate, isOverdue, todayIso } from "../../lib/date.js";
import { addDaysIso, getFollowUpCompletedAt, getFollowUpDate, getFollowUpLabel, getFollowUpNote, getFollowUpSnoozedUntil, getFollowUpStatus, getFollowUpTone } from "../../lib/followUp.js";
import { canRunAi, generateAiOutput } from "../../lib/aiClient.js";
import { calculateApplicationReadiness } from "../../lib/applicationReadiness.js";
import { buildFollowUpCalendarEvent, buildGoogleCalendarUrl, buildInterviewCalendarEvent, buildOutlookCalendarUrl, downloadIcsEvent } from "../../lib/calendarExport.js";
import { exportCoverLetterDocx, exportCoverLetterPdf } from "../../lib/coverLetterExport.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "../../lib/jobDisplay.js";
import { formatActivityDetails, formatActivityLabel, formatRelativeTime, getActivityColor, getActivityGroup, getActivityIcon } from "../../lib/jobActivity.js";
import { getJobAiStatus, isCoverLetter, isRecruiterMessage } from "../../lib/jobAiStatus.js";
import { buildMitigationPlan, getAppliedMitigations } from "../../lib/mitigationPlan.js";
import { buildMaterialRecoveryScores, buildRewriteInsights } from "../../lib/rewriteInsights.js";
import { getResumeExportHistory } from "../../lib/resumeExport.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { getNextBestAction, getNextBestActionTone } from "../../utils/nextBestAction.js";

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
  if (status === "Closed") return "Rejected";
  if (["Offer", "Rejected", "Recruiter Screen", "Final Interview"].includes(status)) return status;
  return status || "Saved";
}

export function JobDetail({ job: initialJob, initialTab = "fit", initialFocus = "", initialContactId = "", onClose, onEdit, onDelete, onArchive, onMove, onJobUpdate, pageMode = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const { profile, jobScores, resumeVersions, messages, jobActivityLogs, jobContacts, interviewPrep, updateJob, saveMessage, updateMessage, saveJobContact, deleteJobContact, markJobContacted, saveInterviewPrep, logJobActivity } = useWorkspaceStore();
  const [job, setModalJob] = useState(initialJob);
  const [activeTab, setActiveTab] = useState(initialTab || "overview");
  const fitSectionRef = useRef(null);
  const contactsSectionRef = useRef(null);
  const followUpSectionRef = useRef(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [exportedResumeIds, setExportedResumeIds] = useState(() => new Set(getResumeExportHistory().map((item) => item.resumeId).filter(Boolean)));
  const [reviewedRecruiterView, setReviewedRecruiterView] = useState(initialTab === "recruiterView");
  const [notesDraft, setNotesDraft] = useState(initialJob.notes || "");
  const [tasks, setTasks] = useState(() => loadJobCommandTasks(initialJob.id));
  const [overviewPanels, setOverviewPanels] = useState({
    role: false,
    description: false,
    notes: false,
    followup: false,
  });
  const latestScore = [...jobScores].filter((score) => score.job_id === job.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const latestResume = [...resumeVersions].filter((version) => version.job_id === job.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const allMessageHistory = messages.filter((message) => message.job_id === job.id);
  const recruiterMessageHistory = allMessageHistory.filter(isRecruiterMessage);
  const coverLetterHistory = allMessageHistory.filter(isCoverLetter);
  const latestMessage = [...recruiterMessageHistory].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const latestCoverLetter = [...coverLetterHistory].sort((a, b) => new Date(b.created_at || b.updated_at) - new Date(a.created_at || a.updated_at))[0];
  const jobScoreHistory = jobScores.filter((score) => score.job_id === job.id);
  const resumeHistory = resumeVersions.filter((version) => version.job_id === job.id);
  const contacts = jobContacts.filter((contact) => contact.job_id === job.id);
  const prep = interviewPrep.find((item) => item.job_id === job.id);
  const aiStatus = getJobAiStatus(job.id, jobScores, resumeVersions, messages);
  const descriptionPreview = getDescriptionPreview(job.job_description);
  const timelineEvents = mergeTimelineEvents(
    jobActivityLogs.filter((event) => event.job_id === job.id),
    getDerivedGenerationEvents({ job, scores: jobScoreHistory, resumes: resumeHistory, messages: allMessageHistory }),
  );
  const recruiterViewReady = hasRecruiterViewReadinessData({
    score: latestScore,
    resume: latestResume,
    coverLetter: latestCoverLetter,
    recruiterMessage: latestMessage,
    reviewedThisSession: reviewedRecruiterView,
  });
  const interviewPrepReady = hasInterviewPrepData(prep);
  const packageReady = hasApplicationPackageReady({
    score: latestScore,
    resume: latestResume,
    coverLetter: latestCoverLetter,
    recruiterMessage: latestMessage,
  });
  const exportReady = Boolean(latestResume?.id && exportedResumeIds.has(latestResume.id)) || packageReady;
  const nextBestAction = getNextBestAction(job, { score: latestScore, aiStatus, messages, activityEvents: timelineEvents, hasInterviewPrep: interviewPrepReady, exportReady });
  const completedSteps = {
    overview: true,
    fit: Boolean(latestScore),
    resume: Boolean(latestResume),
    message: Boolean(latestMessage),
    coverLetter: Boolean(latestCoverLetter),
    interview: interviewPrepReady,
    export: exportReady,
    recruiterView: recruiterViewReady,
  };

  useEffect(() => {
    setModalJob(initialJob);
    setNotesDraft(initialJob.notes || "");
  }, [initialJob]);

  useEffect(() => {
    setTasks(loadJobCommandTasks(job.id));
  }, [job.id]);

  useEffect(() => {
    saveJobCommandTasks(job.id, tasks);
  }, [job.id, tasks]);

  function mergeJobUpdate(updatedJob) {
    const nextJob = { ...job, ...updatedJob };
    setModalJob(nextJob);
    onJobUpdate?.(nextJob);
    return nextJob;
  }

  const requestTabChange = useCallback((nextTab) => {
    if (nextTab === activeTab) return;
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Leave this section anyway?")) return;
    setHasUnsavedChanges(false);
    setActiveTab(nextTab);
  }, [activeTab, hasUnsavedChanges]);

  async function handleNextBestAction() {
    if (nextBestAction.actionType === "analyze_fit") {
      requestTabChange("fit");
      return;
    }
    if (nextBestAction.actionType === "generate_resume") {
      requestTabChange("resume");
      return;
    }
    if (nextBestAction.actionType === "apply_now") {
      onMove?.();
      return;
    }
    if (nextBestAction.actionType === "generate_message") {
      requestTabChange("message");
      return;
    }
    if (nextBestAction.actionType === "generate_cover_letter") {
      requestTabChange("coverLetter");
      return;
    }
    if (nextBestAction.actionType === "review_high_fit" || nextBestAction.actionType === "prepare_interview") {
      requestTabChange(nextBestAction.actionType === "prepare_interview" ? "interview" : "fit");
      return;
    }
    if (nextBestAction.actionType === "follow_up_overdue" || nextBestAction.actionType === "follow_up_today") {
      requestTabChange("overview");
      window.setTimeout(() => followUpSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
      return;
    }
    if (nextBestAction.actionType === "move_to_interview") {
      const updated = await updateJob(user, job.id, { status: "Interview" });
      if (updated) mergeJobUpdate(updated);
    }
    if (nextBestAction.actionType === "export_package") {
      requestTabChange("export");
    }
  }

  async function handleArchive() {
    const confirmed = window.confirm("Archive this opportunity?\n\nYou can restore it later from archived opportunities.");
    if (!confirmed) return;
    try {
      const archived = await updateJob(user, job.id, {
        archived_at: new Date().toISOString(),
        archived_reason: "Archived by user",
        archived_by_user: true,
      });
      const nextJob = mergeJobUpdate(archived);
      toast.success("Opportunity archived.");
      onArchive?.(nextJob);
      onClose?.();
    } catch {
      toast.error("Could not archive opportunity.");
    }
  }

  const requestClose = useCallback(() => {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Close anyway?")) return;
    setHasUnsavedChanges(false);
    onClose?.();
  }, [hasUnsavedChanges, onClose]);

  useEffect(() => {
    if (pageMode) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pageMode, requestClose]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    function onBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (activeTab === "fit" && latestScore) {
      window.setTimeout(() => fitSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }
  }, [activeTab, latestScore]);

  useEffect(() => {
    if (activeTab === "recruiterView") setReviewedRecruiterView(true);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "overview" || !initialFocus) return;
    const target = initialFocus === "contacts" ? contactsSectionRef : initialFocus === "followup" ? followUpSectionRef : null;
    if (!target) return;
    window.setTimeout(() => target.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 180);
  }, [activeTab, initialFocus, initialContactId]);

  async function saveCommandNotes() {
    const updated = await updateJob(user, job.id, { notes: notesDraft });
    if (updated) mergeJobUpdate(updated);
    toast.success("Notes saved.");
  }

  function addCommandTask(label) {
    if (!label.trim()) return;
    setTasks((current) => [...current, { id: window.crypto?.randomUUID?.() || `${Date.now()}`, label: label.trim(), done: false }]);
  }

  function toggleOverviewPanel(panel) {
    setOverviewPanels((current) => ({ ...current, [panel]: !current[panel] }));
  }

  return (
    <div className={pageMode ? "min-h-[calc(100dvh-5rem)]" : "fixed inset-0 z-50 bg-ink/35 p-0 lg:p-4"} onMouseDown={pageMode ? undefined : requestClose}>
      <section className={`${pageMode ? "min-h-[calc(100dvh-5rem)]" : "mx-auto h-[100dvh] max-w-[1600px] lg:h-[calc(100dvh-2rem)] lg:w-[96vw] lg:rounded-lg"} flex flex-col overflow-hidden bg-white shadow-soft`} onMouseDown={(event) => event.stopPropagation()}>
        <header className="shrink-0 border-b border-brand-100 bg-white/95 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
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
                  <RecruiterConfidenceHeroSummary score={latestScore} profile={profile} resume={latestResume} coverLetter={latestCoverLetter} recruiterMessage={latestMessage} />
                </div>
              </div>
              {!pageMode && (
                <button type="button" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-brand-50 lg:hidden" onClick={requestClose} aria-label="Close job details">
                  <X size={20} />
                </button>
              )}
            </div>
            <div className="flex min-w-0 items-center gap-3 lg:max-w-[620px]">
              <div className="min-w-0 flex-1">
                <JobHeaderCta activeTab={activeTab} onTabChange={requestTabChange} />
              </div>
              {!pageMode && (
                <button type="button" className="hidden shrink-0 rounded-lg p-2 text-slate-500 hover:bg-brand-50 lg:inline-flex" onClick={requestClose} aria-label="Close job details">
                  <X size={20} />
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <WorkspaceRail activeTab={activeTab} completed={completedSteps} score={latestScore} onSelect={requestTabChange} />
          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
          {activeTab === "overview" && (
            <div className="mx-auto grid max-w-6xl gap-5">
              <NextBestActionCard action={nextBestAction} onAction={handleNextBestAction} />

              <ApplicationPackageOverview
                score={latestScore}
                resume={latestResume}
                coverLetter={latestCoverLetter}
                recruiterMessage={latestMessage}
                prep={prep}
                exportReady={exportReady}
                onOpenAnalysis={() => requestTabChange("fit")}
                onOpenResume={() => requestTabChange("resume")}
                onOpenCoverLetter={() => requestTabChange("coverLetter")}
                onOpenMessage={() => requestTabChange("message")}
                onOpenInterview={() => requestTabChange("interview")}
                onOpenExport={() => requestTabChange("export")}
              />

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <RecentActivityOverview events={timelineEvents} onViewAll={() => requestTabChange("activity")} />
                <InterviewReadinessOverview
                  job={job}
                  contacts={contacts}
                  score={latestScore}
                  prep={prep}
                  onOpenInterview={() => requestTabChange("interview")}
                />
              </div>

              <div className="grid gap-3">
                <OverviewDisclosure
                  title="Role Snapshot"
                  summary={`${getDisplayStage(job.status)} · ${latestScore ? `${Math.round(Number(latestScore.score))}% fit` : "Fit not analyzed"} · saved ${formatDate(job.date_saved)}`}
                  open={overviewPanels.role}
                  onToggle={() => toggleOverviewPanel("role")}
                >
                  <div className="flex justify-end">
                    {job.source_url && (
                      <a className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900" href={job.source_url} target="_blank" rel="noreferrer">
                        Open source link <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="Location" value={`${job.location || "Not listed"} | ${job.remote_type || "Not set"}`} />
                    <Detail label="Salary" value={job.salary_range || "Not listed"} />
                    <Detail label="Date saved" value={formatDate(job.date_saved)} />
                    <Detail label="Stage" value={getDisplayStage(job.status)} />
                    <Detail label="Fit score" value={latestScore ? `${Math.round(Number(latestScore.score))}%` : "Not analyzed"} />
                    {job.interview_date && <Detail label="Interview date" value={formatDate(job.interview_date)} />}
                    {getFollowUpDate(job) && <Detail label="Follow-up" value={formatDate(getFollowUpDate(job))} />}
                  </dl>
                </OverviewDisclosure>

                <OverviewDisclosure
                  title="Job Description"
                  summary={descriptionPreview || "No description saved."}
                  open={overviewPanels.description}
                  onToggle={() => toggleOverviewPanel("description")}
                >
                  <div className="max-h-[420px] overflow-y-auto rounded-lg bg-brand-50 p-4 text-sm leading-6 text-slate-700">
                    <p className="whitespace-pre-wrap">{job.job_description || "No description saved."}</p>
                  </div>
                </OverviewDisclosure>

                <OverviewDisclosure
                  title="Notes"
                  summary={job.notes ? `${job.notes.slice(0, 120)}${job.notes.length > 120 ? "..." : ""}` : "No notes yet."}
                  open={overviewPanels.notes}
                  onToggle={() => toggleOverviewPanel("notes")}
                >
                  <textarea className="min-h-32 w-full rounded-lg border border-brand-100 bg-white p-3 text-sm leading-6 text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} placeholder="Interview feedback, recruiter comments, salary discussion, follow-up reminders..." />
                  <Button className="mt-3 min-h-8 px-3 text-xs" onClick={saveCommandNotes}>Save notes</Button>
                </OverviewDisclosure>

                <div ref={followUpSectionRef}>
                  <OverviewDisclosure
                    title="Follow-Up"
                    summary={getFollowUpLabel(job) || "No follow-up scheduled."}
                    open={overviewPanels.followup}
                    onToggle={() => toggleOverviewPanel("followup")}
                  >
                    <FollowUpControls job={job} user={user} profile={profile} messages={messages} contacts={contacts} updateJob={updateJob} saveMessage={saveMessage} logJobActivity={logJobActivity} onJobUpdate={mergeJobUpdate} />
                  </OverviewDisclosure>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100">
                <Button onClick={onMove}>Move to Applied</Button>
                {onEdit && <Button variant="secondary" onClick={onEdit}><Edit3 size={16} /> Edit</Button>}
                <Button variant="secondary" onClick={handleArchive}>Archive</Button>
                <Button variant="danger" onClick={onDelete}><Trash2 size={16} /> Delete</Button>
              </div>
            </div>
          )}

          {activeTab === "fit" && (
            <div ref={fitSectionRef} className="mx-auto max-w-6xl scroll-mt-6">
              <AiToolsPanel contentOnly job={job} activeTab="fit" onTabChange={requestTabChange} />
            </div>
          )}
          {activeTab === "resume" && (
            <div className="mx-auto max-w-6xl">
              <AiToolsPanel
                contentOnly
                job={job}
                activeTab="resume"
                onTabChange={requestTabChange}
                onExportComplete={(resume) => {
                  if (resume?.id) setExportedResumeIds((current) => new Set([...current, resume.id]));
                }}
              />
            </div>
          )}
          {activeTab === "export" && (
            <div className="mx-auto max-w-6xl">
              <ApplicationMaterialsWorkspace
                job={job}
                profile={profile}
                score={latestScore}
                resume={latestResume}
                coverLetter={latestCoverLetter}
                recruiterMessage={latestMessage}
                contacts={contacts}
                user={user}
                onSaveCoverLetter={saveMessage}
                onLogActivity={logJobActivity}
                onGoToResume={() => requestTabChange("resume")}
                onGoToCoverLetter={() => requestTabChange("coverLetter")}
                onGoToMessage={() => requestTabChange("message")}
                onGoToInterview={() => requestTabChange("interview")}
                prep={prep}
                onExportComplete={(resume) => {
                  if (resume?.id) setExportedResumeIds((current) => new Set([...current, resume.id]));
                }}
              />
            </div>
          )}
          {activeTab === "message" && (
            <div className="mx-auto max-w-6xl">
              <AiToolsPanel contentOnly job={job} activeTab="message" onTabChange={requestTabChange} />
            </div>
          )}
          {activeTab === "recruiterView" && (
            <div className="mx-auto max-w-6xl">
              <RecruiterViewWorkspace
                score={latestScore}
                profile={profile}
                resume={latestResume}
                coverLetter={latestCoverLetter}
                recruiterMessage={latestMessage}
                onContinue={() => requestTabChange("interview")}
              />
            </div>
          )}
          {activeTab === "coverLetter" && (
            <div className="mx-auto max-w-6xl">
              <CoverLetterWorkspace
                job={job}
                profile={profile}
                score={latestScore}
                resume={latestResume}
                contacts={contacts}
                coverLetter={latestCoverLetter}
                recruiterMessage={latestMessage}
                user={user}
                onSave={saveMessage}
                onUpdate={updateMessage}
                onLogActivity={logJobActivity}
                onUnsavedChange={setHasUnsavedChanges}
              />
            </div>
          )}
          {activeTab === "interview" && (
            <div className="mx-auto max-w-6xl">
              <InterviewPrepWorkspace job={job} profile={profile} score={latestScore} resume={latestResume} contacts={contacts} prep={prep} user={user} updateJob={updateJob} onJobUpdate={mergeJobUpdate} onSavePrep={saveInterviewPrep} onLogActivity={logJobActivity} onUnsavedChange={setHasUnsavedChanges} />
            </div>
          )}
          {activeTab === "activity" && (
            <div className="mx-auto max-w-6xl">
              <JobActivityTimeline events={timelineEvents} />
            </div>
          )}
          {activeTab === "notes" && (
            <div className="mx-auto max-w-6xl">
              <section className="rounded-xl bg-white/90 p-5 shadow-card ring-1 ring-brand-100">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Notes</p>
                <h3 className="mt-1 text-xl font-bold text-ink">Application notes</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Capture recruiter comments, interview feedback, salary notes, and follow-up reminders without leaving the command center.</p>
                <textarea className="mt-4 min-h-56 w-full rounded-lg border border-brand-100 bg-white p-4 text-sm leading-6 text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} placeholder="Interview feedback, recruiter comments, salary discussion, follow-up reminders..." />
                <Button className="mt-3 min-h-9 px-4 text-sm" onClick={saveCommandNotes}>Save notes</Button>
              </section>
            </div>
          )}
          {activeTab === "contacts" && (
            <div ref={contactsSectionRef} className="mx-auto max-w-6xl">
              <ContactsCard job={job} contacts={contacts} user={user} onSave={saveJobContact} onDelete={deleteJobContact} onMarkContacted={markJobContacted} />
            </div>
          )}
          {activeTab === "tasks" && (
            <div className="mx-auto max-w-6xl">
              <CommandTasksWorkspace tasks={tasks} setTasks={setTasks} onAdd={addCommandTask} />
            </div>
          )}
          </main>
        </div>
      </section>
    </div>
  );
}

function JobHeaderCta({ activeTab, onTabChange }) {
  if (activeTab === "export") {
    return (
      <div className="flex justify-end">
        <span className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">
          {"\u2713"} Ready to Export
        </span>
      </div>
    );
  }
  const config = {
    overview: { label: "Continue to Resume", tab: "resume", variant: "primary" },
    fit: { label: "Continue to Resume", tab: "resume", variant: "primary" },
    resume: { label: "Continue to Cover Letter", tab: "coverLetter", variant: "primary" },
    coverLetter: { label: "Continue to Recruiter Message", tab: "message", variant: "primary" },
    message: { label: "View Recruiter View", tab: "recruiterView", variant: "secondary" },
    recruiterView: { label: "Continue to Interview Prep", tab: "interview", variant: "primary" },
    interview: { label: "Export Application Package", tab: "export", variant: "primary" },
  }[activeTab] || { label: "Continue to Resume", tab: "resume", variant: "primary" };
  return (
    <div className="flex justify-end">
      <Button className="min-h-9 px-4 text-sm whitespace-nowrap" variant={config.variant} onClick={() => onTabChange?.(config.tab)}>
        {config.label}
      </Button>
    </div>
  );
}

function CommandTasksWorkspace({ tasks, setTasks, onAdd }) {
  const [draft, setDraft] = useState("");
  return (
    <section className="rounded-xl bg-white/90 p-5 shadow-card ring-1 ring-brand-100">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Tasks</p>
      <h3 className="mt-1 text-xl font-bold text-ink">Search tasks</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">Keep lightweight next steps tied to this opportunity.</p>
      <div className="mt-4 grid gap-2">
        {tasks.map((task) => (
          <label key={task.id} className="flex items-center gap-3 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-brand-100">
            <input type="checkbox" checked={task.done} onChange={(event) => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: event.target.checked } : item))} />
            <span className={task.done ? "line-through opacity-60" : ""}>{task.label}</span>
          </label>
        ))}
        {!tasks.length && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-slate-600">No tasks yet.</p>}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input className="min-w-0 flex-1 rounded-lg border border-brand-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Send follow-up, research company, prepare interview..." />
        <Button className="min-h-9 px-4 text-sm" onClick={() => { onAdd(draft); setDraft(""); }}>Add task</Button>
      </div>
    </section>
  );
}

function OverviewDisclosure({ title, summary, open, onToggle, children }) {
  return (
    <section className="rounded-xl bg-white/90 shadow-sm ring-1 ring-brand-100">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-brand-50/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block text-sm font-black text-ink">{title}</span>
          <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{summary}</span>
        </span>
        <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-800 ring-1 ring-brand-100">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>
      {open && <div className="border-t border-brand-100 px-4 py-4">{children}</div>}
    </section>
  );
}

function ApplicationPackageOverview({ score, resume, coverLetter, recruiterMessage, prep, exportReady, onOpenAnalysis, onOpenResume, onOpenCoverLetter, onOpenMessage, onOpenInterview, onOpenExport }) {
  const assets = [
    { title: "Resume", status: resume ? "Ready" : "Not Generated", actionLabel: resume ? "Open" : "Generate", onAction: onOpenResume, ready: Boolean(resume) },
    { title: "Cover Letter", status: coverLetter ? "Ready" : "Not Generated", actionLabel: coverLetter ? "Open" : "Generate", onAction: onOpenCoverLetter, ready: Boolean(coverLetter) },
    { title: "Recruiter Message", status: recruiterMessage ? "Ready" : "Not Generated", actionLabel: recruiterMessage ? "Open" : "Draft", onAction: onOpenMessage, ready: Boolean(recruiterMessage) },
    { title: "Interview Prep", status: prep ? "Ready" : "Not Started", actionLabel: prep ? "Open" : "Prepare", onAction: onOpenInterview, ready: Boolean(prep) },
  ];
  const next = getAssetProgressAction({ score, resume, coverLetter, recruiterMessage, prep, exportReady, onOpenAnalysis, onOpenResume, onOpenCoverLetter, onOpenMessage, onOpenInterview, onOpenExport });
  return (
    <section className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Application Assets</p>
          <h3 className="mt-1 text-lg font-bold text-ink">{getAssetProgressLabel(assets)}</h3>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {assets.map((asset) => <CommandPackageCard key={asset.title} {...asset} />)}
      </div>
      <div className={`mt-4 flex flex-col gap-2 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${next.variant === "export" ? "bg-brand-900 text-white" : "bg-brand-50 text-ink ring-1 ring-brand-100"}`}>
        <div>
          <p className="text-sm font-black">{next.title}</p>
          <p className={`text-xs font-semibold ${next.variant === "export" ? "text-brand-100" : "text-slate-600"}`}>{next.description}</p>
        </div>
        <Button className={`w-fit min-h-8 px-3 text-xs ${next.variant === "export" ? "bg-white text-brand-900 hover:bg-brand-50" : ""}`} variant={next.variant === "export" ? "primary" : "secondary"} onClick={next.onAction}>{next.label}</Button>
      </div>
    </section>
  );
}

function CommandPackageCard({ title, status, actionLabel, onAction, ready }) {
  return (
    <div className="rounded-xl bg-brand-50/60 px-3 py-2.5 ring-1 ring-brand-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-ink">{title}</h4>
          <p className={`mt-0.5 text-xs font-black ${ready ? "text-emerald-700" : "text-slate-500"}`}>{status}</p>
        </div>
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${getPackageStatusTone(status)}`}>{status}</span>
      </div>
      <button type="button" className="mt-2 inline-flex text-xs font-bold text-brand-700 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200" onClick={onAction}>
        {actionLabel} <span aria-hidden="true" className="ml-1">-&gt;</span>
      </button>
    </div>
  );
}

function RecentActivityOverview({ events = [], onViewAll }) {
  const recent = [...events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  return (
    <section className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Recent Activity</p>
          <h3 className="mt-1 text-lg font-bold text-ink">Latest movement</h3>
        </div>
        <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={onViewAll}>View all activity</Button>
      </div>
      <div className="mt-4 grid gap-2">
        {recent.map((event) => (
          <div key={`${event.id || event.type}-${event.created_at}`} className="flex items-start gap-3 rounded-lg bg-brand-50/70 px-3 py-2">
            <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1 ${getActivityColor(event.type)}`}>
              {(() => {
                const Icon = getTimelineIcon(event.type);
                return <Icon size={14} />;
              })()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{formatActivityLabel(event)}</p>
              <p className="text-xs font-semibold text-slate-500">{formatRelativeTime(event.created_at) || formatDateTime(event.created_at)}</p>
            </div>
          </div>
        ))}
        {!recent.length && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-slate-600">No activity recorded yet.</p>}
      </div>
    </section>
  );
}

function InterviewReadinessOverview({ job, contacts, score, prep, onOpenInterview }) {
  const stage = getDisplayStage(job.status);
  const isInterviewStage = ["Interview", "Final Interview"].includes(stage);
  const content = prep?.content || null;
  const practicedCount = Array.isArray(prep?.practiced_questions) ? prep.practiced_questions.length : 0;
  const readiness = content ? getInterviewReadinessScore({
    content,
    practicedCount,
    interviewDetails: getInterviewDetails(job, contacts),
    thankYouDraft: content.thankYouMessage || "",
    concerns: getInterviewConcernAreas(score),
  }) : null;

  if (!content && !isInterviewStage) {
    return (
      <section className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Interview Readiness</p>
        <h3 className="mt-1 text-lg font-bold text-ink">Prep will unlock when needed</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">When this role moves into interview stage, the command center will surface prep actions here.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Interview Readiness</p>
          <h3 className="mt-1 text-lg font-bold text-ink">{readiness ? `${readiness.score}% ready` : "Prepare for interview"}</h3>
        </div>
        {readiness && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-100">{readiness.label}</span>}
      </div>
      <div className="mt-3 grid gap-2 text-sm text-slate-600">
        {job.interview_date && <p><span className="font-bold text-slate-800">Interview:</span> {formatDate(job.interview_date)}</p>}
        <p><span className="font-bold text-slate-800">Status:</span> {readiness ? readiness.description : "Prep has not been generated yet."}</p>
      </div>
      <Button className="mt-4 min-h-8 px-3 text-xs" variant={readiness ? "secondary" : "primary"} onClick={onOpenInterview}>
        Open Interview Prep
      </Button>
    </section>
  );
}

function getPackageStatusTone(status) {
  if (["Ready", "Exported"].includes(status)) return "bg-emerald-50 text-emerald-800 ring-emerald-100";
  if (status === "Not Started" || status === "Not Generated") return "bg-slate-50 text-slate-600 ring-slate-200";
  return "bg-slate-50 text-slate-600 ring-slate-200";
}

function getAssetProgressLabel(assets = []) {
  const readyCount = assets.filter((asset) => asset.ready).length;
  if (readyCount === 0) return "Not started";
  if (readyCount === assets.length) return "Ready to apply";
  return "In progress";
}

function getAssetProgressAction({ score, resume, coverLetter, recruiterMessage, prep, exportReady, onOpenAnalysis, onOpenResume, onOpenCoverLetter, onOpenMessage, onOpenInterview, onOpenExport }) {
  if (!score) {
    return {
      title: "Start with analysis",
      description: "Analyze the role first so OccuBoard can guide the strongest materials.",
      label: "Generate Analysis",
      onAction: onOpenAnalysis,
      variant: "prepare",
    };
  }
  if (!resume) {
    return {
      title: "Generate missing assets",
      description: "Resume is the next required preparation step.",
      label: "Generate Missing Assets",
      onAction: onOpenResume,
      variant: "prepare",
    };
  }
  if (!coverLetter) {
    return {
      title: "Continue preparation",
      description: "Cover letter is not generated yet.",
      label: "Generate Missing Assets",
      onAction: onOpenCoverLetter,
      variant: "prepare",
    };
  }
  if (!recruiterMessage) {
    return {
      title: "Continue preparation",
      description: "Draft the recruiter message after the materials are ready.",
      label: "Generate Missing Assets",
      onAction: onOpenMessage,
      variant: "prepare",
    };
  }
  if (!prep) {
    return {
      title: "Application assets are nearly ready",
      description: "Interview prep is the remaining preparation step.",
      label: "Continue Interview Prep",
      onAction: onOpenInterview,
      variant: "prepare",
    };
  }
  return {
    title: exportReady ? "Application package ready" : "Ready to export",
    description: exportReady ? "Your application package is ready to use." : "Resume, cover letter, message, and prep assets are ready.",
    label: "Export Application Package",
    onAction: onOpenExport,
    variant: "export",
  };
}

function loadJobCommandTasks(jobId) {
  try {
    return JSON.parse(window.localStorage.getItem(`occuboard-application-tasks-${jobId}`) || "[]");
  } catch {
    return [];
  }
}

function saveJobCommandTasks(jobId, tasks) {
  window.localStorage.setItem(`occuboard-application-tasks-${jobId}`, JSON.stringify(tasks));
}

function NextBestActionCard({ action, onAction }) {
  if (!action || action.actionType === "no_action") return null;
  const Icon = getNextBestActionIcon(action.icon);
  const ctaLabel = getNextBestActionCtaLabel(action.actionType);

  return (
    <section className="rounded-lg bg-white/80 p-4 shadow-sm ring-1 ring-brand-100">
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ${getNextBestActionTone(action.tone)}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Next Best Action</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${getNextBestActionTone(action.tone)}`}>Priority {action.priority}</span>
          </div>
          <h3 className="mt-1 text-base font-bold text-ink">{action.label}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-600">{action.description}</p>
          {ctaLabel && (
            <Button className="mt-3 min-h-8 px-3 text-xs" variant={action.tone === "danger" || action.tone === "warning" ? "secondary" : "primary"} onClick={onAction} aria-label={`${ctaLabel} for this opportunity`}>
              {ctaLabel}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function RecruiterConfidenceHeroSummary({ score, profile, resume, coverLetter, recruiterMessage }) {
  if (!score) return null;
  const confidence = calculateApplicationReadiness({ score, profile, resume, coverLetter, recruiterMessage });
  const addressedCount = confidence.recoveryHighlights.length;
  const summary = addressedCount
    ? `${addressedCount} hiring consideration${addressedCount === 1 ? "" : "s"} strategically addressed`
    : confidence.readiness >= 78
      ? "Recruiter-ready positioning generated"
      : "Operational positioning optimized";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-100">
        {confidence.tier}
      </span>
      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-100">
        {summary}
      </span>
    </div>
  );
}

const contactSources = [
  ["recruiter", "Recruiter"],
  ["hiring_manager", "Hiring manager"],
  ["referral", "Referral"],
  ["company_contact", "Company contact"],
  ["other", "Other"],
];

function ContactsCard({ job, contacts, user, onSave, onDelete, onMarkContacted }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => getEmptyContact(job));
  const [notice, setNotice] = useState("");
  const [highlightedContactId, setHighlightedContactId] = useState("");
  const firstFieldRef = useRef(null);
  const visibleForm = Boolean(editing);

  useEffect(() => {
    if (visibleForm) window.setTimeout(() => firstFieldRef.current?.focus(), 30);
  }, [visibleForm]);

  function startAdd() {
    setEditing("new");
    setForm(getEmptyContact(job));
    setNotice("");
    setHighlightedContactId("");
  }

  function startEdit(contact) {
    setEditing(contact.id);
    setForm({ ...getEmptyContact(job), ...contact });
    setNotice("");
    setHighlightedContactId("");
  }

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function save(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    try {
      await onSave(user, job, form);
      const nextNotice = form.id ? "Contact saved." : "Contact added.";
      setNotice(nextNotice);
      toast.success(nextNotice);
      setEditing(null);
      setForm(getEmptyContact(job));
      window.setTimeout(() => setNotice(""), 2600);
    } catch {
      toast.error("Could not save contact.");
    }
  }

  async function markContacted(contact) {
    try {
      await onMarkContacted(user, contact);
      setNotice("Marked contacted");
      toast.success("Marked contacted.");
      setHighlightedContactId(contact.id);
      window.setTimeout(() => {
        setNotice("");
        setHighlightedContactId("");
      }, 2600);
    } catch {
      toast.error("Could not mark contact contacted.");
    }
  }

  return (
    <section className="rounded-xl bg-white/85 p-4 shadow-sm ring-1 ring-brand-100 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-ink">Contacts</h3>
          <p className="mt-1 text-xs text-slate-500">People connected to this opportunity.</p>
        </div>
        <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={startAdd}>
          <Plus size={14} /> Add contact
        </Button>
      </div>
      {notice && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 ring-1 ring-emerald-100">{notice}</p>}

      {editing === "new" && (
        <ContactForm
          title="Add contact"
          form={form}
          firstFieldRef={firstFieldRef}
          onChange={update}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="mt-3 grid gap-3">
        {!contacts.length && !visibleForm && <p className="rounded-lg bg-brand-50 p-3 text-sm text-slate-600">No contacts yet.</p>}
        {contacts.map((contact) => (
          editing === contact.id ? (
            <ContactForm
              key={contact.id}
              title="Edit contact"
              form={form}
              firstFieldRef={firstFieldRef}
              onChange={update}
              onSubmit={save}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div key={contact.id} className={`rounded-lg bg-brand-50/70 p-3 transition ${highlightedContactId === contact.id ? "ring-2 ring-emerald-100" : ""}`}>
              <div className="flex min-w-0 flex-col gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{contact.name}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{[contact.title, formatContactSource(contact.source), contact.company].filter(Boolean).join(" / ")}</p>
                  {contact.email && (
                    <a className="mt-2 flex min-w-0 items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900" href={`mailto:${contact.email}`}>
                      <Mail size={13} className="shrink-0" />
                      <span className="min-w-0 truncate">{contact.email}</span>
                    </a>
                  )}
                  {contact.phone && <p className="mt-1 truncate text-xs font-semibold text-slate-600">{contact.phone}</p>}
                  {contact.linkedin_url && <a className="mt-1 block max-w-full truncate text-xs font-semibold text-brand-700 hover:text-brand-900" href={contact.linkedin_url} target="_blank" rel="noreferrer">LinkedIn: {contact.linkedin_url}</a>}
                  <p className={`mt-2 text-xs font-semibold transition ${highlightedContactId === contact.id ? "text-emerald-700" : "text-slate-500"}`}>Last contacted: {highlightedContactId === contact.id ? "just now" : formatContactDate(contact.last_contacted_at)}</p>
                  {contact.notes && <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{contact.notes}</p>}
                </div>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  <Button variant="ghost" className="min-h-7 px-2 text-xs" onClick={() => startEdit(contact)}>Edit</Button>
                  <Button variant="ghost" className="min-h-7 px-2 text-xs" onClick={() => markContacted(contact)}>Mark contacted</Button>
                  <Button variant="danger" className="min-h-7 px-2 text-xs" onClick={() => onDelete(user, contact)}>Delete</Button>
                </div>
              </div>
            </div>
          )
        ))}
      </div>
    </section>
  );
}

function ContactForm({ title, form, firstFieldRef, onChange, onSubmit, onCancel }) {
  return (
    <form className="mt-3 grid gap-3 rounded-lg bg-white p-3 ring-1 ring-brand-100" onSubmit={onSubmit}>
      <h4 className="text-sm font-bold text-ink">{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`contact_name_${form.id || "new"}`} label="Name" name="name" value={form.name} onChange={onChange} required ref={firstFieldRef} />
        <Field id={`contact_title_${form.id || "new"}`} label="Title" name="title" value={form.title} onChange={onChange} />
        <Field id={`contact_email_${form.id || "new"}`} label="Email" name="email" type="email" value={form.email} onChange={onChange} />
        <Field id={`contact_phone_${form.id || "new"}`} label="Phone" name="phone" value={form.phone} onChange={onChange} />
        <Field id={`contact_linkedin_${form.id || "new"}`} label="LinkedIn URL" name="linkedin_url" value={form.linkedin_url} onChange={onChange} />
      </div>
      <label className="text-sm font-semibold text-slate-700" htmlFor={`contact_source_${form.id || "new"}`}>
        Source/type
        <select id={`contact_source_${form.id || "new"}`} name="source" className="mt-1 w-full rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={form.source} onChange={onChange}>
          {contactSources.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <Field id={`contact_notes_${form.id || "new"}`} label="Notes" as="textarea" rows="3" name="notes" value={form.notes} onChange={onChange} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-8 px-3 text-xs">Save contact</Button>
        <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function getEmptyContact(job) {
  return {
    job_id: job.id,
    name: "",
    title: "",
    company: getDisplayCompanyName(job),
    email: "",
    phone: "",
    linkedin_url: "",
    source: "recruiter",
    notes: "",
  };
}

function formatContactSource(source = "") {
  return contactSources.find(([value]) => value === source)?.[1] ?? "Contact";
}

function formatContactDate(value) {
  if (!value) return "Not yet";
  return formatDate(String(value).slice(0, 10));
}

function getNextBestActionIcon(icon) {
  return {
    bell: Bell,
    "check-circle": CheckCircle2,
    document: FileTextIcon,
    "message-circle": MessageCircle,
    "arrow-right-circle": ArrowRightCircle,
    download: Download,
    search: Search,
    sparkles: Sparkles,
  }[icon] ?? Sparkles;
}

function getNextBestActionCtaLabel(actionType) {
  return {
    follow_up_overdue: "Follow up",
    follow_up_today: "Follow up",
    analyze_fit: "Analyze Fit",
    generate_resume: "Generate resume",
    generate_message: "Generate message",
    generate_cover_letter: "Generate cover letter",
    apply_now: "Mark applied",
    prepare_interview: "Prepare interview",
    review_high_fit: "Review match",
    move_to_interview: "Move to Interview",
    export_package: "Export package",
  }[actionType];
}

function FollowUpControls({ job, user, profile, messages, contacts = [], updateJob, saveMessage, logJobActivity, onJobUpdate }) {
  const toast = useToast();
  const [reminder, setReminder] = useState(job);
  const [date, setDate] = useState(getFollowUpDate(reminder));
  const [note, setNote] = useState(getFollowUpNote(reminder));
  const [followUpTime, setFollowUpTime] = useState("09:00");
  const [customSnooze, setCustomSnooze] = useState("");
  const [saving, setSaving] = useState("");
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [nextFollowUpOpen, setNextFollowUpOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const showFollowUpSlowHint = useSlowLoading(generatingMessage);
  const followUpDateRef = useRef(null);
  const latestFollowUpMessage = [...messages]
    .filter((item) => item.job_id === job.id && item.type === "Follow-up Message")
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const draftReminder = { ...reminder, followup_date: date, followup_note: note };
  const status = getFollowUpStatus(draftReminder);
  const label = getFollowUpLabel(draftReminder);
  const completedAt = getFollowUpCompletedAt(reminder);
  const snoozedUntil = getFollowUpSnoozedUntil(reminder);
  const followUpEvent = date ? buildFollowUpCalendarEvent(draftReminder, { date, time: followUpTime, contacts, note, latestFollowUpMessage }) : null;
  const googleCalendarUrl = followUpEvent ? buildGoogleCalendarUrl(followUpEvent) : "";
  const outlookCalendarUrl = followUpEvent ? buildOutlookCalendarUrl(followUpEvent) : "";
  const hasUnsavedFollowUp = (date || "") !== (getFollowUpDate(reminder) || "") || (note || "") !== (getFollowUpNote(reminder) || "");

  useEffect(() => {
    setReminder(job);
    setDate(getFollowUpDate(job));
    setNote(getFollowUpNote(job));
  }, [job]);

  async function saveReminder(patch, successMessage) {
    setSaving(successMessage);
    setMessage("");
    setMessageError("");
    try {
      const saved = await updateJob(user, job.id, patch);
      const nextReminder = { ...reminder, ...patch, ...saved };
      setReminder(nextReminder);
      setDate(getFollowUpDate(nextReminder));
      setNote(getFollowUpNote(nextReminder));
      onJobUpdate?.(nextReminder);
      setMessage(successMessage);
      toast.success(successMessage);
      window.setTimeout(() => setMessage(""), 2600);
    } catch (error) {
      const errorMessage = error.message || "Could not save follow-up changes.";
      setMessageError(errorMessage);
      toast.error(errorMessage);
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

  async function copyFollowUpMessage() {
    if (!latestFollowUpMessage?.content) return;
    try {
      await navigator.clipboard.writeText(latestFollowUpMessage.content);
      setCopied(true);
      setMessage("Copied");
      toast.success("Copied to clipboard.");
      await logJobActivity?.(user, job.id, "followup_message_copied", { detail: "Copied follow-up message" });
      window.setTimeout(() => {
        setCopied(false);
        setMessage("");
      }, 2200);
    } catch {
      toast.error("Could not copy message.");
    }
  }

  function setNextFollowUp(days = 7) {
    setNextFollowUpOpen(true);
    setDate(addDaysIso(days));
    setMessage("Choose a date, then save the next follow-up.");
    window.setTimeout(() => followUpDateRef.current?.focus(), 30);
  }

  function snooze(until) {
    if (!until) return;
    saveReminder({ followup_status: "snoozed", followup_snoozed_until: until, followup_completed_at: null }, `Snoozed until ${formatDate(until)}.`);
  }

  async function generateFollowUpMessage() {
    if (generatingMessage) return;
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
      toast.success("Follow-up message generated.");
      window.setTimeout(() => setMessage(""), 2600);
    } catch (error) {
      const errorMessage = error.message || "We couldn't generate the follow-up message yet.";
      setMessageError(errorMessage);
      toast.error("Could not generate follow-up message.");
    } finally {
      setGeneratingMessage(false);
    }
  }

  async function downloadFollowUpCalendar() {
    if (!followUpEvent) return;
    const downloaded = downloadIcsEvent(followUpEvent);
    if (!downloaded) return;
    setMessage("Calendar file downloaded.");
    toast.success("Calendar file downloaded.");
    await logJobActivity?.(user, job.id, "followup_calendar_exported", { fileType: "ICS", date, time: followUpTime });
    window.setTimeout(() => setMessage(""), 2600);
  }

  async function openFollowUpCalendar(provider) {
    setMessage(provider === "outlook" ? "Opening Outlook..." : "Opening Google Calendar...");
    toast.info(provider === "outlook" ? "Opening Outlook..." : "Opening Google Calendar...");
    await logJobActivity?.(user, job.id, "followup_calendar_exported", { fileType: provider === "outlook" ? "Outlook" : "Google Calendar", date, time: followUpTime });
    window.setTimeout(() => setMessage(""), 2200);
  }

  return (
    <div className="mt-3 rounded-lg bg-brand-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">Next follow-up</h3>
          <p className="mt-1 text-sm text-slate-600">{label || "Add a follow-up date so this role comes back to your attention."}</p>
        </div>
        {label && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getFollowUpTone(status)}`}>{label}</span>}
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Follow-up date
            <input
              ref={followUpDateRef}
              type="date"
              value={date || ""}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Reminder time
            <input
              type="time"
              value={followUpTime}
              onChange={(event) => setFollowUpTime(event.target.value || "09:00")}
              className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </label>
        </div>
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
        {hasUnsavedFollowUp && <p className="-mt-1 text-xs font-semibold text-amber-700">Unsaved changes</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant={["due", "overdue"].includes(status) ? "primary" : "secondary"} className="min-h-8 px-3 text-xs" onClick={generateFollowUpMessage} disabled={generatingMessage}>
          {generatingMessage && <Loader2 size={14} className="animate-spin" />}
          {generatingMessage ? "Generating..." : "Generate follow-up message"}
        </Button>
        <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={saveFollowUp} disabled={Boolean(saving)}>
          {saving === "Follow-up reminder saved." && <Loader2 size={14} className="animate-spin" />}
          {saving === "Follow-up reminder saved." ? "Saving..." : "Save follow-up"}
        </Button>
        {!latestFollowUpMessage && <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={markCompleted} disabled={Boolean(saving || completedAt)}>Mark followed up</Button>}
      </div>
      {showFollowUpSlowHint && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">This can take a moment.</p>}

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
      <div className="mt-4">
        <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => setCalendarOpen((current) => !current)} disabled={!date} aria-expanded={calendarOpen}>
          <CalendarDays size={14} /> {calendarOpen ? "Hide calendar options" : "Add to calendar"}
        </Button>
        {!date && <p className="mt-2 text-xs font-semibold text-slate-500">Set a date first to create a calendar reminder.</p>}
        {calendarOpen && date && (
          <div className="mt-3 rounded-lg bg-white/75 p-3 ring-1 ring-brand-100">
            <p className="text-xs text-slate-500">Create a 15-minute reminder from this follow-up date.</p>
            <div className="mt-3 flex flex-wrap gap-2">
            {googleCalendarUrl ? (
              <a
                className="inline-flex min-h-8 items-center justify-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-50 hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
                href={googleCalendarUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => openFollowUpCalendar("google")}
              >
                Google Calendar <ExternalLink size={13} />
              </a>
            ) : (
              <Button variant="secondary" className="min-h-8 px-3 text-xs" disabled>Set a date first</Button>
            )}
            {outlookCalendarUrl && (
              <a
                className="inline-flex min-h-8 items-center justify-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-50 hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
                href={outlookCalendarUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => openFollowUpCalendar("outlook")}
              >
                Outlook <ExternalLink size={13} />
              </a>
            )}
            <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={downloadFollowUpCalendar} disabled={!followUpEvent}>
              <Download size={13} /> Download .ics
            </Button>
            </div>
          </div>
        )}
      </div>
      {snoozedUntil && <p className="mt-2 text-xs font-semibold text-slate-500">Currently snoozed until {formatDate(snoozedUntil)}.</p>}
      {messageError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{messageError}</p>}
      {latestFollowUpMessage && (
        <div className="mt-3 rounded-lg bg-white/85 p-3 text-sm leading-6 text-slate-700 ring-1 ring-brand-100">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-ink">Latest follow-up message</p>
          </div>
          <p className="mt-2 whitespace-pre-wrap">{latestFollowUpMessage.content}</p>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-brand-100 pt-3">
            <Button className="min-h-8 px-3 text-xs" onClick={copyFollowUpMessage}>{copied ? "Copied" : "Copy message"}</Button>
            <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={markCompleted} disabled={Boolean(saving || completedAt)}>Mark followed up</Button>
            <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => setNextFollowUp(7)}>Set next follow-up</Button>
          </div>
          {nextFollowUpOpen && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-50/80 px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Next reminder</span>
              <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => setNextFollowUp(3)}>3 days</Button>
              <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => setNextFollowUp(7)}>1 week</Button>
              <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => setNextFollowUp(14)}>2 weeks</Button>
            </div>
          )}
        </div>
      )}
      {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p>}
    </div>
  );
}

function useSlowLoading(active) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) {
      setShow(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShow(true), 3200);
    return () => window.clearTimeout(timer);
  }, [active]);
  return show;
}

function ApplicationMaterialsWorkspace({ job, profile, score, resume, coverLetter, recruiterMessage, contacts, user, onSaveCoverLetter, onLogActivity, onGoToResume, onGoToCoverLetter, onGoToMessage, onGoToInterview, prep, onExportComplete }) {
  const toast = useToast();
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverExporting, setCoverExporting] = useState("");
  const [coverCopied, setCoverCopied] = useState(false);
  const [error, setError] = useState("");
  const [interviewAssets, setInterviewAssets] = useState({
    cheatSheet: true,
    questions: true,
    stories: true,
    research: true,
  });
  const showSlowHint = useSlowLoading(coverLoading);
  const prepContent = prep?.content;

  async function generateCoverLetter() {
    if (coverLoading) return;
    if (!canRunAi(profile)) {
      setError("Complete your profile and base resume before generating a cover letter.");
      return;
    }
    setCoverLoading(true);
    setError("");
    try {
      const contact = contacts[0];
      const mitigationPlan = buildMitigationPlan(score);
      const appliedMitigations = getAppliedMitigations(mitigationPlan, "Cover letter");
      const result = await generateAiOutput("coverLetter", profile, job, {
        fitRecommendation: score?.recommendation,
        fitSummary: score?.summary,
        latestResume: resume?.content,
        contactName: contact?.name || "",
        mitigationPlan,
        appliedMitigationLabels: appliedMitigations.map((item) => item.appliedLabel),
      });
      await onSaveCoverLetter(user, job, {
        type: "Cover Letter",
        content: result.coverLetterText,
        coverLetterText: result.coverLetterText,
        appliedMitigations,
      });
      if (appliedMitigations.length) await onLogActivity?.(user, job.id, "cover_letter_strengthened_from_analysis", { detail: "Cover letter strengthened from analysis", appliedLabels: appliedMitigations.map((item) => item.appliedLabel) });
      toast.success("Cover letter saved.");
    } catch (err) {
      setError(err.message || "Cover letter could not be generated yet.");
      toast.error("Could not generate cover letter.");
    } finally {
      setCoverLoading(false);
    }
  }

  async function copyCoverLetter() {
    if (!coverLetter?.content) return;
    try {
      await navigator.clipboard.writeText(coverLetter.content);
      await onLogActivity?.(user, job.id, "cover_letter_copied", { detail: "Cover letter copied" });
      toast.success("Copied to clipboard.");
      setCoverCopied(true);
      window.setTimeout(() => setCoverCopied(false), 1800);
    } catch {
      toast.error("Could not copy cover letter.");
    }
  }

  async function exportCoverLetter(type) {
    if (!coverLetter?.content) return;
    setCoverExporting(type);
    try {
      if (type === "pdf") await exportCoverLetterPdf({ content: coverLetter.content, profile, job });
      if (type === "docx") await exportCoverLetterDocx({ content: coverLetter.content, profile, job });
      await onLogActivity?.(user, job.id, type === "pdf" ? "cover_letter_exported_pdf" : "cover_letter_exported_docx", { fileType: type.toUpperCase() });
      toast.success(`Cover letter ${type.toUpperCase()} exported.`);
    } catch (err) {
      setError(err.message || "Cover letter export failed.");
      toast.error("Cover letter export failed.");
    } finally {
      setCoverExporting("");
    }
  }

  return (
    <section className="grid gap-4">
      <div className="rounded-xl bg-white/90 p-5 shadow-card ring-1 ring-brand-100">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Export</p>
        <h3 className="mt-1 text-xl font-bold text-ink">Application Materials</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">Review, copy, and export the pieces you want to include for this opportunity.</p>
        {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
      </div>

      <ApplicationReadinessCard
        score={score}
        profile={profile}
        resume={resume}
        coverLetter={coverLetter}
        recruiterMessage={recruiterMessage}
      />

      <ExportPackageSummary
        resume={resume}
        coverLetter={coverLetter}
        recruiterMessage={recruiterMessage}
        prepContent={prepContent}
        interviewAssets={interviewAssets}
      />

      <section className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Interview Extras</p>
        <h3 className="mt-1 text-lg font-bold text-ink">Optional prep assets</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{prepContent ? "Choose the interview prep assets to include before exporting." : "Generate interview prep to add cheat sheets, stories, questions, and research notes."}</p>
        {prepContent ? (
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2 md:grid-cols-2">
              {[
                ["cheatSheet", "Interview Cheat Sheet"],
                ["questions", "Interview Questions"],
                ["stories", "STAR Stories"],
                ["research", "Research Notes"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-brand-100">
                  <input type="checkbox" checked={interviewAssets[key]} onChange={(event) => setInterviewAssets((current) => ({ ...current, [key]: event.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            <Button className="w-fit min-h-8 px-3 text-xs" onClick={() => printInterviewCheatSheet({
              job,
              score,
              content: prepContent,
              interviewDetails: getInterviewDetails(job, contacts),
              questions: interviewAssets.questions ? prepContent.questions || [] : [],
              stories: interviewAssets.stories ? prepContent.starStories || [] : [],
              focusAreas: interviewAssets.research ? prepContent.focusAreas || [] : [],
              questionsToAsk: interviewAssets.research ? prepContent.questionsToAsk || [] : [],
              concerns: interviewAssets.cheatSheet ? getInterviewConcernAreas(score) : [],
            })}>
              <Download size={13} /> Export Complete Package
            </Button>
          </div>
        ) : (
          <Button variant="secondary" className="mt-3 w-fit min-h-8 px-3 text-xs" onClick={onGoToInterview}>Open Interview Prep</Button>
        )}
      </section>

      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Application Files</p>

      <MaterialCard title="Resume" status={resume ? "Ready" : "Not generated"} description={resume ? "Preview or download your tailored resume." : "Create a tailored resume before exporting your application package."}>
        {resume ? (
          <ResumeExportPanel resume={resume} profile={profile} job={job} compact onExportComplete={onExportComplete} />
        ) : (
          <Button className="w-fit min-h-8 px-3 text-xs" onClick={onGoToResume}>Tailor resume</Button>
        )}
      </MaterialCard>

      <MaterialCard title="Cover Letter" status={coverLetter ? "Ready" : "Optional"} description={coverLetter ? "Copy or export the tailored cover letter." : "No cover letter yet. Generate one only when it strengthens the application."}>
        {coverLetter ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={copyCoverLetter}>{coverCopied ? "Copied" : "Copy"}</Button>
            <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => exportCoverLetter("pdf")} disabled={Boolean(coverExporting)}>
              {coverExporting === "pdf" && <Loader2 size={14} className="animate-spin" />}
              PDF
            </Button>
            <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => exportCoverLetter("docx")} disabled={Boolean(coverExporting)}>
              {coverExporting === "docx" && <Loader2 size={14} className="animate-spin" />}
              DOCX
            </Button>
            <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={onGoToCoverLetter}>Edit</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" className="w-fit min-h-8 px-3 text-xs" onClick={generateCoverLetter} disabled={coverLoading}>
              {coverLoading && <Loader2 size={14} className="animate-spin" />}
              {coverLoading ? "Generating..." : "Generate cover letter"}
            </Button>
            {showSlowHint && <span className="text-xs font-semibold text-brand-700">This can take a moment.</span>}
          </div>
        )}
      </MaterialCard>

      <MaterialCard title="Recruiter Message" status={recruiterMessage ? "Ready" : "Not generated"} description={recruiterMessage ? "Copy your outreach note when you are ready to contact someone." : "Draft this after your application materials are ready."}>
        {recruiterMessage ? <CopyButton text={recruiterMessage.content} /> : <Button variant="secondary" className="w-fit min-h-8 px-3 text-xs" onClick={onGoToMessage}>Draft Recruiter Message</Button>}
      </MaterialCard>
    </section>
  );
}

function ExportPackageSummary({ resume, coverLetter, recruiterMessage, prepContent, interviewAssets }) {
  const included = [
    ["Resume", Boolean(resume)],
    ["Cover Letter", Boolean(coverLetter)],
    ["Recruiter Message", Boolean(recruiterMessage)],
  ];
  const optional = [
    ["Interview Cheat Sheet", Boolean(prepContent && interviewAssets.cheatSheet)],
    ["Interview Questions", Boolean(prepContent && interviewAssets.questions)],
    ["STAR Stories", Boolean(prepContent && interviewAssets.stories)],
    ["Research Notes", Boolean(prepContent && interviewAssets.research)],
  ];
  return (
    <section className="rounded-xl bg-brand-50/80 p-4 shadow-sm ring-1 ring-brand-100">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Export Summary</p>
      <h3 className="mt-1 text-lg font-bold text-ink">What will be included?</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Included</p>
          <div className="mt-2 grid gap-1.5">
            {included.map(([label, ready]) => <ExportSummaryRow key={label} label={label} ready={ready} />)}
          </div>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Optional</p>
          <div className="mt-2 grid gap-1.5">
            {optional.map(([label, ready]) => <ExportSummaryRow key={label} label={label} ready={ready} optional />)}
          </div>
        </div>
      </div>
    </section>
  );
}

function ExportSummaryRow({ label, ready, optional = false }) {
  return (
    <p className={`text-sm font-semibold ${ready ? "text-emerald-800" : "text-slate-500"}`}>
      <span aria-hidden="true">{ready ? "\u2713" : optional ? "\u2610" : "\u25CB"}</span> {label}
    </p>
  );
}

function MaterialCard({ title, status, description, children }) {
  const optional = status === "Optional";
  return (
    <section className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100 sm:p-5">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-ink">{title}</h4>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${optional ? "bg-slate-50 text-slate-500 ring-slate-100" : status === "Ready" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-brand-50 text-brand-700 ring-brand-100"}`}>{status}</span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}

function RecruiterViewWorkspace({ score, profile, resume, coverLetter, recruiterMessage, onContinue }) {
  const [section, setSection] = useState("overview");
  if (!score && !resume && !coverLetter && !recruiterMessage) {
    return (
      <section className="rounded-xl bg-white/90 p-5 shadow-card ring-1 ring-brand-100">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Recruiter View</p>
        <h3 className="mt-1 text-xl font-bold text-ink">Recruiter perspective will appear after analysis</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Analyze the role first, then OccuBoard can summarize what a recruiter is likely to notice and where positioning has been strengthened.</p>
      </section>
    );
  }

  const readiness = calculateApplicationReadiness({ score, profile, resume, coverLetter, recruiterMessage });
  const mitigationPlan = buildMitigationPlan(score);
  const rewriteItems = buildRecruiterViewRewriteItems({ score, profile, resume, coverLetter, recruiterMessage, mitigationPlan });
  const allInsights = rewriteItems.flatMap((item) => item.insights);
  const recoveryScores = buildMaterialRecoveryScores({
    mitigationPlan,
    materials: { resume, coverLetter, message: recruiterMessage },
    rewriteSections: allInsights,
  });
  const strongRecoveryCount = recoveryScores.filter((item) => item.score >= 3).length;
  const coveredInTwoMaterials = recoveryScores.filter((item) => Object.values(item.coverage || {}).filter(Boolean).length >= 2).length;
  const hasIntelligenceData = recoveryScores.length > 0 || rewriteItems.some((item) => item.insights.length > 0);
  const tabs = [
    ["overview", "Overview"],
    ...(recoveryScores.length ? [["recovery", "Recovery"], ["coverage", "Coverage"]] : []),
    ...(rewriteItems.some((item) => item.insights.length > 0) ? [["changes", "Changes"]] : []),
  ];

  return (
    <section className="grid gap-4">
      <div className="rounded-xl bg-white/90 p-4 shadow-card ring-1 ring-brand-100">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Recruiter View</p>
            <h3 className="mt-1 text-xl font-bold text-ink">Hiring-team perspective</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">A focused view of recruiter confidence, first impressions, hesitation points, and strategic recovery.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-100">{readiness.tier}</span>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-100">{readiness.readiness} Recruiter Confidence</span>
            {mitigationPlan.items.length > 0 && <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">{strongRecoveryCount}/{mitigationPlan.items.length} Considerations Addressed</span>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Recruiter View sections">
          {tabs.map(([id, label]) => {
            const selected = section === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${
                  selected ? "bg-brand-700 text-white shadow-sm" : "bg-brand-50 text-brand-800 ring-1 ring-brand-100 hover:bg-brand-100"
                }`}
                onClick={() => setSection(id)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {section === "overview" && (
        <RecruiterViewOverview
          score={score}
          profile={profile}
          resume={resume}
          coverLetter={coverLetter}
          recruiterMessage={recruiterMessage}
          strategyItems={mitigationPlan.items}
          recoveryScores={recoveryScores}
          onSelectSection={setSection}
          onContinue={onContinue}
          hasIntelligenceData={hasIntelligenceData}
        />
      )}
      {section === "recovery" && <RecruiterViewRecovery rows={recoveryScores} strategyItems={mitigationPlan.items} strongCount={strongRecoveryCount} />}
      {section === "coverage" && <RecruiterViewCoverage rows={recoveryScores} coveredInTwoMaterials={coveredInTwoMaterials} />}
      {section === "changes" && <RecruiterViewChanges rewriteItems={rewriteItems} recoveryScores={recoveryScores} />}
    </section>
  );
}

function RecruiterViewOverview({ score, profile, resume, coverLetter, recruiterMessage, strategyItems, recoveryScores, onSelectSection, onContinue, hasIntelligenceData }) {
  const readiness = calculateApplicationReadiness({ score, profile, resume, coverLetter, recruiterMessage });
  const recommendation = getApplicationRecommendation({ readiness, strategyItems, recoveryScores, resume, recruiterMessage });
  const outlook = getHiringOutlook({ readiness, strategyItems, recoveryScores });
  const addressedCount = recoveryScores.filter((item) => item.score >= 3).length;
  const totalConsiderations = strategyItems.length || recoveryScores.length;
  return (
    <section className="grid gap-4">
      <HiringOutlookCard
        outlook={outlook}
        recommendation={recommendation}
        readiness={readiness}
        addressedCount={addressedCount}
        totalConsiderations={totalConsiderations}
        onSelectSection={onSelectSection}
        onContinue={onContinue}
      />
      <ApplicationReadinessCard score={score} profile={profile} resume={resume} coverLetter={coverLetter} recruiterMessage={recruiterMessage} />
      {strategyItems.length > 0 && (
        <div className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Strategy highlights</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {strategyItems.slice(0, 4).map((item) => (
              <span key={item.id} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-100">{item.appliedLabel}</span>
            ))}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">Recruiters are likely to notice {readiness.strongestSignal.toLowerCase()}. The main place to stay clear and confident is {readiness.biggestConsideration.toLowerCase()}.</p>
        </div>
      )}
      {!hasIntelligenceData && (
        <div className="rounded-xl bg-white/90 p-4 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-brand-100">
          No major hiring considerations were identified for this role.
        </div>
      )}
    </section>
  );
}

function HiringOutlookCard({ outlook, recommendation, readiness, addressedCount, totalConsiderations, onSelectSection, onContinue }) {
  return (
    <section className="rounded-xl bg-white/95 p-4 shadow-card ring-1 ring-brand-100">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Hiring Outlook</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h3 className="text-2xl font-black text-ink">{outlook.label}</h3>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-100">{recommendation.label}</span>
        <Button className="min-h-8 px-3 text-xs" onClick={onContinue}>Continue to Interview Prep</Button>
        {recommendation.action && (
          <Button variant={recommendation.actionVariant} className="min-h-8 px-3 text-xs" onClick={() => onSelectSection?.(recommendation.actionSection)}>
            {recommendation.action}
          </Button>
        )}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <HiringOutlookMetric label="Hiring Probability" value={outlook.label} />
        <HiringOutlookMetric label="Recommendation" value={recommendation.label} />
        <HiringOutlookMetric label="Recruiter Confidence" value={`${readiness.readiness}%`} />
        <HiringOutlookMetric label="Considerations Addressed" value={totalConsiderations ? `${addressedCount}/${totalConsiderations}` : "None flagged"} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-bold text-slate-800">Recruiters are likely to focus on:</p>
          <ul className="mt-2 grid gap-1.5 text-sm text-slate-700">
            {outlook.focus.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">Potential hesitation:</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">• {outlook.hesitation}</p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Recommendation</p>
          <p className="mt-1 text-sm font-black text-brand-900">{recommendation.label}</p>
        </div>
      </div>
    </section>
  );
}

function HiringOutlookMetric({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50/90 p-3 ring-1 ring-slate-100">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function RecruiterViewRecovery({ rows, strategyItems = [], strongCount }) {
  if (!rows.length) return <RecruiterViewEmpty message="Recovery details will appear after analysis-backed materials are generated." />;
  const prioritizedRows = rows
    .map((row) => ({ ...row, priority: getRecoveryPriority(row, strategyItems.find((item) => item.id === row.gapId)) }))
    .sort((a, b) => getRecoveryPriorityRank(a.priority) - getRecoveryPriorityRank(b.priority) || b.score - a.score);
  const [topRow, ...otherRows] = prioritizedRows;
  return (
    <section className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Hiring consideration recovery</p>
      <h3 className="mt-1 text-lg font-bold text-ink">{strongCount} of {rows.length} considerations have strong or full recovery.</h3>
      <p className="mt-1 text-sm leading-6 text-slate-700">Recovery reflects improved positioning, not newly invented experience.</p>
      {topRow && (
        <div className="mt-4 rounded-xl bg-brand-50/70 p-4 ring-1 ring-brand-100">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-brand-700">Highest Impact Recovery</p>
          <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
            <div>
              <p className="text-base font-black text-ink">{topRow.label}</p>
              <p className="mt-1 text-xs font-semibold text-brand-800">{topRow.priority} priority · {topRow.confidence}</p>
            </div>
            <RecoveryBar recovery={topRow.recovery} confidence="" />
          </div>
        </div>
      )}
      {otherRows.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Additional Improvements</p>
          <div className="mt-2 grid gap-3">
            {otherRows.map((row) => (
              <div key={row.gapId} className="grid gap-2 rounded-lg bg-slate-50/80 p-3 ring-1 ring-slate-100 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
                <div>
                  <p className="text-sm font-bold text-slate-800">{row.label}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{row.priority} priority · {row.confidence}</p>
                </div>
                <RecoveryBar recovery={row.recovery} confidence="" />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function RecruiterViewCoverage({ rows, coveredInTwoMaterials }) {
  if (!rows.length) return <RecruiterViewEmpty message="Coverage details will appear once resume, cover letter, or recruiter message positioning is generated." />;
  const summary = getCoverageSummary(rows);
  return (
    <section className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Strategic coverage</p>
      <h3 className="mt-1 text-lg font-bold text-ink">{coveredInTwoMaterials ? `${coveredInTwoMaterials} concerns are covered across at least two materials.` : "Coverage is starting to build across materials."}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-700">Shows where OccuBoard strengthened each positioning concern.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <CoverageMetric label="Resume coverage" value={`${summary.resume}%`} />
        <CoverageMetric label="Cover letter coverage" value={`${summary.coverLetter}%`} />
        <CoverageMetric label="Recruiter message" value={`${summary.recruiterMessage}%`} />
        <CoverageMetric label="Considerations covered" value={`${summary.totalCovered} / ${rows.length}`} />
        <CoverageMetric label="Outreach reinforced" value={`${summary.outreachReinforced} / ${rows.length}`} />
      </div>
      <CoverageMatrix rows={rows} />
    </section>
  );
}

function RecruiterViewChanges({ rewriteItems, recoveryScores }) {
  const [expanded, setExpanded] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  const items = dedupeRewriteSections(rewriteItems.flatMap((item) => item.insights.map((section) => ({ ...section, materialType: item.materialType }))));
  if (!items.length) return <RecruiterViewEmpty message="Rewrite details will appear after generated materials include analysis-backed improvements." />;
  return (
    <section className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Strategic Improvements Applied</p>
          <h3 className="mt-1 text-lg font-bold text-ink">What changed in the generated materials</h3>
        </div>
        <Button variant="secondary" className="w-fit min-h-8 px-3 text-xs" onClick={() => setShowDetails((value) => !value)}>
          {showDetails ? "Hide detailed changes" : "Show detailed changes"}
        </Button>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.1em] text-slate-500">
            <tr>
              <th className="px-3 py-2 font-bold">Change</th>
              <th className="px-3 py-2 font-bold">Impact / Recovery status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {items.map((section) => {
              const recovery = recoveryScores.find((item) => item.label === section.mitigationSource);
              return (
                <tr key={`${section.materialType}-summary-${section.id}`}>
                  <td className="px-3 py-2 font-bold text-slate-800">{section.title}</td>
                  <td className="px-3 py-2 text-slate-700">{formatImpactLevel(section.impactLevel)} Impact | {recovery?.recovery || section.confidence}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showDetails && (
        <div className="mt-4 grid gap-3">
          {items.map((section) => (
            <RewriteInsightCard
              key={`${section.materialType}-${section.id}`}
              section={section}
              materialType={section.materialType}
              recovery={recoveryScores.find((item) => item.label === section.mitigationSource)}
              expanded={Boolean(expanded[`${section.materialType}-${section.id}`])}
              onToggle={() => setExpanded((current) => ({ ...current, [`${section.materialType}-${section.id}`]: !current[`${section.materialType}-${section.id}`] }))}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CoverageMetric({ label, value }) {
  return (
    <div className="rounded-lg bg-brand-50/70 p-3 ring-1 ring-brand-100">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-600">{label}</p>
      <p className="mt-1 text-lg font-black text-brand-900">{value}</p>
    </div>
  );
}

function RecruiterViewEmpty({ message }) {
  return (
    <section className="rounded-xl bg-white/90 p-5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-brand-100">
      {message}
    </section>
  );
}

function buildRecruiterViewRewriteItems({ score, profile, resume, coverLetter, recruiterMessage, mitigationPlan }) {
  return [
    ["resume", resume],
    ["coverLetter", coverLetter],
    ["message", recruiterMessage],
  ].filter(([, material]) => material?.content).map(([materialType, material]) => ({
    materialType,
    material,
    insights: buildRewriteInsights({
      originalText: profile?.base_resume_text,
      generatedText: material.content,
      mitigationPlan,
      analysis: score,
      gaps: score?.gaps,
      strengths: score?.strengths,
      keywords: score?.keywords,
      materialType,
    }).sections,
  }));
}

function dedupeRewriteSections(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = [item.title, item.category, item.mitigationSource].filter(Boolean).join("|").toLowerCase();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getApplicationRecommendation({ readiness, strategyItems = [], recoveryScores = [], resume, recruiterMessage }) {
  const total = strategyItems.length || recoveryScores.length;
  const strongOrFullRecoveryCount = recoveryScores.filter((item) => item.score >= 3).length;
  const unresolvedCriticalCount = strategyItems.filter((item) => item.severity === "critical" && !recoveryScores.some((row) => row.gapId === item.id && row.score >= 3)).length;
  const missingCoreMaterials = !resume || !recruiterMessage;
  const recoveredRatio = total ? strongOrFullRecoveryCount / total : 1;

  if (readiness.readiness >= 90 && recoveredRatio >= 0.75 && unresolvedCriticalCount === 0 && !missingCoreMaterials) {
    return {
      label: "Submit as-is",
      description: "All major hiring considerations have been addressed. Recruiter confidence is strong and no blocking concerns remain.",
      note: `Confidence: High. ${readiness.readiness} recruiter confidence with ${strongOrFullRecoveryCount}/${total || 0} considerations strongly addressed.`,
      action: "",
      actionSection: "overview",
      actionVariant: "primary",
      tone: "bg-emerald-50 ring-emerald-100",
    };
  }

  if (readiness.readiness >= 75) {
    return {
      label: "Apply after quick review",
      description: "This application is competitive. A quick review of the remaining positioning notes may improve confidence.",
      note: `Confidence: Moderate. ${readiness.tier}; review recovery if you want one last confidence check.`,
      action: "Review Recovery",
      actionSection: recoveryScores.length ? "recovery" : "overview",
      actionVariant: "secondary",
      tone: "bg-brand-50 ring-brand-100",
    };
  }

  return {
    label: "Address remaining concerns before applying",
    description: "Strengthen the remaining positioning points before submitting this application.",
    note: missingCoreMaterials ? "Confidence: Low. Core application materials are still being built." : "Confidence: Low. A few positioning points may need more attention.",
    action: recoveryScores.length ? "Review Considerations" : "",
    actionSection: "recovery",
    actionVariant: "secondary",
    tone: "bg-amber-50 ring-amber-100",
  };
}

function getCoverageSummary(rows = []) {
  const total = Math.max(rows.length, 1);
  const count = (key) => rows.filter((row) => row.coverage?.[key]).length;
  const resume = count("resume");
  const coverLetter = count("coverLetter");
  const recruiterMessage = count("recruiterMessage");
  return {
    resume: Math.round((resume / total) * 100),
    coverLetter: Math.round((coverLetter / total) * 100),
    recruiterMessage: Math.round((recruiterMessage / total) * 100),
    totalCovered: rows.filter((row) => Object.values(row.coverage || {}).some(Boolean)).length,
    outreachReinforced: recruiterMessage,
  };
}

function getHiringOutlook({ readiness, strategyItems = [], recoveryScores = [] }) {
  const highRecovery = recoveryScores.filter((item) => item.score >= 3).length;
  const total = recoveryScores.length || strategyItems.length || 1;
  const ratio = highRecovery / total;
  const label = readiness.readiness >= 88 && ratio >= 0.7
    ? "High Probability"
    : readiness.readiness >= 75
      ? "Competitive"
      : "Developing";
  const focus = [
    readiness.strongestSignal,
    "SaaS implementation ownership",
    "Systems coordination background",
  ].filter(Boolean).slice(0, 3);
  return {
    label,
    focus,
    hesitation: readiness.biggestConsideration || "No major unresolved hesitation identified",
  };
}

function getRecoveryPriority(row, strategyItem = {}) {
  if (strategyItem.severity === "critical") return "Critical";
  if (strategyItem.severity === "moderate" || row.category === "itsm_ticketing") return "High";
  if (["uat_validation", "platform_familiarity", "documentation_training"].includes(row.category)) return "Medium";
  return "Low";
}

function getRecoveryPriorityRank(priority) {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[priority] ?? 4;
}

function formatImpactLevel(value = "") {
  const normalized = String(value || "medium").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function CoverLetterWorkspace({ job, profile, score, resume, contacts, coverLetter, recruiterMessage, user, onSave, onUpdate, onLogActivity, onUnsavedChange }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(coverLetter?.content ?? "");
  const [lastSavedDraft, setLastSavedDraft] = useState(coverLetter?.content ?? "");
  const [savedState, setSavedState] = useState("");
  const [copied, setCopied] = useState(false);
  const showSlowHint = useSlowLoading(loading);
  const isDirty = draft !== lastSavedDraft;

  useEffect(() => {
    setDraft(coverLetter?.content ?? "");
    setLastSavedDraft(coverLetter?.content ?? "");
    setSavedState("");
    setCopied(false);
  }, [coverLetter?.id, coverLetter?.content]);

  useEffect(() => {
    onUnsavedChange?.(isDirty);
    return () => onUnsavedChange?.(false);
  }, [isDirty, onUnsavedChange]);

  async function generateCoverLetter({ regenerate = false } = {}) {
    if (loading) return;
    if (!canRunAi(profile)) {
      setError("Complete your profile and base resume before generating a cover letter.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const contact = contacts[0];
      const mitigationPlan = buildMitigationPlan(score);
      const appliedMitigations = getAppliedMitigations(mitigationPlan, "Cover letter");
      const result = await generateAiOutput("coverLetter", profile, job, {
        fitRecommendation: score?.recommendation,
        fitSummary: score?.summary,
        latestResume: resume?.content,
        contactName: contact?.name || "",
        mitigationPlan,
        appliedMitigationLabels: appliedMitigations.map((item) => item.appliedLabel),
      });
      const saved = await onSave(user, job, {
        type: "Cover Letter",
        content: result.coverLetterText,
        coverLetterText: result.coverLetterText,
        appliedMitigations,
      });
      const nextContent = saved?.content || result.coverLetterText || "";
      setDraft(nextContent);
      setLastSavedDraft(nextContent);
      toast.success(regenerate ? "Cover letter regenerated." : "Cover letter saved.");
      if (appliedMitigations.length) await onLogActivity?.(user, job.id, "cover_letter_strengthened_from_analysis", { detail: "Cover letter strengthened from analysis", appliedLabels: appliedMitigations.map((item) => item.appliedLabel) });
      if (regenerate) await onLogActivity?.(user, job.id, "cover_letter_regenerated", { detail: "Cover letter regenerated" });
    } catch (err) {
      setError(err.message || "Cover letter could not be generated yet.");
      toast.error("Could not generate cover letter.");
    } finally {
      setLoading(false);
    }
  }

  async function saveEdits() {
    if (!coverLetter || !draft.trim()) return;
    setSavedState("saving");
    try {
      await onUpdate(user, coverLetter, { content: draft });
      await onLogActivity?.(user, job.id, "cover_letter_edited", { detail: "Cover letter edits saved" });
      setLastSavedDraft(draft);
      setSavedState("saved");
      toast.success("Cover letter saved.");
      window.setTimeout(() => setSavedState(""), 2400);
    } catch {
      setSavedState("error");
      toast.error("Could not save cover letter.");
    }
  }

  async function copyCoverLetter() {
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      await onLogActivity?.(user, job.id, "cover_letter_copied", { detail: "Cover letter copied" });
      setCopied(true);
      toast.success("Copied to clipboard.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy cover letter.");
    }
  }

  async function exportCoverLetter(type) {
    if (!draft.trim()) return;
    setExporting(type);
    try {
      if (type === "pdf") await exportCoverLetterPdf({ content: draft, profile, job });
      if (type === "docx") await exportCoverLetterDocx({ content: draft, profile, job });
      await onLogActivity?.(user, job.id, type === "pdf" ? "cover_letter_exported_pdf" : "cover_letter_exported_docx", { fileType: type.toUpperCase() });
      toast.success(`Cover letter ${type.toUpperCase()} exported.`);
    } catch (err) {
      setError(err.message || "Cover letter export failed.");
      toast.error("Cover letter export failed.");
    } finally {
      setExporting("");
    }
  }

  if (!coverLetter) {
    return (
      <section className="rounded-xl bg-white/90 p-5 shadow-card ring-1 ring-brand-100">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Optional</p>
        <h3 className="mt-2 text-xl font-bold text-ink">No cover letter yet</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Generate a short, tailored cover letter when a role asks for one or when you want a stronger application package.</p>
        {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
        <Button className="mt-5" onClick={() => generateCoverLetter()} disabled={loading}>
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? "Generating..." : "Generate cover letter"}
        </Button>
        {showSlowHint && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">This can take a moment.</p>}
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="rounded-xl bg-white/90 p-5 shadow-card ring-1 ring-brand-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Cover Letter</p>
            <h3 className="mt-1 text-xl font-bold text-ink">{getDisplayJobTitle(job)} at {getDisplayCompanyName(job)}</h3>
            <p className="mt-1 text-sm text-slate-500">Generated {formatDate(coverLetter.created_at?.slice(0, 10))}</p>
          </div>
          <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => generateCoverLetter({ regenerate: true })} disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Generating..." : "Regenerate"}
          </Button>
        </div>
        {showSlowHint && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">This can take a moment.</p>}
        {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
        <RecruiterConfidenceIndicator label="Cover letter positioning improved" className="mt-3" />
      </div>

      <div className="rounded-xl bg-slate-50/80 p-4 shadow-card ring-1 ring-brand-100 sm:p-6">
        <textarea
          className="min-h-[480px] w-full rounded-lg border border-slate-200 bg-white px-6 py-7 text-[15px] leading-8 text-slate-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 sm:px-9 sm:py-8"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSavedState("dirty");
          }}
        />
        <RewriteVisibilityPanel material={coverLetter} materials={{ resume, coverLetter, message: recruiterMessage }} score={score} originalText={profile?.base_resume_text} generatedText={draft} materialType="coverLetter" className="mt-3" />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button className="min-h-8 px-3 text-xs" onClick={saveEdits} disabled={!draft.trim() || savedState === "saving"}>
            {savedState === "saving" && <Loader2 size={14} className="animate-spin" />}
            Save edits
          </Button>
          <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={copyCoverLetter} disabled={!draft.trim()}>{copied ? "Copied" : "Copy"}</Button>
          <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => exportCoverLetter("pdf")} disabled={!draft.trim() || Boolean(exporting)}>
            {exporting === "pdf" && <Loader2 size={14} className="animate-spin" />}
            Export PDF
          </Button>
          <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => exportCoverLetter("docx")} disabled={!draft.trim() || Boolean(exporting)}>
            {exporting === "docx" && <Loader2 size={14} className="animate-spin" />}
            Export DOCX
          </Button>
          {savedState === "dirty" && <span className="text-xs font-semibold text-amber-700">Unsaved changes</span>}
          {savedState === "saving" && <span className="text-xs font-semibold text-brand-700">Saving...</span>}
          {savedState === "saved" && <span className="text-xs font-semibold text-emerald-700">Saved</span>}
          {savedState === "error" && <span className="text-xs font-semibold text-rose-700">Could not save</span>}
        </div>
      </div>
    </section>
  );
}

function InterviewPrepWorkspace({ job, profile, score, resume, contacts, prep, user, updateJob, onJobUpdate, onSavePrep, onLogActivity, onUnsavedChange }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prepTab, setPrepTab] = useState("overview");
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [openQuestion, setOpenQuestion] = useState("");
  const [openStory, setOpenStory] = useState("");
  const [interviewDetails, setInterviewDetails] = useState(() => getInterviewDetails(job, contacts));
  const [interviewSaving, setInterviewSaving] = useState(false);
  const [interviewMessage, setInterviewMessage] = useState("");
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [draftNotes, setDraftNotes] = useState(() => prep?.answer_notes ?? {});
  const [noteSaveStatus, setNoteSaveStatus] = useState({});
  const [thankYouDraft, setThankYouDraft] = useState(() => prep?.content?.thankYouMessage ?? "");
  const [lastSavedThankYou, setLastSavedThankYou] = useState(() => prep?.content?.thankYouMessage ?? "");
  const [thankYouCopied, setThankYouCopied] = useState(false);
  const [thankYouSaved, setThankYouSaved] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [mockStarted, setMockStarted] = useState(false);
  const showPrepSlowHint = useSlowLoading(loading);
  const content = prep?.content;
  const practiced = new Set(prep?.practiced_questions ?? []);
  const confident = new Set(prep?.confident_questions ?? []);
  const notes = prep?.answer_notes ?? {};

  useEffect(() => {
    setDraftNotes(prep?.answer_notes ?? {});
    setThankYouDraft(prep?.content?.thankYouMessage ?? "");
    setLastSavedThankYou(prep?.content?.thankYouMessage ?? "");
  }, [prep?.id, prep?.updated_at, prep?.content?.thankYouMessage, prep?.answer_notes]);

  useEffect(() => {
    onUnsavedChange?.(thankYouDraft !== lastSavedThankYou);
    return () => onUnsavedChange?.(false);
  }, [lastSavedThankYou, onUnsavedChange, thankYouDraft]);

  useEffect(() => {
    setInterviewDetails(getInterviewDetails(job, contacts));
  }, [job, contacts]);

  async function generatePrep() {
    if (loading) return;
    if (!canRunAi(profile)) {
      setError("Complete your profile and base resume before generating interview prep.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await generateAiOutput("interviewPrep", profile, job, {
        fitSummary: score?.summary,
        fitRecommendation: score?.recommendation,
        latestResume: resume?.content,
        contacts: contacts.map((contact) => ({ name: contact.name, title: contact.title, source: contact.source })),
      });
      await onSavePrep(user, job, { ...prep, content: result });
      setThankYouDraft(result.thankYouMessage || "");
      setLastSavedThankYou(result.thankYouMessage || "");
      setDraftNotes(prep?.answer_notes ?? {});
      toast.success("Interview prep saved.");
    } catch (err) {
      setError(err.message || "Interview prep could not be generated yet.");
      toast.error("Could not generate interview prep.");
    } finally {
      setLoading(false);
    }
  }

  async function updatePrepPatch(patch) {
    if (!prep) return;
    await onSavePrep(user, job, { ...prep, ...patch, content: patch.content ?? content, skipActivity: true });
  }

  function togglePracticed(index) {
    const next = new Set(practiced);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    updatePrepPatch({ practiced_questions: [...next] });
  }

  function markConfident(index) {
    const nextPracticed = new Set(practiced);
    nextPracticed.add(index);
    const nextConfident = new Set(confident);
    nextConfident.add(index);
    updatePrepPatch({ practiced_questions: [...nextPracticed], confident_questions: [...nextConfident] });
  }

  function saveNote(index, value) {
    setDraftNotes((current) => ({ ...current, [index]: value }));
  }

  async function persistNote(index) {
    const value = draftNotes[index] || "";
    if ((notes[index] || "") === value) return;
    setNoteSaveStatus((current) => ({ ...current, [index]: "saving" }));
    try {
      await updatePrepPatch({ answer_notes: { ...notes, [index]: value } });
      setNoteSaveStatus((current) => ({ ...current, [index]: "saved" }));
      window.setTimeout(() => {
        setNoteSaveStatus((current) => {
          if (current[index] !== "saved") return current;
          const next = { ...current };
          delete next[index];
          return next;
        });
      }, 2400);
    } catch {
      setNoteSaveStatus((current) => ({ ...current, [index]: "error" }));
      toast.error("Could not save practice notes.");
    }
  }

  async function copyThankYou() {
    if (!thankYouDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(thankYouDraft);
      setThankYouCopied(true);
      toast.success("\u2713 Thank You Message Copied");
      window.setTimeout(() => setThankYouCopied(false), 2200);
    } catch {
      toast.error("Could not copy thank-you message.");
    }
  }

  async function saveThankYouEdits() {
    if (!content || !thankYouDraft.trim()) return;
    try {
      await updatePrepPatch({ content: { ...content, thankYouMessage: thankYouDraft } });
      await onLogActivity?.(user, job.id, "interview_thank_you_generated", { detail: "Saved interview thank-you message" });
      setLastSavedThankYou(thankYouDraft);
      setThankYouSaved(true);
      toast.success("Thank-you message saved.");
      window.setTimeout(() => setThankYouSaved(false), 2600);
    } catch {
      toast.error("Could not save thank-you message.");
    }
  }

  async function markInterviewComplete() {
    try {
      await onLogActivity?.(user, job.id, "interview_completed", { detail: "Interview marked complete" });
      setInterviewCompleted(true);
      toast.success("Interview marked completed.");
    } catch {
      toast.error("Could not mark interview completed.");
    }
  }

  function updateInterviewDetail(name, value) {
    setInterviewDetails((current) => ({ ...current, [name]: value }));
  }

  async function saveInterviewDetails() {
    if (!updateJob) return;
    setInterviewSaving(true);
    setInterviewMessage("");
    try {
      const payload = {
        interview_date: interviewDetails.interview_date || null,
        interview_time: interviewDetails.interview_time || "09:00",
        interview_duration: Number(interviewDetails.interview_duration || 30),
        interview_location: interviewDetails.interview_location || "",
        interview_type: interviewDetails.interview_type || "Video",
        interviewer_contact_id: interviewDetails.interviewer_contact_id || null,
      };
      const saved = await updateJob(user, job.id, payload);
      onJobUpdate?.({ ...job, ...payload, ...saved });
      setInterviewMessage("Interview details saved.");
      toast.success("Interview details updated.");
    } catch (err) {
      setInterviewMessage(err.message || "Interview details could not be saved.");
      toast.error("Could not save interview details.");
    } finally {
      setInterviewSaving(false);
      window.setTimeout(() => setInterviewMessage(""), 2600);
    }
  }

  async function downloadInterviewCalendar() {
    const event = buildInterviewCalendarEvent(job, { ...interviewDetails, contacts });
    const downloaded = downloadIcsEvent(event);
    if (!downloaded) return;
    setInterviewMessage("Calendar file downloaded.");
    toast.success("Calendar file downloaded.");
    await onLogActivity?.(user, job.id, "interview_calendar_exported", { fileType: "ICS", date: interviewDetails.interview_date, time: interviewDetails.interview_time });
    window.setTimeout(() => setInterviewMessage(""), 2600);
  }

  async function openInterviewCalendar(provider) {
    setInterviewMessage(provider === "outlook" ? "Opening Outlook..." : "Opening Google Calendar...");
    toast.info(provider === "outlook" ? "Opening Outlook..." : "Opening Google Calendar...");
    await onLogActivity?.(user, job.id, "interview_calendar_exported", { fileType: provider === "outlook" ? "Outlook" : "Google Calendar", date: interviewDetails.interview_date, time: interviewDetails.interview_time });
    window.setTimeout(() => setInterviewMessage(""), 2200);
  }

  const scheduleCard = (
    <InterviewScheduleCard
      job={job}
      contacts={contacts}
      details={interviewDetails}
      message={interviewMessage}
      saving={interviewSaving}
      onChange={updateInterviewDetail}
      onSave={saveInterviewDetails}
      onDownload={downloadInterviewCalendar}
      onOpenCalendar={openInterviewCalendar}
      expanded={scheduleExpanded}
      onToggle={() => setScheduleExpanded((value) => !value)}
    />
  );

  if (!content) {
    return (
      <section className="grid gap-5">
        {scheduleCard}
        <div className="rounded-xl bg-white/90 p-5 shadow-card ring-1 ring-brand-100">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Interview Prep</p>
          <h3 className="mt-2 text-xl font-bold text-ink">Build a calm prep workspace for this interview.</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Generate focus areas, likely questions, talking points, STAR stories, and a thank-you message grounded in this role and your resume.</p>
          {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
          <Button className="mt-5" onClick={generatePrep} disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Preparing..." : "Generate interview prep"}
          </Button>
          {showPrepSlowHint && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">This can take a moment.</p>}
        </div>
      </section>
    );
  }

  const questions = Array.isArray(content.questions) ? content.questions : [];
  const focusAreas = Array.isArray(content.focusAreas) ? content.focusAreas : [];
  const talkingPoints = Array.isArray(content.talkingPoints) ? content.talkingPoints : [];
  const stories = Array.isArray(content.starStories) ? content.starStories : [];
  const questionsToAsk = Array.isArray(content.questionsToAsk) ? content.questionsToAsk : [];
  const concerns = getInterviewConcernAreas(score);
  const readiness = getInterviewReadinessScore({ content, practicedCount: practiced.size, interviewDetails, thankYouDraft, concerns });
  const currentPracticeQuestion = questions[practiceIndex % Math.max(questions.length, 1)];
  const cheatSheetPayload = { job, score, content, interviewDetails, questions, stories, focusAreas, questionsToAsk, concerns };

  function exportCheatSheet() {
    const exported = printInterviewCheatSheet(cheatSheetPayload);
    if (exported) toast.success("\u2713 Cheat Sheet Ready To Print");
    else toast.error("Could not open cheat sheet.");
  }

  function downloadCheatSheet() {
    const downloaded = downloadInterviewCheatSheet(cheatSheetPayload);
    if (downloaded) toast.success("\u2713 Cheat Sheet Downloaded");
    else toast.error("Could not download cheat sheet.");
  }

  return (
    <section className="grid gap-4">
      {scheduleCard}
      <div className="rounded-xl bg-white/90 p-4 shadow-card ring-1 ring-brand-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Interview Prep</p>
            <h3 className="mt-1 text-xl font-bold text-ink">{getDisplayJobTitle(job)}</h3>
            <p className="mt-1 text-sm font-semibold text-brand-800">{getDisplayCompanyName(job)}</p>
          </div>
          <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={generatePrep} disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Preparing..." : "Regenerate prep"}
          </Button>
        </div>
        {showPrepSlowHint && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">This can take a moment.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Readiness score" value={`${readiness.score}%`} />
          <Detail label="Fit score" value={score ? `${Math.round(Number(score.score))}%` : "Not analyzed"} />
          <Detail label="Interview date" value={interviewDetails.interview_date ? formatDate(interviewDetails.interview_date) : "Not scheduled"} />
          <Detail label="Preparation level" value={getPrepLevel(content, practiced.size)} />
        </div>
        {contacts[0] && <p className="mt-3 text-sm text-slate-600">Contact: <span className="font-semibold text-slate-800">{contacts[0].name}</span></p>}
        <InterviewPrepTabs active={prepTab} onSelect={setPrepTab} />
      </div>
      {prepTab === "overview" && (
        <InterviewToolkit
          focusAreas={focusAreas}
          questionsToAsk={questionsToAsk}
          onPrintCheatSheet={exportCheatSheet}
          onDownloadCheatSheet={downloadCheatSheet}
        />
      )}

      {prepTab === "overview" && (
        <InterviewPrepOverview focusAreas={focusAreas} questions={questions} readiness={readiness} concerns={concerns} />
      )}

      {prepTab === "questions" && (
        <InterviewPrepQuestions
          questions={questions}
          openQuestion={openQuestion}
          setOpenQuestion={setOpenQuestion}
          draftNotes={draftNotes}
          notes={notes}
          saveNote={saveNote}
          persistNote={persistNote}
          noteSaveStatus={noteSaveStatus}
          practiced={practiced}
          confident={confident}
          togglePracticed={togglePracticed}
          markConfident={markConfident}
          stories={stories}
        />
      )}

      {prepTab === "stories" && (
        <InterviewPrepStories stories={stories} openStory={openStory} setOpenStory={setOpenStory} talkingPoints={talkingPoints} />
      )}

      {prepTab === "research" && (
        <InterviewPrepResearch job={job} focusAreas={focusAreas} questionsToAsk={questionsToAsk} />
      )}

      {prepTab === "practice" && (
        <InterviewPrepPractice
          question={currentPracticeQuestion}
          questionIndex={practiceIndex % Math.max(questions.length, 1)}
          totalQuestions={questions.length}
          practiced={practiced}
          confident={confident}
          onMarkPracticed={togglePracticed}
          onMarkConfident={markConfident}
          onNext={() => setPracticeIndex((index) => (questions.length ? (index + 1) % questions.length : 0))}
          onRandom={() => setPracticeIndex(() => (questions.length ? Math.floor(Math.random() * questions.length) : 0))}
          mockStarted={mockStarted}
          onStart={() => setMockStarted(true)}
          thankYouCopied={thankYouCopied}
          thankYouSaved={thankYouSaved}
          interviewCompleted={interviewCompleted}
          thankYouDraft={thankYouDraft}
          setThankYouDraft={setThankYouDraft}
          copyThankYou={copyThankYou}
          saveThankYouEdits={saveThankYouEdits}
          markInterviewComplete={markInterviewComplete}
          lastSavedThankYou={lastSavedThankYou}
        />
      )}
    </section>
  );
}

function NoteSaveStatus({ status }) {
  const label = {
    saving: "Saving...",
    saved: "Saved",
    error: "Could not save",
  }[status];
  const tone = {
    saving: "text-brand-700",
    saved: "text-emerald-700",
    error: "text-rose-700",
  }[status];
  return <p className={`text-xs font-semibold transition ${tone}`}>{label}</p>;
}

function InterviewPrepTabs({ active, onSelect }) {
  const tabs = [
    ["overview", "Overview"],
    ["questions", "Questions"],
    ["stories", "Stories"],
    ["research", "Research"],
    ["practice", "Practice"],
  ];
  return (
    <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Interview Prep sections">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${
            active === id ? "bg-brand-700 text-white shadow-sm" : "bg-brand-50 text-brand-800 ring-1 ring-brand-100 hover:bg-brand-100"
          }`}
          onClick={() => onSelect(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function InterviewToolkit({ focusAreas, questionsToAsk, onPrintCheatSheet, onDownloadCheatSheet }) {
  const talkingPointsText = focusAreas.map((area) => area.emphasize || area.title).filter(Boolean).join("\n");
  const questionsText = questionsToAsk.map((question) => question).filter(Boolean).join("\n");
  return (
    <section className="rounded-xl bg-emerald-50/80 p-4 shadow-card ring-1 ring-emerald-100">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-emerald-700 ring-1 ring-emerald-100">
            <CheckCircle2 size={17} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Before Your Interview</p>
            <h3 className="mt-1 text-lg font-black text-ink">Interview Toolkit</h3>
            <p className="mt-1 text-sm leading-6 text-slate-700">Quick-access preparation tools.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-8 px-3 text-xs" onClick={onDownloadCheatSheet}>
            <Download size={13} /> Download Cheat Sheet
          </Button>
          <Button className="min-h-8 px-3 text-xs" onClick={onPrintCheatSheet}>Print Cheat Sheet</Button>
          <CopyButton text={talkingPointsText || "No talking points available yet."} label="Copy Talking Points" variant="ghost" successMessage={"\u2713 Talking Points Copied"} />
          <CopyButton text={questionsText || "No questions available yet."} label="Copy Questions To Ask" variant="ghost" successMessage={"\u2713 Questions Copied"} />
        </div>
      </div>
    </section>
  );
}

function InterviewPrepOverview({ focusAreas, questions, readiness, concerns }) {
  const fastestWays = getFastestInterviewImprovements(readiness, concerns, questions);
  return (
    <section className="grid gap-4">
      <PrepSection title="Interview Readiness">
        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
          <div>
            <p className="text-4xl font-black text-brand-900">{readiness.score}%</p>
            <p className="mt-1 text-sm font-bold text-slate-700">{readiness.label}</p>
          </div>
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${readiness.score}% interview readiness`}>
              <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${readiness.score}%` }} />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{readiness.description}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {Object.entries(readiness.subscores).map(([label, value]) => (
            <ReadinessSubscore key={label} label={label} value={value} />
          ))}
        </div>
      </PrepSection>
      <PrepSection title="Fastest Way To Improve">
        <div className="grid gap-2 md:grid-cols-3">
          {fastestWays.map((item) => (
            <div key={item} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold leading-6 text-emerald-900 ring-1 ring-emerald-100">{item}</div>
          ))}
        </div>
      </PrepSection>
      <PrepSection title="Likely Focus Areas">
        <div className="grid gap-3 md:grid-cols-2">
          {focusAreas.slice(0, 6).map((area) => (
            <div key={area.title || area.emphasize} className="rounded-lg bg-brand-50/80 p-3">
              <p className="font-bold text-ink">{area.title}</p>
              <p className="mt-1 text-sm leading-5 text-slate-600">{area.whyItMatters}</p>
              {area.emphasize && <p className="mt-2 text-xs font-semibold text-brand-800">Emphasize: {area.emphasize}</p>}
            </div>
          ))}
        </div>
      </PrepSection>
      <PrepSection title="Potential Concern Areas">
        {concerns.length ? (
          <div className="grid gap-3">
            {concerns.map((concern) => <InterviewConcernCard key={concern.id} concern={concern} />)}
          </div>
        ) : (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">No major interview risk areas were identified from the current analysis.</p>
        )}
      </PrepSection>
    </section>
  );
}

function InterviewPrepQuestions({ questions, openQuestion, setOpenQuestion, draftNotes, notes, saveNote, persistNote, noteSaveStatus, practiced, confident, togglePracticed, markConfident, stories }) {
  const grouped = groupInterviewQuestions(questions);
  return (
    <PrepSection title="Top Interview Questions">
      <div className="mb-3 rounded-lg bg-white p-3 ring-1 ring-brand-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-ink">Questions Practiced</p>
          <p className="text-sm font-black text-brand-900">{practiced.size} / {questions.length}</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${practiced.size} of ${questions.length} questions practiced`}>
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${questions.length ? Math.round((practiced.size / questions.length) * 100) : 0}%` }} />
        </div>
      </div>
      <div className="grid gap-4">
        {grouped.map((group) => (
          <div key={group.label} className="grid gap-2">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{group.label}</p>
            {group.items.map(({ question, index }) => {
              const relatedStory = getRelatedStory(question, stories);
              return (
                <div key={`${question.category}-${question.question}`} className="rounded-lg bg-brand-50/70 p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_96px] items-start gap-3">
                    <button type="button" className="min-w-0 text-left" onClick={() => setOpenQuestion(openQuestion === index ? "" : index)} aria-expanded={openQuestion === index}>
                      <span>
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-600">{question.category || "Interview"}</span>
                      <span className="mt-1 block font-bold text-ink">{question.question}</span>
                      <span className="mt-1 block text-xs font-semibold text-slate-600">Question {index + 1}</span>
                      {relatedStory && <span className="mt-1 block text-xs font-semibold text-emerald-700">Related story: {relatedStory.title}</span>}
                      </span>
                    </button>
                    <div className="grid justify-items-end gap-2">
                      <QuestionStatusChip index={index} practiced={practiced} confident={confident} />
                      <button
                        type="button"
                        className="inline-flex w-24 shrink-0 justify-center whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-800 ring-1 ring-brand-100 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
                        onClick={() => setOpenQuestion(openQuestion === index ? "" : index)}
                        aria-expanded={openQuestion === index}
                      >
                        {openQuestion === index ? "Close ▴" : "Open ▾"}
                      </button>
                    </div>
                  </div>
                  {openQuestion === index && (
                    <div className="mt-3 grid gap-3">
                      <div className="grid gap-2 md:grid-cols-3">
                        <PrepInfoBlock label="Why they ask it" value={question.whyTheyAsk || getQuestionWhy(question)} />
                        <PrepInfoBlock label="What they are evaluating" value={question.evaluating || getQuestionEvaluation(question)} />
                        <PrepInfoBlock label="Suggested answer direction" value={question.guidance} />
                      </div>
                      <div className="grid gap-1">
                        <textarea className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" rows="2" placeholder="Optional answer notes" value={draftNotes[index] ?? notes[index] ?? ""} onChange={(event) => saveNote(index, event.target.value)} onBlur={() => persistNote(index)} />
                        {noteSaveStatus[index] && <NoteSaveStatus status={noteSaveStatus[index]} />}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant={practiced.has(index) ? "primary" : "secondary"} className="w-fit min-h-8 px-3 text-xs" onClick={() => togglePracticed(index)}>{practiced.has(index) ? "Practiced" : "Mark practiced"}</Button>
                        <Button variant={confident.has(index) ? "primary" : "secondary"} className="w-fit min-h-8 px-3 text-xs" onClick={() => markConfident(index)}>{confident.has(index) ? "Confident" : "Mark confident"}</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </PrepSection>
  );
}

function InterviewPrepStories({ stories, openStory, setOpenStory, talkingPoints }) {
  return (
    <section className="grid gap-4">
      <PrepSection title="Recommended Stories">
        <div className="grid gap-3">
          {stories.map((story, index) => (
            <div key={story.title} className="rounded-lg bg-white p-3 ring-1 ring-brand-100">
              <button type="button" className="flex w-full items-center justify-between gap-3 text-left font-bold" onClick={() => setOpenStory(openStory === index ? "" : index)} aria-expanded={openStory === index}>
                <span>{story.title}</span>
                <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800 ring-1 ring-emerald-100">{"\u2713"} Interview Ready</span>
              </button>
              <div className="mt-2 flex flex-wrap gap-2">
                {getStoryTags(story).map((tag) => <span key={tag} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-100">{tag}</span>)}
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-100">{getStoryConfidence(story)} confidence</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <PrepInfoBlock label="Best used for" value={getStoryUseCases(story)} />
                <PrepInfoBlock label="Strengths demonstrated" value={getStoryStrengths(story, talkingPoints)} />
              </div>
              {openStory === index && (
                <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
                  <p><strong>Situation:</strong> {story.situation}</p>
                  <p><strong>Task:</strong> {story.task}</p>
                  <p><strong>Action:</strong> {story.action}</p>
                  <p><strong>Result:</strong> {story.result}</p>
                  <div className="rounded-lg bg-brand-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand-700">Follow-up questions recruiters may ask</p>
                    <ul className="mt-2 grid gap-1">
                      {getStoryFollowUps(story).map((question) => <li key={question}>- {question}</li>)}
                    </ul>
                  </div>
                  <CopyButton text={`Situation: ${story.situation}\nTask: ${story.task}\nAction: ${story.action}\nResult: ${story.result}`} />
                </div>
              )}
            </div>
          ))}
        </div>
      </PrepSection>
      <PrepSection title="Best Talking Points">
        <ul className="grid gap-2">
          {talkingPoints.map((point) => <li key={point} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold leading-6 text-emerald-900">{point}</li>)}
        </ul>
      </PrepSection>
    </section>
  );
}

function InterviewPrepResearch({ job, focusAreas, questionsToAsk }) {
  return (
    <section className="grid gap-4">
      <PrepSection title="Company Snapshot">
        <p className="text-sm leading-6 text-slate-700">{getDisplayCompanyName(job)} is the hiring context for this role. Use the job description and company materials to connect your systems, implementation, and stakeholder examples to the team&apos;s operating needs.</p>
      </PrepSection>
      <PrepSection title="Likely Role Objectives">
        <ul className="grid gap-2">
          {getLikelyRoleObjectives(job, focusAreas).map((objective) => <li key={objective} className="rounded-lg bg-brand-50 px-3 py-2 text-sm leading-6 text-slate-700">{objective}</li>)}
        </ul>
      </PrepSection>
      <PrepSection title="What They Care About">
        <ul className="grid gap-2">
          {getKeyResponsibilities(job, focusAreas).map((item) => <li key={item} className="rounded-lg bg-white px-3 py-2 text-sm leading-6 text-slate-700 ring-1 ring-brand-100">{item}</li>)}
        </ul>
      </PrepSection>
      <PrepSection title="Likely Success Metrics">
        <ul className="grid gap-2 md:grid-cols-2">
          {getLikelySuccessMetrics(job).map((item) => <li key={item} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold leading-6 text-emerald-900 ring-1 ring-emerald-100">{item}</li>)}
        </ul>
      </PrepSection>
      <PrepSection title="How Your Experience Connects">
        <div className="grid gap-2">
          {getExperienceConnections(job, focusAreas).map((item) => <PrepInfoBlock key={item.label} label={item.label} value={item.value} />)}
        </div>
      </PrepSection>
      <PrepSection title="Suggested Questions To Ask">
        <ul className="grid gap-2">
          {questionsToAsk.map((question) => <li key={question} className="rounded-lg bg-white px-3 py-2 text-sm leading-6 text-slate-700 ring-1 ring-brand-100">{question}</li>)}
        </ul>
      </PrepSection>
    </section>
  );
}

function InterviewPrepPractice({ question, questionIndex, totalQuestions, practiced, confident, onMarkPracticed, onMarkConfident, onNext, onRandom, mockStarted, onStart, thankYouCopied, thankYouSaved, interviewCompleted, thankYouDraft, setThankYouDraft, copyThankYou, saveThankYouEdits, markInterviewComplete, lastSavedThankYou }) {
  return (
    <section className="grid gap-4">
      <PrepSection title="Mock Interview Practice">
        <div className="mb-3 rounded-lg bg-white p-3 ring-1 ring-brand-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-ink">Mock Interview Progress</p>
            <p className="text-sm font-black text-brand-900">{practiced.size} / {totalQuestions} Questions Practiced</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${practiced.size} of ${totalQuestions} questions practiced`}>
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${totalQuestions ? Math.round((practiced.size / totalQuestions) * 100) : 0}%` }} />
          </div>
        </div>
        {question ? (
          <div className="rounded-xl bg-brand-50/70 p-4 ring-1 ring-brand-100">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-700">Question {questionIndex + 1} of {totalQuestions}</p>
            <h3 className="mt-2 text-lg font-black text-ink">{question.question}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-700">{question.guidance}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {!mockStarted && <Button className="min-h-8 px-3 text-xs" onClick={onStart}>Start Mock Interview</Button>}
              <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={onRandom}>Random Question</Button>
              <Button variant={practiced.has(questionIndex) ? "primary" : "secondary"} className="min-h-8 px-3 text-xs" onClick={() => onMarkPracticed(questionIndex)}>{practiced.has(questionIndex) ? "Practiced" : "Mark practiced"}</Button>
              <Button variant={confident.has(questionIndex) ? "primary" : "secondary"} className="min-h-8 px-3 text-xs" onClick={() => onMarkConfident(questionIndex)}>{confident.has(questionIndex) ? "Confident" : "Mark confident"}</Button>
              <Button className="min-h-8 px-3 text-xs" onClick={onNext}>Next question</Button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-slate-700">Generate interview prep to practice likely questions.</p>
        )}
      </PrepSection>
      <PrepSection title="Post-Interview Follow-up">
        {(thankYouCopied || thankYouSaved || interviewCompleted) && (
          <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            {interviewCompleted ? "Interview marked completed" : thankYouCopied ? "Thank-you message copied" : "Thank-you message saved"}
          </p>
        )}
        <textarea className="min-h-32 w-full rounded-lg border border-brand-100 bg-white p-3 text-sm leading-6 text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={thankYouDraft} onChange={(event) => setThankYouDraft(event.target.value)} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="min-h-8 px-3 text-xs" onClick={copyThankYou}>{thankYouCopied ? "Copied" : "Copy thank-you message"}</Button>
          <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={saveThankYouEdits}>Save edits</Button>
          <Button variant={interviewCompleted ? "primary" : "secondary"} className="min-h-8 px-3 text-xs" onClick={markInterviewComplete} disabled={interviewCompleted}>{interviewCompleted ? "Interview completed" : "Log interview completed"}</Button>
          {thankYouDraft !== lastSavedThankYou && <span className="self-center text-xs font-semibold text-amber-700">Unsaved changes</span>}
        </div>
      </PrepSection>
    </section>
  );
}

function PrepInfoBlock({ label, value }) {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-brand-100">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-700">{value || "Use a concise example grounded in your resume."}</p>
    </div>
  );
}

function ReadinessSubscore({ label, value }) {
  const display = label.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
  const tone = getReadinessSubscoreTone(value);
  return (
    <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{display}</p>
        <p className={`text-sm font-black ${tone.text}`}>{value}%</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white" aria-label={`${display} readiness ${value}%`}>
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function getReadinessSubscoreTone(value) {
  if (value >= 90) return { text: "text-emerald-700", bar: "bg-emerald-500" };
  if (value >= 75) return { text: "text-amber-700", bar: "bg-amber-500" };
  return { text: "text-rose-700", bar: "bg-rose-500" };
}

function InterviewConcernCard({ concern }) {
  return (
    <article className="rounded-lg bg-white p-3 ring-1 ring-amber-100">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-ink">{concern.title}</p>
          <p className="mt-1 text-xs font-semibold text-amber-700">Confidence: {concern.confidence}</p>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-100">{concern.severity}</span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <PrepInfoBlock label="Why it may come up" value={concern.why} />
        <PrepInfoBlock label="How to address it" value={concern.how} />
      </div>
    </article>
  );
}

function QuestionStatusChip({ index, practiced, confident }) {
  const status = getQuestionStatus(index, practiced, confident);
  const tone = confident.has(index)
    ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
    : practiced.has(index)
      ? "bg-brand-50 text-brand-800 ring-brand-100"
      : "bg-slate-50 text-slate-600 ring-slate-100";
  return (
    <span className={`inline-flex w-28 justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${tone}`}>
      {status}
    </span>
  );
}

function InterviewScheduleCard({ job, contacts, details, message, saving, onChange, onSave, onDownload, onOpenCalendar, expanded, onToggle }) {
  const calendarEvent = details.interview_date ? buildInterviewCalendarEvent(job, { ...details, contacts }) : null;
  return (
    <section className="rounded-xl bg-white/90 p-4 shadow-card ring-1 ring-brand-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Interview Schedule</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-ink"><CalendarDays size={18} /> Schedule & Calendar Handoff</h3>
          <p className="mt-1 text-sm text-slate-600">Optional interview scheduling details.</p>
        </div>
        <button
          type="button"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-800 ring-1 ring-brand-100 transition hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {expanded ? "Collapse ^" : "Expand v"}
        </button>
      </div>
      {expanded && <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Date
          <input className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" type="date" value={details.interview_date} onChange={(event) => onChange("interview_date", event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Time
          <input className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" type="time" value={details.interview_time} onChange={(event) => onChange("interview_time", event.target.value || "09:00")} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Duration
          <select className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={details.interview_duration} onChange={(event) => onChange("interview_duration", event.target.value)}>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Type
          <select className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={details.interview_type} onChange={(event) => onChange("interview_type", event.target.value)}>
            <option>Phone</option>
            <option>Video</option>
            <option>In person</option>
            <option>Other</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink lg:col-span-2">
          Location or link
          <input className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={details.interview_location} onChange={(event) => onChange("interview_location", event.target.value)} placeholder="Video link, phone number, or address" />
        </label>
        {contacts.length > 0 && (
          <label className="grid gap-1 text-sm font-semibold text-ink lg:col-span-3">
            Interviewer/contact
            <select className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={details.interviewer_contact_id} onChange={(event) => onChange("interviewer_contact_id", event.target.value)}>
              <option value="">No contact selected</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name || contact.email || "Contact"}</option>)}
            </select>
          </label>
        )}
      </div>}
      {expanded && <div className="mt-4 flex flex-wrap gap-2">
        <Button className="min-h-8 px-3 text-xs" onClick={onSave} disabled={saving}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving..." : "Save interview details"}
        </Button>
        {calendarEvent ? (
          <>
            <a className="inline-flex min-h-8 items-center justify-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-50 hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100" href={buildGoogleCalendarUrl(calendarEvent)} target="_blank" rel="noreferrer" onClick={() => onOpenCalendar("google")}>Google Calendar <ExternalLink size={13} /></a>
            <a className="inline-flex min-h-8 items-center justify-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-50 hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100" href={buildOutlookCalendarUrl(calendarEvent)} target="_blank" rel="noreferrer" onClick={() => onOpenCalendar("outlook")}>Outlook <ExternalLink size={13} /></a>
            <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={onDownload}><Download size={13} /> Download .ics</Button>
          </>
        ) : (
          <Button variant="secondary" className="min-h-8 px-3 text-xs" disabled>Set a date first</Button>
        )}
      </div>}
      {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p>}
    </section>
  );
}

function PrepSection({ title, children }) {
  return (
    <section className="rounded-xl bg-white/85 p-4 shadow-sm ring-1 ring-brand-100 sm:p-5">
      <h3 className="font-bold text-ink">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function getPrepLevel(content, practicedCount) {
  if (practicedCount >= Math.min(3, content.questions.length)) return "Ready";
  if (content) return "In progress";
  return "Not started";
}

function getInterviewReadinessScore({ content, practicedCount, interviewDetails, thankYouDraft, concerns = [] }) {
  const questionCount = Array.isArray(content?.questions) ? content.questions.length : 0;
  const storyCount = Array.isArray(content?.starStories) ? content.starStories.length : 0;
  const focusCount = Array.isArray(content?.focusAreas) ? content.focusAreas.length : 0;
  const practicedRatio = questionCount ? Math.min(practicedCount / Math.min(questionCount, 4), 1) : 0;
  const subscores = {
    research: Math.min(100, 35 + focusCount * 12 + (interviewDetails.interview_date ? 15 : 0)),
    stories: Math.min(100, 25 + storyCount * 18),
    questions: Math.min(100, 35 + questionCount * 8 + Math.round(practicedRatio * 25)),
    riskMitigation: Math.min(100, concerns.length ? 45 + Math.max(0, 4 - concerns.length) * 10 + focusCount * 4 : 92),
  };
  const score =
    Math.round((subscores.research + subscores.stories + subscores.questions + subscores.riskMitigation) / 4) +
    (thankYouDraft?.trim() ? 3 : 0);
  const clamped = Math.min(100, score);
  return {
    score: clamped,
    subscores,
    label: clamped >= 85 ? "Ready" : clamped >= 70 ? "In progress" : "Getting prepared",
    description: clamped >= 85
      ? "Core focus areas, questions, stories, and follow-up support are in place."
      : "Prep is structured. Practice the strongest questions and tighten your examples before the interview.",
  };
}

function getInterviewConcernAreas(score = {}) {
  const raw = [
    ...(Array.isArray(score?.gapAssessments) ? score.gapAssessments : []),
    ...(Array.isArray(score?.gap_assessments) ? score.gap_assessments : []),
    ...(Array.isArray(score?.gaps) ? score.gaps : []),
  ];
  return raw
    .map((item, index) => normalizeInterviewConcern(item, index))
    .filter((item) => item && !["minor", "informational", "info"].includes(String(item.severity).toLowerCase()))
    .slice(0, 4);
}

function normalizeInterviewConcern(item, index) {
  const text = typeof item === "string" ? item : item?.gap || item?.text || item?.title || "";
  if (!text.trim()) return null;
  const severity = formatConcernSeverity(item?.severity || inferConcernSeverity(text));
  const confidence = formatConcernConfidence(item?.confidence || "Moderate");
  const suggestions = item?.mitigationSuggestions || item?.mitigation_suggestions || item?.suggestions || [];
  return {
    id: item?.id || `interview-concern-${index}`,
    title: text,
    severity,
    confidence,
    why: item?.whyItMatters || item?.why || getConcernWhy(text),
    how: suggestions[0] || item?.howToAddress || getConcernHow(text),
  };
}

function formatConcernSeverity(value = "") {
  const normalized = String(value || "moderate").toLowerCase();
  if (normalized === "critical") return "Critical";
  if (normalized === "high") return "High";
  return "Moderate";
}

function formatConcernConfidence(value = "") {
  const normalized = String(value || "moderate").toLowerCase();
  if (normalized.includes("strong") || normalized.includes("high")) return "High";
  if (normalized.includes("partial") || normalized.includes("low")) return "Partial";
  return "Moderate";
}

function inferConcernSeverity(text = "") {
  const lower = text.toLowerCase();
  if (lower.includes("missing") || lower.includes("no direct") || lower.includes("limited direct")) return "moderate";
  return "minor";
}

function getConcernWhy(text = "") {
  const lower = text.toLowerCase();
  if (lower.includes("ticket") || lower.includes("itsm") || lower.includes("service")) return "Interviewers may test whether your support and issue-tracking experience maps to their intake or service workflows.";
  if (lower.includes("uat") || lower.includes("testing") || lower.includes("validation")) return "They may ask how you validate workflows before launch or confirm stakeholder acceptance.";
  if (lower.includes("platform") || lower.includes("buildops") || lower.includes("sage")) return "Vendor-specific tools can come up as a ramp-up concern even when adjacent systems experience is strong.";
  return "This may come up as a clarification point during screening or deeper interview questions.";
}

function getConcernHow(text = "") {
  const lower = text.toLowerCase();
  if (lower.includes("ticket") || lower.includes("itsm") || lower.includes("service")) return "Use Jira, escalation coordination, issue follow-through, and implementation support examples without overstating formal ITSM ownership.";
  if (lower.includes("uat") || lower.includes("testing") || lower.includes("validation")) return "Prepare a go-live readiness or workflow validation example from implementation work.";
  if (lower.includes("platform") || lower.includes("buildops") || lower.includes("sage")) return "Position adjacent ERP, CRM, and workflow-tool experience as evidence that you can ramp quickly.";
  return "Prepare a concise, factual example that frames adjacent experience clearly.";
}

function getQuestionLikelihood(index) {
  if (index < 3) return "High";
  if (index < 6) return "Medium";
  return "Possible";
}

function groupInterviewQuestions(questions = []) {
  const groups = [
    { label: "Very Likely", items: [] },
    { label: "Likely", items: [] },
    { label: "Possible", items: [] },
  ];
  questions.forEach((question, index) => {
    const likelihood = String(question.likelihood || getQuestionLikelihood(index)).toLowerCase();
    const target = likelihood.includes("very") || likelihood.includes("high") ? groups[0] : likelihood.includes("possible") || likelihood.includes("low") ? groups[2] : groups[1];
    target.items.push({ question, index });
  });
  return groups.filter((group) => group.items.length);
}

function getQuestionWhy(question = {}) {
  const category = String(question.category || "").toLowerCase();
  if (category.includes("behavior")) return "This checks communication style, ownership, and judgment under realistic workplace pressure.";
  if (category.includes("technical")) return "This checks whether your systems experience transfers to the tools and workflows in the role.";
  if (category.includes("fit")) return "This helps the interviewer understand motivation, collaboration style, and team alignment.";
  return "This connects the role requirements to your strongest examples and working style.";
}

function getQuestionEvaluation(question = {}) {
  const category = String(question.category || "").toLowerCase();
  if (category.includes("behavior")) return "Ownership, communication, self-awareness, and how you handle ambiguity.";
  if (category.includes("technical")) return "Practical systems fluency, troubleshooting approach, and ability to explain tradeoffs.";
  if (category.includes("role")) return "Direct alignment with the responsibilities and pace of the job.";
  return "Whether your examples are specific, relevant, and grounded in real outcomes.";
}

function getQuestionStatus(index, practiced, confident) {
  if (confident.has(index)) return "Confident";
  if (practiced.has(index)) return "Practiced";
  return "Not Practiced";
}

function getRelatedStory(question = {}, stories = []) {
  if (!stories.length) return null;
  const questionText = `${question.question || ""} ${question.category || ""}`.toLowerCase();
  return stories.find((story) => {
    const storyText = `${story.title || ""} ${story.situation || ""} ${story.action || ""}`.toLowerCase();
    return questionText.split(/\W+/).filter((word) => word.length > 5).some((word) => storyText.includes(word));
  }) || stories[0];
}

function getFastestInterviewImprovements(readiness, concerns = [], questions = []) {
  const items = [];
  if (readiness.subscores.stories < 80) items.push("Choose two STAR stories and practice the results out loud.");
  if (readiness.subscores.questions < 80 || questions.length) items.push("Practice the first three very likely questions.");
  if (concerns.length) items.push(`Prepare a concise answer for: ${concerns[0].title}`);
  if (!items.length) items.push("Do one quick mock pass, then review your questions for the interviewer.");
  return items.slice(0, 3);
}

function getStoryUseCases(story = {}) {
  const text = `${story.title || ""} ${story.action || ""}`.toLowerCase();
  if (text.includes("implementation") || text.includes("launch")) return "Implementation, rollout, ownership, stakeholder coordination";
  if (text.includes("customer") || text.includes("client")) return "Client communication, support recovery, expectation setting";
  if (text.includes("data") || text.includes("system")) return "Systems coordination, data/process quality, operational problem solving";
  return "Behavioral examples, ownership questions, cross-functional collaboration";
}

function getStoryTags(story = {}) {
  const text = `${story.title || ""} ${story.situation || ""} ${story.action || ""}`.toLowerCase();
  const tags = [];
  if (text.includes("implementation") || text.includes("launch")) tags.push("Implementation");
  if (text.includes("client") || text.includes("customer")) tags.push("Client-facing");
  if (text.includes("system") || text.includes("data")) tags.push("Systems");
  if (text.includes("document") || text.includes("training")) tags.push("Documentation");
  return tags.length ? tags.slice(0, 4) : ["Ownership", "Execution"];
}

function getStoryConfidence(story = {}) {
  const fields = [story.situation, story.task, story.action, story.result].filter((value) => String(value || "").trim().length > 20).length;
  if (fields >= 4) return "High";
  if (fields >= 2) return "Moderate";
  return "Draft";
}

function getStoryFollowUps(story = {}) {
  if (Array.isArray(story.followUpQuestions) && story.followUpQuestions.length) return story.followUpQuestions.slice(0, 3);
  if (Array.isArray(story.follow_up_questions) && story.follow_up_questions.length) return story.follow_up_questions.slice(0, 3);
  return [
    "What was the hardest part of that situation?",
    "How did you measure or confirm the outcome?",
    "What would you do differently next time?",
  ];
}

function getStoryStrengths(story = {}, talkingPoints = []) {
  if (talkingPoints.length) return talkingPoints.slice(0, 2).join("; ");
  const text = `${story.action || ""} ${story.result || ""}`.toLowerCase();
  if (text.includes("document")) return "Documentation, enablement, follow-through";
  if (text.includes("stakeholder")) return "Stakeholder communication, prioritization";
  return "Ownership, communication, practical execution";
}

function getLikelyRoleObjectives(job = {}, focusAreas = []) {
  const title = getDisplayJobTitle(job).toLowerCase();
  const objectives = [];
  if (title.includes("system") || title.includes("implementation")) objectives.push("Coordinate systems, workflows, and implementation details across stakeholders.");
  if (title.includes("client") || title.includes("customer")) objectives.push("Support customer-facing communication, onboarding, and issue follow-through.");
  objectives.push(...focusAreas.slice(0, 3).map((area) => area.emphasize || area.title).filter(Boolean));
  return [...new Set(objectives)].slice(0, 5);
}

function getKeyResponsibilities(job = {}, focusAreas = []) {
  const description = String(job.job_description || "").toLowerCase();
  const responsibilities = [];
  if (description.includes("implement") || description.includes("onboard")) responsibilities.push("Own implementation, onboarding, or rollout coordination details.");
  if (description.includes("support") || description.includes("ticket")) responsibilities.push("Coordinate issue follow-through, support requests, and stakeholder communication.");
  if (description.includes("document") || description.includes("training")) responsibilities.push("Create documentation, training, or enablement materials that make workflows repeatable.");
  responsibilities.push(...focusAreas.slice(0, 3).map((area) => area.title || area.emphasize).filter(Boolean));
  return [...new Set(responsibilities)].slice(0, 6);
}

function getLikelySuccessMetrics(job = {}) {
  const description = String(job.job_description || "").toLowerCase();
  const metrics = ["Clear stakeholder communication", "Reliable follow-through on assigned work"];
  if (description.includes("implementation") || description.includes("onboarding")) metrics.unshift("Successful go-live or onboarding milestones");
  if (description.includes("support") || description.includes("ticket")) metrics.unshift("Timely issue resolution and escalation clarity");
  if (description.includes("process") || description.includes("workflow")) metrics.unshift("Cleaner workflows and fewer handoff gaps");
  return [...new Set(metrics)].slice(0, 5);
}

function getExperienceConnections(job = {}, focusAreas = []) {
  const title = getDisplayJobTitle(job);
  const firstFocus = focusAreas[0]?.title || "role priorities";
  return [
    { label: "Role need", value: `${title} will likely require practical coordination across systems, people, and follow-through.` },
    { label: "Experience bridge", value: `Connect your SaaS implementation, onboarding, documentation, and workflow coordination examples to ${firstFocus}.` },
    { label: "Interview framing", value: "Use concrete examples that show what you owned, who depended on it, and how you kept the work moving." },
  ];
}

function printInterviewCheatSheet({ job, score, content, interviewDetails, questions, stories, focusAreas, questionsToAsk, concerns }) {
  const preview = window.open("", "_blank", "width=900,height=1100");
  if (!preview) return false;
  const html = buildInterviewCheatSheetHtml({ job, score, content, interviewDetails, questions, stories, focusAreas, questionsToAsk, concerns });
  preview.document.open();
  preview.document.write(html);
  preview.document.close();
  const printWhenReady = () => {
    preview.focus();
    preview.print();
  };
  preview.addEventListener?.("load", () => window.setTimeout(printWhenReady, 150), { once: true });
  window.setTimeout(printWhenReady, 800);
  return true;
}

function downloadInterviewCheatSheet(payload) {
  const html = buildInterviewCheatSheetHtml(payload);
  const blob = new window.Blob([html], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = `interview-cheat-sheet-${slugify(getDisplayJobTitle(payload.job))}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(link.href);
  return true;
}

function buildInterviewCheatSheetHtml({ job, score, content, interviewDetails, questions, stories, focusAreas, questionsToAsk, concerns }) {
  const topStrengths = [
    ...(Array.isArray(score?.strengths) ? score.strengths : []),
    ...(Array.isArray(content?.talkingPoints) ? content.talkingPoints : []),
  ].filter(Boolean).slice(0, 5);
  return `
    <!doctype html>
    <html>
      <head>
        <title>Interview Cheat Sheet - ${escapeHtml(getDisplayJobTitle(job))}</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; color: #172033; margin: 32px; line-height: 1.45; }
          h1 { font-size: 24px; margin: 0 0 4px; }
          h2 { font-size: 13px; margin: 22px 0 8px; text-transform: uppercase; letter-spacing: .08em; color: #0f5ea8; }
          p { margin: 0 0 6px; }
          ul { margin: 0; padding-left: 18px; }
          li { margin: 4px 0; }
          .meta { color: #5b677a; font-size: 13px; margin-bottom: 18px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .card { border: 1px solid #d9e6f2; border-radius: 10px; padding: 12px; break-inside: avoid; }
          .label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .08em; }
          @media print { body { margin: 18mm; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <button class="no-print" onclick="window.print()" style="float:right;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-weight:700;">Print</button>
        <h1>${escapeHtml(getDisplayJobTitle(job))}</h1>
        <p class="meta">${escapeHtml(getDisplayCompanyName(job))} ${interviewDetails.interview_date ? `- Interview ${escapeHtml(formatDate(interviewDetails.interview_date))}` : ""}</p>
        <div class="grid">
          <section class="card">
            <h2>Top strengths</h2>
            ${renderPrintList(topStrengths)}
          </section>
          <section class="card">
            <h2>Risks to manage</h2>
            ${renderPrintList(concerns.map((concern) => `${concern.title}: ${concern.how}`))}
          </section>
          <section class="card">
            <h2>Top questions</h2>
            ${renderPrintList(questions.slice(0, 5).map((question) => question.question))}
          </section>
          <section class="card">
            <h2>Best stories</h2>
            ${renderPrintList(stories.slice(0, 4).map((story) => `${story.title} - ${getStoryUseCases(story)}`))}
          </section>
          <section class="card">
            <h2>Likely focus areas</h2>
            ${renderPrintList(focusAreas.slice(0, 5).map((area) => area.title || area.emphasize))}
          </section>
          <section class="card">
            <h2>Questions to ask</h2>
            ${renderPrintList(questionsToAsk.slice(0, 5))}
          </section>
        </div>
      </body>
    </html>
  `;
}

function renderPrintList(items = []) {
  const clean = items.filter(Boolean);
  if (!clean.length) return "<p>No items available yet.</p>";
  return `<ul>${clean.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slugify(value = "") {
  return String(value || "interview")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "interview";
}

function getInterviewDetails(job = {}, contacts = []) {
  return {
    interview_date: job.interview_date || "",
    interview_time: job.interview_time || "09:00",
    interview_duration: String(job.interview_duration || 30),
    interview_location: job.interview_location || "",
    interview_type: job.interview_type || "Video",
    interviewer_contact_id: job.interviewer_contact_id || contacts[0]?.id || "",
  };
}

function JobActivityTimeline({ events = [] }) {
  const sorted = collapseQuietActivityEvents(events).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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

function collapseQuietActivityEvents(events = []) {
  const quietTypes = new Set(["cover_letter_edited", "job_edited", "interview_thank_you_generated"]);
  const seen = new Set();
  return [...events]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .filter((event) => {
      if (!quietTypes.has(event.type)) return true;
      const day = event.created_at ? new Date(event.created_at).toDateString() : "unknown";
      const key = `${event.job_id}-${event.type}-${day}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
      type: message.type === "Follow-up Message" ? "followup_message_generated" : message.type === "Cover Letter" ? "cover_letter_generated" : "message_generated",
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
    user: User,
    archive: Archive,
    circle: Circle,
  }[getActivityIcon(type)] ?? Circle;
}

function formatDateTime(value) {
  if (!value) return "Not dated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not dated";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function WorkspaceRail({ activeTab, completed, score, onSelect }) {
  const groups = [
    ["Prepare", [
      ["overview", "Overview"],
      ["fit", "Analysis"],
    ]],
    ["Materials", [
      ["resume", "Resume"],
      ["coverLetter", "Cover Letter"],
      ["message", "Recruiter Message"],
    ]],
    ["Strategy", [
      ["recruiterView", "Recruiter View"],
      ["interview", "Interview Prep"],
      ["export", "Export"],
    ]],
    ["Support", [
      ["activity", "Activity"],
      ["notes", "Notes"],
      ["contacts", "Contacts"],
      ["tasks", "Tasks"],
    ]],
  ];
  const current = activeTab;
  const readiness = getWorkflowReadiness(completed);
  return (
    <aside className="shrink-0 border-b border-brand-100 bg-slate-50/80 md:w-56 md:border-b-0 md:border-r">
      <div className="kanban-scroll flex gap-2 overflow-x-auto p-3 md:sticky md:top-0 md:block md:h-full md:space-y-4 md:overflow-y-auto">
        <div className="hidden rounded-xl bg-white p-3 shadow-sm ring-1 ring-brand-100 md:block">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Application Readiness</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" aria-label={`${readiness.percent}% application readiness`}>
              <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${readiness.percent}%` }} />
            </div>
            <span className="text-xs font-black text-brand-900">{readiness.percent}%</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-600">{readiness.complete} of {readiness.total} sections complete</p>
        </div>
        <p className="hidden px-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 md:block">Application Workflow</p>
        {groups.map(([groupLabel, steps]) => (
          <div key={groupLabel} className="contents md:block">
            <p className="hidden px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 md:block">{groupLabel}</p>
            <div className="flex gap-2 md:block md:space-y-1">
              {steps.map(([id, label]) => {
                const selected = current === id;
                const done = completed[id];
                const completion = getStepCompletionLabel(id, score, done);
                const completionTone = id === "fit" && score ? getStepScoreTone(score.score) : "bg-emerald-100 text-emerald-800";
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelect(id)}
                    className={`group flex min-w-max shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs font-bold transition md:w-full md:min-w-0 ${
                      selected ? "bg-brand-700 text-white shadow-card" : done ? "bg-white text-emerald-800 ring-1 ring-emerald-100 hover:border-brand-200 hover:shadow-sm" : "bg-white/70 text-slate-600 ring-1 ring-brand-100 hover:bg-white hover:text-brand-800 hover:shadow-sm"
                    }`}
                  >
                    <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
                    <span className={`grid h-5 min-w-5 shrink-0 place-items-center whitespace-nowrap rounded-full px-1 text-[10px] ${selected ? "bg-white/20 text-white" : done ? completionTone : "bg-slate-50 text-slate-600"}`}>
                      {completion}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function getStepCompletionLabel(id, score, done) {
  if (id === "overview") return done ? "\u2713" : "\u25CB";
  if (id === "coverLetter" && !done) return "Optional";
  if (id === "fit" && Number.isFinite(Number(score?.score))) return `${Math.round(Number(score.score))}%`;
  if (!done) return "\u25CB";
  return "Ready";
}

function getStepScoreTone(score) {
  const value = Number(score);
  if (value >= 75) return "bg-emerald-100 text-emerald-800";
  if (value >= 45) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-700";
}

function hasRecruiterViewReadinessData({ score, resume, coverLetter, recruiterMessage, reviewedThisSession = false } = {}) {
  if (!score) return Boolean(reviewedThisSession);
  const mitigationPlan = buildMitigationPlan(score);
  if (mitigationPlan.items.length) return true;
  const recoveryScores = buildMaterialRecoveryScores({
    mitigationPlan,
    materials: { resume, coverLetter, message: recruiterMessage },
  });
  if (recoveryScores.length) return true;
  if (resume || coverLetter || recruiterMessage) return true;
  return Boolean(reviewedThisSession);
}

function hasInterviewPrepData(prep) {
  if (!prep) return false;
  const content = prep.content || {};
  return Boolean(
    prep.id ||
    content.summary ||
    content.companySnapshot ||
    (Array.isArray(content.focusAreas) && content.focusAreas.length) ||
    (Array.isArray(content.questions) && content.questions.length) ||
    (Array.isArray(content.starStories) && content.starStories.length) ||
    (Array.isArray(content.questionsToAsk) && content.questionsToAsk.length)
  );
}

function hasApplicationPackageReady({ score, resume, coverLetter, recruiterMessage } = {}) {
  return Boolean(score && resume && coverLetter && recruiterMessage);
}

function getWorkflowReadiness(completed = {}) {
  const keys = ["overview", "fit", "resume", "coverLetter", "message", "recruiterView", "interview", "export"];
  const complete = keys.filter((key) => Boolean(completed[key])).length;
  return {
    complete,
    total: keys.length,
    percent: Math.round((complete / keys.length) * 100),
  };
}

const descriptionPreviewLength = 520;

function getDescriptionPreview(description = "") {
  const trimmed = description.trim();
  if (trimmed.length <= descriptionPreviewLength) return trimmed;
  return trimmed.slice(0, descriptionPreviewLength).trimEnd();
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



