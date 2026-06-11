import { ArrowDown, ArrowRight, CheckCircle2, FileText, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { buildOnboardingState } from "../../lib/onboarding.js";
import { createEmptyProfile } from "../../lib/profile.js";
import { extractResumeText, getResumeFileKind, normalizeResumeText, validateResumeFile } from "../../lib/resumeParser.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { Button } from "../ui/Button.jsx";
import { Card } from "../ui/Card.jsx";

export function ResumeImportCard({ compact = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, resumeUploads, jobs, jobScores, resumeVersions, saveProfile, saveResumeUpload } = useWorkspaceStore();
  const [state, setState] = useState({ loading: false, error: "", success: "", storageNote: "" });
  const [review, setReview] = useState(null);
  const [handoff, setHandoff] = useState(false);
  const inputRef = useRef(null);
  const hasBaseResume = Boolean(profile?.base_resume_text?.trim());
  const firstTimeBeforeUpload = buildOnboardingState({ profile, resumeUploads, jobs, jobScores, resumeVersions }).isNewWorkspace;

  async function importFile(selectedFile) {
    const validationError = validateResumeFile(selectedFile);
    if (validationError) {
      setState({ loading: false, error: validationError, success: "", storageNote: "" });
      return;
    }
    setState({ loading: true, error: "", success: "", storageNote: "" });
    try {
      const text = await extractResumeText(selectedFile);
      if (!text) throw new Error("We couldn't extract readable text from this file. Try uploading a DOCX version or paste your resume manually.");
      setReview({
        file: selectedFile,
        text,
        createdAt: new Date().toISOString(),
      });
      setState({ loading: false, error: "", success: "", storageNote: "" });
    } catch (error) {
      setState({ loading: false, error: error.message, success: "", storageNote: "" });
    }
  }

  async function saveAsBaseResume(text, file) {
    setState({ loading: true, error: "", success: "", storageNote: "" });
    try {
      const cleanedText = normalizeResumeText(text);
      const upload = file ? await saveResumeUpload(user, file, cleanedText) : null;
      const currentProfile = profile?.id === user?.id ? profile : createEmptyProfile(user);
      await saveProfile(user, { ...currentProfile, base_resume_text: cleanedText });
      setState({
        loading: false,
        error: "",
        success: "Resume imported successfully. Base resume updated.",
        storageNote: upload?.storage_note ?? "",
      });
      setReview(null);
      if (firstTimeBeforeUpload) {
        setHandoff(true);
      }
    } catch (error) {
      setState({ loading: false, error: error.message, success: "", storageNote: "" });
    }
  }

  function reset() {
    setReview(null);
    setState({ loading: false, error: "", success: "", storageNote: "" });
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Card className={`${compact ? "bg-brand-50/40" : ""} ${firstTimeBeforeUpload ? "border-brand-300 bg-gradient-to-br from-brand-50 via-white to-emerald-50 shadow-soft ring-2 ring-brand-200" : ""}`}>
      {handoff && <ResumeOnboardingHandoff onContinue={() => navigate("/app/new-jobs", { state: { onboardingStep: "analyze-job" } })} onSkip={() => setHandoff(false)} />}
      {firstTimeBeforeUpload && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-bold text-white shadow-sm">
          <ArrowDown size={16} aria-hidden="true" />
          Start here: upload your resume.
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">{hasBaseResume ? "Manage Base Resume" : "Upload Your First Resume"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {hasBaseResume ? "Your base resume is saved. Upload a newer version here whenever you want to replace it." : "Your resume becomes the foundation for every tailored application."}
          </p>
        </div>
        <Button variant={firstTimeBeforeUpload ? "primary" : "secondary"} onClick={() => inputRef.current?.click()} disabled={state.loading}>
          <UploadCloud size={16} /> {hasBaseResume ? "Upload New Version" : "Upload Resume"}
        </Button>
      </div>

      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={(event) => importFile(event.target.files?.[0])}
      />

      <button
        type="button"
        className="mt-5 flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 bg-white px-4 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          importFile(event.dataTransfer.files?.[0]);
        }}
      >
        <UploadCloud className="text-brand-700" size={28} />
        <span className="mt-3 font-bold text-brand-900">Drop your resume here or choose a file</span>
        <span className="mt-1 text-sm text-slate-500">PDF, DOCX, or TXT up to 5MB</span>
      </button>

      {state.loading && <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm font-semibold text-brand-900">Reading your resume...</p>}
      {state.error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{state.error}</p>}
      {state.success && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{state.success}</p>}
      {state.storageNote && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{state.storageNote}</p>}

      {review && (
        <ResumeReviewModal
          file={review.file}
          initialText={review.text}
          createdAt={review.createdAt}
          hasBaseResume={hasBaseResume}
          loading={state.loading}
          onCancel={reset}
          onSave={saveAsBaseResume}
        />
      )}
    </Card>
  );
}

function ResumeOnboardingHandoff({ onContinue, onSkip }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-white/95 px-4 backdrop-blur-sm">
      <section className="w-full max-w-xl rounded-xl border border-brand-100 bg-white p-6 text-center shadow-soft sm:p-8" role="dialog" aria-modal="true" aria-labelledby="resume-upload-success-title">
        <img src="/assets/occuboard-logo.svg" alt="OccuBoard" className="mx-auto h-auto w-44 max-w-full" />
        <div className="mx-auto mt-6 grid h-14 w-14 place-items-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
          <img src="/assets/favicon.svg" alt="" className="h-8 w-8" aria-hidden="true" />
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-emerald-700">
          <CheckCircle2 size={20} aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-[0.14em]">Resume foundation complete</p>
        </div>
        <h2 id="resume-upload-success-title" className="mt-2 text-2xl font-black text-ink">Resume uploaded successfully</h2>
        <p className="mt-2 text-base font-semibold text-slate-700">Your resume foundation is ready.</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
          Add a job description so OccuBoard can analyze fit, tailor your resume, generate recruiter messaging, and prepare interview materials.
        </p>
        <div className="mt-6 flex flex-col-reverse items-center justify-center gap-2 sm:flex-row">
          <Button variant="ghost" className="w-full sm:w-fit" onClick={onSkip}>Skip for now</Button>
          <Button className="w-full sm:w-fit" onClick={onContinue}>
            Add My First Job <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </div>
      </section>
    </div>
  );
}

export function ResumeReviewModal({ file, upload, initialText, createdAt, hasBaseResume, loading, onCancel, onSave }) {
  const [text, setText] = useState(initialText);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const fileName = file?.name ?? upload?.file_name ?? "Imported resume";
  const fileType = file ? getResumeFileKind(file).toUpperCase() : upload?.file_type;
  const fileSize = file?.size ?? upload?.file_size;
  const date = createdAt ?? upload?.created_at ?? new Date().toISOString();

  function save() {
    if (hasBaseResume && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    onSave(normalizeResumeText(text), file, upload);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-ink/35 p-0 sm:p-4" onMouseDown={onCancel}>
      <section className="mx-auto flex h-[100dvh] max-w-4xl flex-col overflow-hidden bg-white shadow-soft sm:h-[calc(100dvh-2rem)] sm:rounded-lg" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-brand-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">Review Imported Resume</p>
            <h2 className="mt-2 truncate text-xl font-bold text-ink">{fileName}</h2>
            <p className="mt-1 text-sm text-slate-500">{fileType || "Resume"} | {formatFileSize(fileSize)} | {formatDateTime(date)}</p>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-brand-50" onClick={onCancel} aria-label="Close resume review">
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="rounded-lg bg-brand-50 p-3 text-sm text-slate-700">
            Review and edit the extracted text before saving. This cleaned text becomes your base resume.
            <span className="mt-1 block font-semibold text-brand-800">Don&apos;t worry about formatting here. OccuBoard cleans and formats your resume during generation and export.</span>
          </p>
          {hasBaseResume && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Saving will replace your current base resume text. Your original upload remains in history when storage is available.
            </p>
          )}
          <textarea
            className="mt-4 min-h-[58vh] w-full rounded-lg border border-brand-200 bg-white p-6 font-mono text-sm leading-8 text-slate-800 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            value={text}
            onChange={(event) => {
              setConfirmReplace(false);
              setText(event.target.value);
            }}
          />
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 bg-white px-5 py-4">
          <p className="text-xs text-slate-500">Future option: keep existing resume and save this as a draft import.</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setText(normalizeResumeText(text))}>Re-clean formatting</Button>
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button onClick={save} disabled={loading || !text.trim()}>
              {hasBaseResume ? (confirmReplace ? "Confirm Replace" : "Replace Existing Resume") : "Save as Base Resume"}
            </Button>
          </div>
          {confirmReplace && <p className="basis-full text-right text-sm font-semibold text-amber-800">Click Confirm Replace to update your base resume.</p>}
        </footer>
      </section>
    </div>
  );
}

export function formatFileSize(bytes = 0) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(value) {
  if (!value) return "Not dated";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
