import { FileText, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CopyButton } from "../../components/ai/AiToolsPanel.jsx";
import { ResumeExportPanel } from "../../components/resume/ResumeExportPanel.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { CompanyLogo } from "../../components/ui/CompanyLogo.jsx";
import { FitScoreBadge, getFitScoreTone, getLatestFitScore } from "../../components/ui/FitScoreBadge.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { formatDateTime } from "../../components/resume/ResumeImportCard.jsx";
import { COMPANY_TO_CONFIRM, UNTITLED_JOB, getDisplayCompanyName, getDisplayJobTitle } from "../../lib/jobDisplay.js";
import { getResumeExportHistory } from "../../lib/resumeExport.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";

export function GeneratedResumesPage() {
  const { user } = useAuth();
  const { jobs, profile, resumeVersions, jobScores, loading, error, updateResumeVersion } = useWorkspaceStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [exportHistory, setExportHistory] = useState(() => getResumeExportHistory());
  const previewRef = useRef(null);

  const sortedVersions = useMemo(
    () => [...resumeVersions].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)),
    [resumeVersions],
  );
  const selected = (selectedId ? sortedVersions.find((version) => version.id === selectedId) : null) ?? getDefaultResumeVersion(sortedVersions, jobs);
  const selectedJob = selected ? jobs.find((job) => job.id === selected.job_id) : null;
  const selectedScore = getLatestFitScore(jobScores, selectedJob?.id);
  const selectedDraft = draft || normalizeGeneratedResumeLabels(selected?.content || "");
  const exportedIds = useMemo(() => new Set(exportHistory.map((item) => item.resumeId).filter(Boolean)), [exportHistory]);
  const selectedExports = selected ? exportHistory.filter((item) => item.resumeId === selected.id) : [];

  const filteredVersions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sortedVersions.filter((version, index) => {
      const job = jobs.find((item) => item.id === version.job_id);
      const searchable = `${version.title} ${getDisplayCompanyName(job)} ${getDisplayJobTitle(job)}`.toLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesFilter =
        filter === "All" ||
        (filter === "Latest" && index === 0) ||
        (filter === "Exported" && exportedIds.has(version.id));
      return matchesQuery && matchesFilter;
    });
  }, [exportedIds, filter, jobs, query, sortedVersions]);

  useEffect(() => {
    if (!sortedVersions.length) return;
    const requestedId = searchParams.get("resume");
    const requested = requestedId ? sortedVersions.find((version) => version.id === requestedId) : null;
    const current = selectedId ? sortedVersions.find((version) => version.id === selectedId) : null;
    const next = requested ?? current ?? getDefaultResumeVersion(sortedVersions, jobs);
    if (next && next.id !== selectedId) {
      setSelectedId(next.id);
      setDraft(normalizeGeneratedResumeLabels(next.content ?? ""));
      setIsEditing(false);
    }
  }, [jobs, searchParams, selectedId, sortedVersions]);

  useEffect(() => {
    if (selected) {
      setDraft(normalizeGeneratedResumeLabels(selected.content ?? ""));
      setIsEditing(false);
      setSaveError("");
    }
  }, [selected]);

  function selectVersion(version) {
    setSaveError("");
    setSelectedId(version.id);
    setDraft(normalizeGeneratedResumeLabels(version.content ?? ""));
    setIsEditing(false);
    setSearchParams({ resume: version.id });
    window.setTimeout(() => {
      if (!shouldScrollToSelectedWorkspace(previewRef.current)) return;
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  async function saveEdits() {
    if (!selected) return;
    setSaveError("");
    try {
      await updateResumeVersion(user, selected.id, { content: selectedDraft });
      setIsEditing(false);
    } catch {
      setSaveError("We couldn't save those edits yet. Your text is still here, so you can try again.");
    }
  }

  function refreshExportHistory() {
    setExportHistory(getResumeExportHistory());
  }

  if (loading) {
    return (
      <div className="grid gap-6">
        <PageHeader />
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(280px,0.32fr)_minmax(0,0.68fr)]">
          <aside className="grid gap-3">
            {[0, 1, 2].map((item) => <div key={item} className="occu-skeleton h-28 rounded-lg bg-white/80 shadow-sm" />)}
          </aside>
          <main className="grid gap-5">
            <div className="occu-skeleton h-36 rounded-lg bg-white/80 shadow-sm" />
            <div className="occu-skeleton h-[520px] rounded-lg bg-white/80 shadow-sm" />
          </main>
        </div>
      </div>
    );
  }

  if (!sortedVersions.length) {
    return (
      <div className="grid gap-6">
        <PageHeader />
        {error && <div className="rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}
        <Card className="bg-gradient-to-br from-brand-50/70 via-white to-emerald-50/60 p-8 text-center shadow-sm">
          <h3 className="text-xl font-bold text-ink">No Tailored Resumes Yet</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Generate a tailored resume from a job analysis.
          </p>
          <Link to="/app/new-jobs" className="mt-5 inline-flex">
            <Button>Analyze a Job</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader />
      {error && <div className="rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(280px,0.32fr)_minmax(0,0.68fr)]">
        <aside className="grid gap-4 self-start xl:sticky xl:top-5">
          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                className="w-full rounded-lg border border-brand-200 bg-white py-2 pl-9 pr-3 text-sm outline-none hover:border-brand-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                placeholder="Search resumes"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["All", "Latest", "Exported"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${filter === option ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-800 hover:bg-brand-100"}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </Card>

          <div className="grid gap-3">
            {filteredVersions.map((version, index) => {
              const job = jobs.find((item) => item.id === version.job_id);
              return (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => selectVersion(version)}
                  className={`rounded-lg border bg-white px-3.5 py-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card ${selected?.id === version.id ? "border-brand-300 shadow-card ring-4 ring-brand-100/80" : "border-transparent"}`}
                >
                  <div className="flex items-start gap-3">
                    <CompanyLogo companyName={getDisplayCompanyName(job)} companyDomain={job?.company_domain} companyLogoUrl={job?.company_logo_url} sourceUrl={job?.source_url} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className={`min-w-0 flex-1 font-bold leading-snug ${selected?.id === version.id ? "text-ink" : "text-slate-800"}`}>{getDisplayJobTitle(job)}</p>
                        <FitScoreBadge score={getLatestFitScore(jobScores, job?.id)} compact />
                      </div>
                      <p className="mt-1 text-sm font-semibold text-brand-800">{getDisplayCompanyName(job)}</p>
                      <p className="mt-2 text-xs text-slate-500">{formatDateTime(version.updated_at || version.created_at)}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {index === 0 && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-800">Latest</span>}
                        {version.tailoring_intensity && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-brand-100">{version.tailoring_intensity}</span>}
                        {exportedIds.has(version.id) && <span className="rounded-full bg-emerald-50/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Exported</span>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {!filteredVersions.length && <Card className="text-sm text-slate-600">No generated resumes match this view.</Card>}
          </div>
        </aside>

        <main ref={previewRef} className="min-w-0 scroll-mt-28 lg:scroll-mt-32">
          {selected ? (
            <section className="grid gap-5">
              <Card className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <CompanyLogo companyName={getDisplayCompanyName(selectedJob)} companyDomain={selectedJob?.company_domain} companyLogoUrl={selectedJob?.company_logo_url} sourceUrl={selectedJob?.source_url} size="lg" />
                    <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-500">Selected Resume</p>
                    <h3 className="mt-1.5 text-2xl font-bold leading-tight text-ink">{getDisplayJobTitle(selectedJob)}</h3>
                    <p className="mt-1 text-sm font-semibold text-brand-800">{getDisplayCompanyName(selectedJob)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <FitScoreBadge score={selectedScore} />
                      {selectedScore && <span className="rounded-full bg-stone-50 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-stone-100">{getFitScoreTone(selectedScore.score).label}</span>}
                    </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => setIsEditing((value) => !value)}>
                      {isEditing ? "View export preview" : "Edit resume text"}
                    </Button>
                    <CopyButton text={selectedDraft} />
                  </div>
                </div>
                {saveError && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{saveError}</p>}
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-brand-50/70 px-3 py-2 text-xs font-medium text-slate-500">
                  <span>Generated {formatDateTime(selected.created_at)}</span>
                  {selected.tailoring_intensity && <span>Generated in {selected.tailoring_intensity} mode</span>}
                  <span>{selectedExports.length ? `Exported ${selectedExports.length} time${selectedExports.length === 1 ? "" : "s"}` : "Not exported yet"}</span>
                </div>
              </Card>

              <ResumeExportPanel
                resume={selected}
                content={selectedDraft}
                profile={profile}
                job={selectedJob}
                historyResumeId={selected.id}
                onExportComplete={refreshExportHistory}
              />

              {isEditing && (
                <section className="animate-[fadeIn_260ms_ease-out] rounded-lg bg-white/90 p-5 shadow-card">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-ink">Edit resume text</h3>
                      <p className="mt-1 text-sm text-slate-500">Adjust the saved version, then return to the polished export preview.</p>
                    </div>
                    <Button className="w-fit" onClick={saveEdits}>Save edits</Button>
                  </div>
                  <textarea
                    className="mt-5 min-h-[620px] w-full rounded-lg border border-brand-100 bg-white px-6 py-5 font-mono text-[13px] leading-8 text-slate-800 shadow-inner outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                    value={selectedDraft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                </section>
              )}
            </section>
          ) : (
            <Card>Select a tailored resume to preview it.</Card>
          )}
        </main>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-500">Tailored Outputs</p>
        <h2 className="mt-2 text-2xl font-bold text-ink">Generated Resumes</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Review, edit, and export tailored resumes created from your job analyses.
        </p>
      </div>
      <Link to="/app/new-jobs" className="inline-flex shrink-0">
        <Button>Analyze New Job</Button>
      </Link>
    </section>
  );
}

function shouldScrollToSelectedWorkspace(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const isDesktop = window.matchMedia("(min-width: 1280px)").matches;
  const comfortableTop = 96;
  const comfortablyVisible = rect.top >= comfortableTop && rect.top <= window.innerHeight * 0.45;
  if (isDesktop && comfortablyVisible) return false;
  return rect.top < comfortableTop || rect.top > window.innerHeight * 0.6;
}

function getDefaultResumeVersion(versions, jobs) {
  return versions.find((version) => {
    const job = jobs.find((item) => item.id === version.job_id);
    return getDisplayJobTitle(job) !== UNTITLED_JOB && getDisplayCompanyName(job) !== COMPANY_TO_CONFIRM;
  }) ?? versions[0];
}

function normalizeGeneratedResumeLabels(content = "") {
  return content
    .replace(/TAILORED\s+PROFESSIONAL\s+SUMMARY/gi, "PROFESSIONAL SUMMARY")
    .replace(/OPTIMIZED\s+CORE\s+SKILLS/gi, "CORE SKILLS")
    .replace(/REORDERED\s*\/\s*REWORDED\s+EXPERIENCE\s+BULLETS/gi, "PROFESSIONAL EXPERIENCE")
    .replace(/REORDERED\s+EXPERIENCE\s+BULLETS/gi, "PROFESSIONAL EXPERIENCE")
    .replace(/REWORDED\s+EXPERIENCE\s+BULLETS/gi, "PROFESSIONAL EXPERIENCE");
}
