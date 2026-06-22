import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ProfileForm } from "../../components/profile/ProfileForm.jsx";
import { formatDateTime, formatFileSize, ResumeImportCard, ResumeOnboardingHandoff, ResumeReviewModal } from "../../components/resume/ResumeImportCard.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { normalizeResumeText } from "../../lib/resumeParser.js";
import { createEmptyProfile } from "../../lib/profile.js";
import { trackProductMilestone } from "../../lib/productAnalytics.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";

export function ResumeStudioPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, resumeUploads, jobs, saveProfile } = useWorkspaceStore();
  const [reviewUpload, setReviewUpload] = useState(null);
  const [handoff, setHandoff] = useState(false);
  const [highlightImport, setHighlightImport] = useState(false);
  const importRef = useRef(null);
  const profileRef = useRef(null);
  const highlightTimerRef = useRef(null);
  const returnTo = new window.URLSearchParams(location.search).get("returnTo");
  const latestUpload = resumeUploads[0];
  const hasBaseResume = Boolean(profile?.base_resume_text?.trim());
  const shouldShowNextJob = hasBaseResume && jobs.length === 0;

  async function applyUploadText(text) {
    const wasFirstResume = !hasBaseResume;
    const currentProfile = profile?.id === user?.id ? profile : createEmptyProfile(user);
    await saveProfile(user, { ...currentProfile, base_resume_text: normalizeResumeText(text) });
    if (wasFirstResume) trackProductMilestone("resume_added", { user_id: user?.id, source: "upload" });
    setReviewUpload(null);
    if (wasFirstResume) setHandoff(true);
  }

  const focusImportCard = useCallback(() => {
    const card = importRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!fullyVisible) card.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightImport(false);
    window.requestAnimationFrame(() => setHighlightImport(true));
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlightImport(false), 1800);
  }, []);

  useEffect(() => {
    if (location.hash !== "#resume-import") return;
    const frame = window.requestAnimationFrame(focusImportCard);
    return () => window.cancelAnimationFrame(frame);
  }, [focusImportCard, location.hash]);

  useEffect(() => {
    if (location.hash !== "#profile") return;
    const frame = window.requestAnimationFrame(() => {
      profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash]);

  useEffect(() => {
    function handleFocusRequest() {
      focusImportCard();
    }
    window.addEventListener("occuboard:focus-resume-import", handleFocusRequest);
    return () => {
      window.removeEventListener("occuboard:focus-resume-import", handleFocusRequest);
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, [focusImportCard]);

  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(280px,0.88fr)]">
        <div id="resume-import" ref={importRef} className="scroll-mt-24">
          <section className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-500">Resume Foundation</p>
            <ResumeImportCard highlighted={highlightImport} onBaseResumeSaved={() => setHandoff(true)} />
          </section>
        </div>

        <div className="grid content-start gap-4">
          {shouldShowNextJob ? (
            <Card className="bg-gradient-to-br from-emerald-50 via-white to-brand-50 ring-1 ring-emerald-100">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={18} aria-hidden="true" />
                <p className="text-xs font-black uppercase tracking-[0.14em]">Base resume saved</p>
              </div>
              <h2 className="mt-3 text-xl font-black text-ink">Next step: Analyze your first job</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Your resume foundation is ready. Analyze a job to begin tailoring.</p>
              <Button className="mt-4" onClick={() => navigate("/app/new-jobs")}>
                Analyze Job <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </Card>
          ) : (
            <Card className="bg-brand-50/45">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">What happens next</p>
              <h2 className="mt-2 text-xl font-bold text-ink">One resume powers every application</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">After saving your resume, add a job to analyze fit and create tailored application materials.</p>
            </Card>
          )}

          <Card>
            <h2 className="text-xl font-bold">Upload History</h2>
            <div className="mt-4 grid gap-3">
              {resumeUploads.slice(0, 3).map((upload) => (
                <div key={upload.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-brand-100 bg-brand-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-brand-900">{upload.file_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{upload.file_type} | {formatFileSize(upload.file_size)} | {formatDateTime(upload.created_at)}</p>
                  </div>
                  <Button variant="secondary" className="w-fit min-h-8 px-3 text-xs" onClick={() => setReviewUpload(upload)}>Review & Use</Button>
                </div>
              ))}
              {!resumeUploads.length && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Uploaded resume versions will appear here.</p>}
            </div>
          </Card>
        </div>
      </div>

      <Card id="profile" ref={profileRef} className="scroll-mt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-500">Career Profile</p>
          <h2 className="mt-2 text-xl font-bold">Base Resume</h2>
          <p className="mt-2 text-sm text-slate-600">Paste or edit the main resume text you want to adapt for different roles.</p>
          <BaseResumeSource profile={profile} latestUpload={latestUpload} />
          <div className="mt-5">
            <ProfileForm
              compact
              onSaved={({ hadBaseResume, hasBaseResume: savedResume }) => {
                if (!hadBaseResume && savedResume) setHandoff(true);
                if (returnTo) navigate(returnTo);
              }}
            />
          </div>
      </Card>

      {handoff && (
        <ResumeOnboardingHandoff
          onContinue={() => navigate("/app/new-jobs", { state: { onboardingStep: "analyze-job" } })}
          onSkip={() => setHandoff(false)}
        />
      )}
      {reviewUpload && (
        <ResumeReviewModal
          upload={reviewUpload}
          initialText={reviewUpload.extracted_text}
          hasBaseResume={Boolean(profile?.base_resume_text?.trim())}
          loading={false}
          onCancel={() => setReviewUpload(null)}
          onSave={(text) => applyUploadText(text)}
        />
      )}
    </div>
  );
}

function BaseResumeSource({ profile, latestUpload }) {
  if (!profile?.base_resume_text?.trim()) {
    return <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">Upload a resume to start generating tailored applications.</p>;
  }

  if (latestUpload && profile.updated_at && new Date(profile.updated_at) > new Date(latestUpload.created_at)) {
    return <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-slate-600">Last updated manually on {formatDateTime(profile.updated_at)}</p>;
  }

  if (latestUpload) {
    return <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-slate-600">Imported from {latestUpload.file_name} | {formatDateTime(latestUpload.created_at)}</p>;
  }

  return <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-slate-600">Base resume entered manually.</p>;
}
