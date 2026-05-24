import { ChevronDown, ChevronUp, Link as LinkIcon, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { priorities, remoteTypes } from "../../data/seedData.js";
import { todayIso } from "../../lib/date.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "../../lib/jobDisplay.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { JobDetail } from "./JobsPage.jsx";

const emptyIntake = {
  source_url: "",
  job_description: "",
  company_name: "",
  job_title: "",
  location: "",
  remote_type: "Remote",
  salary_range: "",
  priority: "Medium",
  followup_date: "",
  notes: "",
};

export function NewJobsPage() {
  const { user } = useAuth();
  const { createJob, updateJob, deleteJob } = useWorkspaceStore();
  const [form, setForm] = useState(emptyIntake);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [guardrailOpen, setGuardrailOpen] = useState(false);
  const [savedJob, setSavedJob] = useState(null);
  const [success, setSuccess] = useState(false);
  const descriptionRef = useRef(null);

  const canAnalyze = useMemo(() => Boolean(form.source_url.trim() || form.job_description.trim()), [form]);
  const missingCompany = !form.company_name.trim();
  const missingTitle = !form.job_title.trim();
  const suggestions = useMemo(
    () => inferJobDetails({ job_description: form.job_description, source_url: form.source_url }),
    [form.job_description, form.source_url],
  );

  function update(event) {
    const { name, value } = event.target;
    setError("");
    setGuardrailOpen(false);
    setSuccess(false);
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "job_description" && !current.salary_range.trim()) {
        const salary = detectSalaryRange(value);
        if (salary) next.salary_range = salary;
      }
      return next;
    });
  }

  function resizeDescription(element) {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 520)}px`;
  }

  async function analyzeJob(event) {
    event.preventDefault();
    if (!canAnalyze) {
      setError("Paste a job description or link to get started.");
      return;
    }

    if ((missingCompany || missingTitle) && !guardrailOpen) {
      setGuardrailOpen(true);
      setError("");
      return;
    }

    await saveAndAnalyze();
  }

  async function saveAndAnalyze() {
    setSaving(true);
    setError("");
    setGuardrailOpen(false);
    setSuccess(false);
    try {
      const saved = await createJob(user, {
        ...form,
        company_name: getDisplayCompanyName(form.company_name.trim()),
        job_title: getDisplayJobTitle(form.job_title.trim()),
        location: form.location.trim(),
        salary_range: form.salary_range.trim(),
        status: "Saved",
        date_saved: todayIso(),
      });
      setSavedJob({ ...saved, initialTab: "fit" });
    } catch (saveError) {
      setError(saveError?.message || "We couldn't save this job yet. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function applySuggestion(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setGuardrailOpen(false);
    setError("");
  }

  async function moveToApplied(job) {
    const saved = await updateJob(user, job.id, { status: "Applied", applied_date: job.applied_date || todayIso() });
    setSavedJob(saved ? { ...saved, initialTab: "overview" } : null);
  }

  function closeModal() {
    setSavedJob(null);
    setForm(emptyIntake);
    setAdvancedOpen(false);
    setSuccess(true);
    if (descriptionRef.current) {
      descriptionRef.current.style.height = "";
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <section className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-500">Job Intake</p>
        <h2 className="mt-2 text-3xl font-bold text-ink">Analyze a New Job</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Paste a job posting and OccuBoard will help you understand the fit, tailor your resume, and prepare application materials.
        </p>
      </section>

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">Job saved to Applications.</p>
              <p className="mt-1">You can start another analysis whenever you are ready.</p>
            </div>
            <Link className="font-semibold underline" to="/app/applications">View Applications</Link>
          </div>
        </div>
      )}

      <Card>
        <form className="grid gap-5" onSubmit={analyzeJob}>
          <label className="grid gap-2 text-sm font-medium text-ink">
            Job URL
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                name="source_url"
                value={form.source_url}
                onChange={update}
                className="w-full rounded-lg border border-brand-200 bg-white py-3 pl-10 pr-3 text-sm outline-none hover:border-brand-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                placeholder="https://company.com/careers/role"
              />
            </div>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="company_name"
              label="Company"
              name="company_name"
              value={form.company_name}
              onChange={update}
              placeholder="Company name"
              className={guardrailOpen && missingCompany ? "border-amber-300 bg-amber-50/40 ring-4 ring-amber-100" : ""}
            />
            <Field
              id="job_title"
              label="Job Title"
              name="job_title"
              value={form.job_title}
              onChange={update}
              placeholder="Role title"
              className={guardrailOpen && missingTitle ? "border-amber-300 bg-amber-50/40 ring-4 ring-amber-100" : ""}
            />
          </div>

          <div className="rounded-lg bg-brand-50 p-3 text-sm text-slate-600">
            <p>Adding the company and title keeps your resume versions and application history organized.</p>
            {(suggestions.company_name || suggestions.job_title) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {missingCompany && suggestions.company_name && (
                  <button
                    type="button"
                    className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-800 shadow-sm ring-1 ring-brand-100 transition hover:bg-brand-50 hover:ring-brand-200"
                    onClick={() => applySuggestion("company_name", suggestions.company_name)}
                  >
                    Use {suggestions.company_name}
                  </button>
                )}
                {missingTitle && suggestions.job_title && (
                  <button
                    type="button"
                    className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-800 shadow-sm ring-1 ring-brand-100 transition hover:bg-brand-50 hover:ring-brand-200"
                    onClick={() => applySuggestion("job_title", suggestions.job_title)}
                  >
                    Use {suggestions.job_title}
                  </button>
                )}
              </div>
            )}
          </div>

          <label className="grid gap-2 text-sm font-medium text-ink">
            Job Description
            <textarea
              ref={descriptionRef}
              name="job_description"
              rows="7"
              value={form.job_description}
              onChange={(event) => {
                update(event);
                resizeDescription(event.target);
              }}
              placeholder="Paste the full job description here."
              className="min-h-44 max-h-[520px] resize-none overflow-hidden rounded-lg border border-brand-200 bg-white px-4 py-3 text-sm leading-7 outline-none hover:border-brand-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </label>

          <p className="rounded-lg bg-brand-50 p-3 text-sm text-slate-600">
            Paste a full job description for best results. Job URL parsing can be improved later.
          </p>

          <button
            type="button"
            className="flex items-center justify-between rounded-lg border border-brand-100 bg-white px-4 py-3 text-left text-sm font-bold text-brand-900 hover:bg-brand-50"
            onClick={() => setAdvancedOpen((value) => !value)}
          >
            Advanced details
            {advancedOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {advancedOpen && (
            <div className="grid gap-4 rounded-lg bg-brand-50/70 p-4 md:grid-cols-2">
              <Field id="location" label="Location" name="location" value={form.location} onChange={update} />
              <Select label="Remote type" name="remote_type" value={form.remote_type} options={remoteTypes} onChange={update} />
              <Field id="salary_range" label="Salary range" name="salary_range" value={form.salary_range} onChange={update} />
              <Select label="Priority" name="priority" value={form.priority} options={priorities} onChange={update} />
              <Field id="followup_date" label="Follow-up date" name="followup_date" type="date" value={form.followup_date} onChange={update} />
              <Field id="notes" label="Notes" as="textarea" name="notes" rows="3" value={form.notes} onChange={update} className="md:col-span-2" />
            </div>
          )}

          {error && <p className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}

          {guardrailOpen && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
              <p className="font-bold">Add the company and job title so your resumes and application history stay organized.</p>
              <p className="mt-1">You can continue without it, but naming the role helps later.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {missingCompany && suggestions.company_name && (
                  <button
                    type="button"
                    className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-900 shadow-sm ring-1 ring-amber-100 transition hover:bg-amber-50"
                    onClick={() => applySuggestion("company_name", suggestions.company_name)}
                  >
                    Use {suggestions.company_name}
                  </button>
                )}
                {missingTitle && suggestions.job_title && (
                  <button
                    type="button"
                    className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-900 shadow-sm ring-1 ring-amber-100 transition hover:bg-amber-50"
                    onClick={() => applySuggestion("job_title", suggestions.job_title)}
                  >
                    Use {suggestions.job_title}
                  </button>
                )}
                <Button variant="secondary" className="min-h-8 px-3 py-1 text-xs" onClick={saveAndAnalyze} disabled={saving}>
                  Continue anyway
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <Button type="submit" className="min-h-12 w-full px-6 text-base shadow-soft sm:w-auto sm:min-w-56" disabled={saving}>
              <Sparkles size={17} /> {saving ? "Saving job..." : "Analyze Job"}
            </Button>
          </div>
        </form>
      </Card>

      {savedJob && (
        <JobDetail
          job={savedJob}
          initialTab="fit"
          onClose={closeModal}
          onEdit={() => setAdvancedOpen(true)}
          onDelete={async () => {
            await deleteJob(user, savedJob.id);
            closeModal();
          }}
          onMove={() => moveToApplied(savedJob)}
        />
      )}
    </div>
  );
}

function Select({ label, name, value, options, onChange }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium text-ink">
      {label}
      <select name={name} value={value ?? ""} onChange={onChange} className="min-w-0 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm outline-none hover:border-brand-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

export function inferJobDetails(form) {
  const lines = form.job_description.split("\n").map((line) => line.trim()).filter(Boolean);
  const companyLine = lines.find((line) => line.length <= 60 && /^(company|organization|employer)\s*:/i.test(line));
  const titleWithLabel = lines.find((line) => line.length <= 90 && /^(job title|title|role|position)\s*:/i.test(line));
  const titleLine = titleWithLabel || lines.find((line) => line.length <= 80 && /specialist|manager|engineer|consultant|analyst|coordinator|director|lead|administrator|developer|designer|architect|representative/i.test(line));
  const companyFromDescription = companyLine?.replace(/^(company|organization|employer)\s*:\s*/i, "").trim() || "";
  const companyFromAbout = lines
    .map((line) => line.match(/^about\s+([A-Z][A-Za-z0-9&.' -]{1,58})$/i)?.[1])
    .find(Boolean);
  const companyFromSentence = lines
    .map((line) => line.match(/^([A-Z][A-Za-z0-9&.' -]{1,58})\s+(is|was|provides|builds|helps)\b/)?.[1])
    .find(Boolean);
  const companyFromUrl = inferCompanyFromUrl(form.source_url);

  return {
    company_name: sanitizeSuggestion(companyFromDescription || companyFromAbout || companyFromSentence || companyFromUrl),
    job_title: sanitizeSuggestion(titleLine?.replace(/^(job title|title|role|position)\s*:\s*/i, "")),
  };
}

function sanitizeSuggestion(value = "") {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length > 80) return "";
  return cleaned;
}

function inferCompanyFromUrl(url = "") {
  try {
    if (!url.trim()) return "";
    const host = new window.URL(url).hostname.replace(/^www\./, "");
    const name = host.split(".")[0];
    if (!name) return "";
    return name
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return "";
  }
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
