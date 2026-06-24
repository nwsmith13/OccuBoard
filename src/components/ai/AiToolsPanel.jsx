import { CheckCircle2, ChevronDown, Clipboard, Lightbulb, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BillingLimitModal } from "../billing/BillingLimitModal.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useIntelligenceMode } from "../../contexts/IntelligenceModeContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { calculateApplicationReadiness } from "../../lib/applicationReadiness.js";
import { canUseUsageFeature, createCheckoutSession, usageActions } from "../../lib/billing.js";
import { canRunAi, generateAiOutput } from "../../lib/aiClient.js";
import { trackEvent } from "../../lib/productAnalytics.js";
import { formatDate } from "../../lib/date.js";
import { getLatestForJob, isCoverLetter, isRecruiterMessage, normalizeMessageType } from "../../lib/jobAiStatus.js";
import { buildMitigationPlan, getAppliedMitigationLabels, getAppliedMitigations } from "../../lib/mitigationPlan.js";
import { buildOnboardingState } from "../../lib/onboarding.js";
import { getMissingResumeHeaderItems } from "../../lib/profile.js";
import { buildGapRecovery, buildMaterialRecoveryScores, buildRewriteInsights, estimateOptimizedFit } from "../../lib/rewriteInsights.js";
import { assessRewriteRestraint } from "../../lib/rewriteRestraint.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { ResumeExportPanel } from "../resume/ResumeExportPanel.jsx";
import { GuidedNextStep } from "../onboarding/GuidedNextStep.jsx";
import { Button } from "../ui/Button.jsx";
import { getFitScoreTone } from "../ui/FitScoreBadge.jsx";

export function AiToolsPanel({ job, compact = false, contentOnly = false, activeTab = "fit", onTabChange, onExportComplete }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const {
    profile,
    resumeUploads,
    jobs,
    jobScores,
    resumeVersions,
    interviewPrep,
    messages,
    jobContacts,
    saveJobScore,
    saveResumeVersion,
    saveMessage,
    updateMessage,
    logJobActivity,
    billing,
    refreshBilling,
  } = useWorkspaceStore();
  const [aiState, setAiState] = useState({ loading: "", error: "", latest: null, confirm: "" });
  const [limitAction, setLimitAction] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [intensity, setIntensity] = useState("Moderate");
  const [manualIntensity, setManualIntensity] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [resumeHeaderWarningOpen, setResumeHeaderWarningOpen] = useState(false);
  const showSlowHint = useSlowLoading(Boolean(aiState.loading));
  const loadingRef = useRef(null);
  const jobScoreHistory = jobScores.filter((score) => score.job_id === job.id);
  const resumeHistory = resumeVersions.filter((version) => version.job_id === job.id);
  const messageHistory = messages.filter((message) => message.job_id === job.id && isRecruiterMessage(message));
  const coverLetterHistory = messages.filter((message) => message.job_id === job.id && isCoverLetter(message));
  const contacts = jobContacts.filter((contact) => contact.job_id === job.id);
  const latestScore = getLatestForJob(jobScores, job.id);
  const latestResume = getLatestForJob(resumeVersions, job.id);
  const latestCoverLetter = getLatestForJob(coverLetterHistory, job.id);
  const latestMessage = getLatestForJob(messageHistory, job.id);
  const activeAction = ["fit", "resume", "message"].includes(activeTab) ? activeTab : "fit";
  const onboarding = buildOnboardingState({ profile, resumeUploads, jobs, jobScores, resumeVersions, interviewPrep });
  const showOnboardingHelp = onboarding.hasResume && !onboarding.completed;

  useEffect(() => {
    if (latestMessage?.contact_id && !selectedContactId) setSelectedContactId(latestMessage.contact_id);
  }, [latestMessage?.contact_id, selectedContactId]);

  async function runAi(action, { regenerate = false, skipHeaderCheck = false } = {}) {
    if (aiState.loading) return;
    const usageField = getAiUsageField(action, job, Boolean(latestScore || latestResume || latestMessage));
    if (usageField && !canUseUsageFeature(billing, usageField)) {
      setLimitAction(action);
      return;
    }
    if (regenerate && aiState.confirm !== action) {
      setAiState({ loading: "", latest: null, error: "", confirm: action });
      return;
    }
    const localError = getLocalError(action, profile, job);
    if (localError) {
      setAiState({ loading: "", latest: null, error: localError, confirm: "" });
      return;
    }
    if (action === "resume" && !skipHeaderCheck && getMissingResumeHeaderItems(profile).length) {
      setResumeHeaderWarningOpen(true);
      return;
    }
    setAiState({ loading: action, error: "", latest: null, confirm: "" });
    window.setTimeout(() => loadingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
    try {
      const effectiveIntensity = getEffectiveIntensity(action, intensity, manualIntensity, latestScore);
      const mitigationPlan = buildMitigationPlan(latestScore);
      const aiUsageAlreadyCounted = Boolean(job.ai_usage_counted_at || latestScore || latestResume || latestMessage);
      const placement = action === "resume" ? "Resume" : action === "message" ? "Recruiter message" : "";
      const appliedMitigations = getAppliedMitigations(mitigationPlan, placement);
      const result = await generateAiOutput(action, profile, job, {
        userId: user?.id,
        aiUsageAlreadyCounted,
        tailoringIntensity: effectiveIntensity,
        manualIntensityOverride: manualIntensity,
        fitRecommendation: latestScore?.recommendation,
        fitSummary: latestScore?.summary,
        mitigationPlan: action === "resume" || action === "message" ? mitigationPlan : null,
        appliedMitigationLabels: appliedMitigations.map((item) => item.appliedLabel),
      });
      if (action === "fit") await saveJobScore(user, job, { ...result, tailoringIntensity: effectiveIntensity });
      let savedResume = null;
      if (action === "resume") {
        savedResume = await saveResumeVersion(user, job, result, { tailoringIntensity: effectiveIntensity, recommendation: latestScore?.recommendation, appliedMitigations });
        if (appliedMitigations.length) await logJobActivity(user, job.id, "resume_strengthened_from_analysis", { detail: "Resume strengthened from analysis", appliedLabels: appliedMitigations.map((item) => item.appliedLabel) });
      }
      if (action === "message") {
        const contact = contacts.find((item) => item.id === selectedContactId);
        await saveMessage(user, job, { ...result, contact_id: selectedContactId || null, contactName: contact?.name || "", appliedMitigations });
        if (appliedMitigations.length) await logJobActivity(user, job.id, "message_strengthened_from_analysis", { detail: "Recruiter message strengthened from analysis", appliedLabels: appliedMitigations.map((item) => item.appliedLabel) });
        if (regenerate) await logJobActivity(user, job.id, "message_regenerated", { detail: "Recruiter message regenerated" });
      }
      setAiState({ loading: "", error: "", latest: { action, result, resumeId: savedResume?.id }, confirm: "" });
      toast.success(getAiSuccessMessage(action));
      onTabChange?.(action);
    } catch (error) {
      setAiState({ loading: "", latest: null, error: error.message, confirm: "" });
      toast.error(getAiErrorMessage(action));
    }
  }

  if (contentOnly) {
    return (
      <section className="grid gap-4">
        <ResumeHeaderWarningModal
          open={resumeHeaderWarningOpen}
          missingItems={getMissingResumeHeaderItems(profile)}
          onCompleteProfile={() => {
            setResumeHeaderWarningOpen(false);
            navigate(`/app/resume-studio?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}#profile`);
          }}
          onGenerateAnyway={() => {
            setResumeHeaderWarningOpen(false);
            runAi("resume", { skipHeaderCheck: true });
          }}
          onClose={() => setResumeHeaderWarningOpen(false)}
        />
        <BillingLimitModal
          open={Boolean(limitAction)}
          upgrading={upgrading}
          onUpgrade={async () => {
            trackEvent("upgrade_clicked", { source: "free_limit_modal", user_id: user?.id });
            setUpgrading(true);
            try {
              const url = await createCheckoutSession(user);
              window.location.assign(url);
            } catch (error) {
              if (error.code === "already_pro" || error.message === "You already have OccuBoard Pro.") {
                await refreshBilling(user);
                toast.success("You're already on OccuBoard Pro.");
                setLimitAction("");
                setUpgrading(false);
                return;
              }
              toast.error(error.message || "Could not open checkout.");
              setUpgrading(false);
            }
          }}
          onClose={() => setLimitAction("")}
        />
        {aiState.loading && <div ref={loadingRef}><AiSkeleton action={aiState.loading} /></div>}
        {showSlowHint && <LoadingHint />}
        {aiState.error && <MissingOrError message={aiState.error} />}
        {aiState.latest?.action === "fit" && !showOnboardingHelp && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
            Analysis completed. You have a clearer view of this opportunity.
          </div>
        )}
        {aiState.latest?.action === "message" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
            Recruiter message saved. Your outreach is ready when you are.
          </div>
        )}
        {activeAction === "fit" && (
          <>
            <TailoringSettingsDisclosure
              intensity={getEffectiveIntensity("resume", intensity, manualIntensity, latestScore)}
              latestScore={latestScore}
              onChange={(value) => {
                setManualIntensity(true);
                setIntensity(value);
              }}
            />
            {showOnboardingHelp && !latestScore && (
              <AiOnboardingHelpCard
                eyebrow="Step 3 of 8"
                title="Job added"
                body="OccuBoard is ready to compare your resume against this opportunity."
                bullets={["Match score", "Strengths", "Missing qualifications", "Resume tailoring opportunities"]}
                actionLabel={aiState.loading === "fit" ? "Analyzing..." : "Analyze Fit"}
                onAction={() => runAi("fit")}
                disabled={Boolean(aiState.loading)}
              />
            )}
            {showOnboardingHelp && latestScore && (
              <GuidedNextStep
                title="Fit analysis complete"
                message="See how your experience aligns and identify areas to strengthen."
                nextStep="Generate a job-specific resume using the strongest evidence from your analysis."
                actionLabel={aiState.loading === "resume" ? "Generating..." : "Generate Tailored Resume"}
                onAction={() => runAi("resume")}
              />
            )}
            <FitResult score={latestScore} onGenerate={() => runAi("fit")} onRegenerate={() => runAi("fit", { regenerate: true })} loading={aiState.loading} showAction={!(showOnboardingHelp && !latestScore)} onContinue={() => onTabChange?.("resume")} onRecruiterView={() => onTabChange?.("recruiterView")} />
          </>
        )}
        {activeAction === "resume" && (
          <>
            {showOnboardingHelp && !latestResume && (
              <AiOnboardingHelpCard
                eyebrow="Step 4 of 8"
                title="Generate Your Tailored Resume"
                body="Create a focused resume version from the match analysis and your real experience."
                actionLabel={aiState.loading === "resume" ? "Generating..." : "Generate Resume"}
                onAction={() => runAi("resume")}
                disabled={Boolean(aiState.loading)}
              />
            )}
            {showOnboardingHelp && latestResume && !onboarding.hasRecruiterView && (
              <GuidedNextStep
                title="Tailored resume ready"
                message="A job-specific version of your resume has been prepared."
                nextStep="See how a recruiter may view this application and what questions your positioning should answer."
                actionLabel="Open Recruiter View"
                onAction={() => onTabChange?.("recruiterView")}
                secondaryLabel="View Resume"
                onSecondary={() => window.setTimeout(() => document.getElementById("tailored-resume-preview")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20)}
              />
            )}
            <ResumeResult resume={latestResume} job={job} score={latestScore} materials={{ resume: latestResume, coverLetter: latestCoverLetter, message: latestMessage }} analysisReady={Boolean(latestScore)} onAnalyze={() => onTabChange?.("fit")} onGenerate={() => runAi("resume")} onRegenerate={() => runAi("resume", { regenerate: true })} loading={aiState.loading} onExportComplete={onExportComplete} onOpenRecruiterView={() => onTabChange?.("recruiterView")} onOpenExport={() => onTabChange?.("export")} onOpenMessage={() => onTabChange?.("message")} onOpenInterview={() => onTabChange?.("interview")} />
          </>
        )}
          {activeAction === "message" && <MessageResult message={latestMessage} score={latestScore} materials={{ resume: latestResume, coverLetter: latestCoverLetter, message: latestMessage }} analysisReady={Boolean(latestScore)} resumeReady={Boolean(latestResume)} coverLetterReady={Boolean(latestCoverLetter)} contacts={contacts} selectedContactId={selectedContactId} onContactChange={setSelectedContactId} onAnalyze={() => onTabChange?.("fit")} onResume={() => onTabChange?.("resume")} onSave={(message, patch) => updateMessage(user, message, patch)} onLogActivity={(type, metadata) => logJobActivity(user, job.id, type, metadata)} onGenerate={() => runAi("message")} onRegenerate={() => runAi("message", { regenerate: true })} loading={aiState.loading} />}
      </section>
    );
  }

  return (
    <section className={compact ? "grid gap-3" : "rounded-lg border border-brand-100 bg-white p-5 shadow-card"}>
      <ResumeHeaderWarningModal
        open={resumeHeaderWarningOpen}
        missingItems={getMissingResumeHeaderItems(profile)}
        onCompleteProfile={() => {
          setResumeHeaderWarningOpen(false);
          navigate(`/app/resume-studio?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}#profile`);
        }}
        onGenerateAnyway={() => {
          setResumeHeaderWarningOpen(false);
          runAi("resume", { skipHeaderCheck: true });
        }}
        onClose={() => setResumeHeaderWarningOpen(false)}
      />
      <BillingLimitModal
        open={Boolean(limitAction)}
        upgrading={upgrading}
          onUpgrade={async () => {
            trackEvent("upgrade_clicked", { source: "free_limit_modal", user_id: user?.id });
            setUpgrading(true);
          try {
            const url = await createCheckoutSession(user);
            window.location.assign(url);
          } catch (error) {
            if (error.code === "already_pro" || error.message === "You already have OccuBoard Pro.") {
              await refreshBilling(user);
              toast.success("You're already on OccuBoard Pro.");
              setLimitAction("");
              setUpgrading(false);
              return;
            }
            toast.error(error.message || "Could not open checkout.");
            setUpgrading(false);
          }
        }}
        onClose={() => setLimitAction("")}
      />
      {!compact && (
        <>
          <h3 className="flex items-center gap-2 font-bold"><Sparkles size={18} className="text-brand-700" /> AI Tools</h3>
          <p className="mt-2 text-sm text-slate-600">Generate controlled drafts from your saved profile, base resume, and this job description.</p>
        </>
      )}
      <div className={`${compact ? "flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" : "mt-4 grid gap-3 md:grid-cols-3"}`}>
        {compact ? (
          <CompactGuidedAction
            activeAction={activeAction}
            latestScore={latestScore}
            latestResume={latestResume}
            latestMessage={latestMessage}
            loading={aiState.loading}
            onRun={runAi}
            onTabChange={onTabChange}
          />
        ) : (
          <div className="contents">
            <AiAction action="fit" label="Analysis" fullLabel="Analyze Fit" existing={latestScore} activeTab={activeTab} loading={aiState.loading} onRun={runAi} onView={() => onTabChange?.("fit")} />
            <AiAction action="resume" label="Resume" fullLabel="Generate Resume" existing={latestResume} activeTab={activeTab} loading={aiState.loading} onRun={runAi} onView={() => onTabChange?.("resume")} />
            <AiAction action="message" label="Recruiter Message" fullLabel="Generate Recruiter Message" existing={latestMessage} activeTab={activeTab} loading={aiState.loading} onRun={runAi} onView={() => onTabChange?.("message")} />
          </div>
        )}
      </div>
      {!compact && <div className="mt-4 flex flex-col gap-2 rounded-lg bg-brand-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className={`flex gap-3 ${compact ? "items-center justify-between" : "flex-col sm:flex-row sm:items-center sm:justify-between"}`}>
          <div className={compact ? "hidden lg:block" : ""}>
            <p className="text-sm font-semibold text-brand-900">Tailoring intensity</p>
            <p className={`text-xs text-slate-600 ${compact ? "hidden" : ""}`}>
              Controls how strongly resume wording is optimized for this role.
            </p>
            {latestScore?.recommendation === "Skip" && (
              <p className="mt-1 text-xs font-semibold text-amber-700">Conservative mode recommended for lower-fit roles.</p>
            )}
          </div>
          <select
            aria-label="Tailoring intensity"
            className="min-w-36 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-bold text-brand-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            value={getEffectiveIntensity("resume", intensity, manualIntensity, latestScore)}
            onChange={(event) => {
              setManualIntensity(true);
              setIntensity(event.target.value);
            }}
          >
            {["Conservative", "Moderate", "Aggressive"].map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>
        {!compact && (
          <p className="mt-2 text-xs text-slate-600">
            {getIntensityDescription(getEffectiveIntensity("resume", intensity, manualIntensity, latestScore))}
          </p>
        )}
      </div>}
      {aiState.confirm && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Create a new version?</p>
          <p className="mt-1">This will keep the existing result and add a new history item.</p>
          <div className="mt-3 flex gap-2">
            <Button className="min-h-8 px-3 text-xs" onClick={() => runAi(aiState.confirm, { regenerate: true })}>Confirm regenerate</Button>
            <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => setAiState((current) => ({ ...current, confirm: "" }))}>Cancel</Button>
          </div>
        </div>
      )}
      {aiState.loading && <div ref={loadingRef}><AiSkeleton action={aiState.loading} /></div>}
      {showSlowHint && <LoadingHint />}
      {aiState.error && <MissingOrError message={aiState.error} />}
      {aiState.latest?.action === "fit" && !showOnboardingHelp && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          Analysis completed. You have a clearer view of this opportunity.
        </div>
      )}
      {aiState.latest?.action === "message" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          Recruiter message saved. Your outreach is ready when you are.
        </div>
      )}
      {!compact && (
        <>
          {activeTab === "fit" && <FitResult score={latestScore} onGenerate={() => runAi("fit")} onRegenerate={() => runAi("fit", { regenerate: true })} loading={aiState.loading} onRecruiterView={() => onTabChange?.("recruiterView")} />}
          {activeTab === "resume" && <ResumeResult resume={latestResume} job={job} score={latestScore} materials={{ resume: latestResume, coverLetter: latestCoverLetter, message: latestMessage }} analysisReady={Boolean(latestScore)} onAnalyze={() => onTabChange?.("fit")} onGenerate={() => runAi("resume")} onRegenerate={() => runAi("resume", { regenerate: true })} loading={aiState.loading} onExportComplete={onExportComplete} onOpenRecruiterView={() => onTabChange?.("recruiterView")} onOpenExport={() => onTabChange?.("export")} onOpenMessage={() => onTabChange?.("message")} onOpenInterview={() => onTabChange?.("interview")} />}
          {activeTab === "message" && <MessageResult message={latestMessage} score={latestScore} materials={{ resume: latestResume, coverLetter: latestCoverLetter, message: latestMessage }} analysisReady={Boolean(latestScore)} resumeReady={Boolean(latestResume)} coverLetterReady={Boolean(latestCoverLetter)} contacts={contacts} selectedContactId={selectedContactId} onContactChange={setSelectedContactId} onAnalyze={() => onTabChange?.("fit")} onResume={() => onTabChange?.("resume")} onSave={(message, patch) => updateMessage(user, message, patch)} onLogActivity={(type, metadata) => logJobActivity(user, job.id, type, metadata)} onGenerate={() => runAi("message")} onRegenerate={() => runAi("message", { regenerate: true })} loading={aiState.loading} />}
          <GenerationHistory scores={jobScoreHistory} resumes={resumeHistory} messages={messageHistory} />
        </>
      )}
    </section>
  );
}

function AiOnboardingHelpCard({ eyebrow, title, body, bullets = [], actionLabel, onAction, secondaryActionLabel = "", onSecondaryAction, disabled = false }) {
  return (
    <section className="rounded-xl border-l-4 border-l-brand-500 bg-gradient-to-r from-brand-50 via-white to-emerald-50 p-4 shadow-soft ring-1 ring-brand-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>
          <h3 className="mt-1 text-lg font-black text-ink">{title}</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{body}</p>
          {bullets.length > 0 && (
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {bullets.map((item) => (
                <span key={item} className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                  <span className="text-emerald-700" aria-hidden="true">{"\u2713"}</span>
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {secondaryActionLabel && (
            <Button variant="secondary" className="w-fit" onClick={onSecondaryAction} disabled={disabled}>
              {secondaryActionLabel}
            </Button>
          )}
          <Button className="w-fit" onClick={onAction} disabled={disabled}>
            <Sparkles size={15} aria-hidden="true" />
            {actionLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}

function getEffectiveIntensity(action, intensity, manualIntensity, latestScore) {
  if (action === "resume" && latestScore?.recommendation === "Skip" && !manualIntensity) return "Conservative";
  return intensity;
}

function getAiUsageField(action, job = {}, alreadyHasAiOutput = false) {
  if (job.ai_usage_counted_at || alreadyHasAiOutput) return "";
  if (["fit", "resume", "message"].includes(action)) return usageActions.application;
  return "";
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

function LoadingHint() {
  return <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">This can take a moment.</p>;
}

function getLoadingLabel(action) {
  return {
    fit: "Analyzing...",
    resume: "Tailoring...",
    message: "Generating...",
  }[action] ?? "Working...";
}

function getIntensityDescription(value) {
  return {
    Conservative: "Preserve most original skills and lightly reorder toward the role.",
    Balanced: "Prioritize the job description while preserving related skills that show broader experience and adaptability.",
    Moderate: "Recommended. Prioritize the job description while preserving related skills that show broader experience and adaptability.",
    Aggressive: "Optimize closely to the job description while retaining high-value adjacent skills.",
  }[value] || "Recommended. Prioritize the job description while preserving related skills that show broader experience and adaptability.";
}

function TailoringSettingsDisclosure({ intensity, latestScore, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-lg bg-white/85 p-3 shadow-sm ring-1 ring-brand-100">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="block text-sm font-bold text-ink">Job settings</span>
          <span className="block text-xs font-semibold text-slate-500">Tailoring intensity: {intensity}</span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-brand-700 transition duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3 rounded-lg bg-brand-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-900">Tailoring intensity</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{getIntensityDescription(intensity)}</p>
            {latestScore?.recommendation === "Skip" && (
              <p className="mt-1 text-xs font-semibold text-amber-700">Conservative mode recommended for lower-fit roles.</p>
            )}
          </div>
          <select
            aria-label="Tailoring intensity"
            className="min-w-40 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-bold text-brand-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            value={intensity}
            onChange={(event) => onChange(event.target.value)}
          >
            {["Conservative", "Moderate", "Aggressive"].map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>
      )}
    </section>
  );
}

function AiAction({ label, fullLabel, action, existing, activeTab, loading, onRun, onView }) {
  const active = loading === action;
  const selected = activeTab === action;
  const disabled = Boolean(loading);
  const text = existing ? `View ${label}` : fullLabel || label;
  return (
    <div className={`min-w-0 transition ${loading && !active ? "opacity-50" : ""}`}>
      <Button variant={selected ? "primary" : existing ? "secondary" : "primary"} className={`min-h-8 w-full px-3 text-xs sm:text-sm ${selected ? "shadow-soft" : ""}`} onClick={existing ? onView : () => onRun(action)} disabled={disabled}>
        {active && <Loader2 size={14} className="animate-spin" />}
        {active ? getLoadingLabel(action) : text}
      </Button>
    </div>
  );
}

function CompactGuidedAction({ activeAction, latestScore, latestResume, latestMessage, loading, onRun, onTabChange }) {
  const state = {
    fit: latestScore,
    resume: latestResume,
    message: latestMessage,
  };
  const existing = state[activeAction];
  const primary = getPrimaryAction(activeAction, existing, { latestScore, latestResume, latestMessage });
  return (
    <div className="flex flex-1 items-center justify-end">
      <Button
        className="min-h-9 px-4 text-sm"
        variant={primary.variant}
        onClick={() => {
          if (primary.nextTab) onTabChange?.(primary.nextTab);
          else onRun(activeAction);
        }}
        disabled={Boolean(loading)}
      >
        {loading === activeAction && <Loader2 size={14} className="animate-spin" />}
        {loading === activeAction ? getLoadingLabel(activeAction) : primary.label}
      </Button>
    </div>
  );
}

function getPrimaryAction(activeAction, existing, all) {
  if (activeAction === "fit" && existing) return { label: "Continue to Resume", nextTab: "resume", variant: "primary" };
  if (activeAction === "fit") return { label: "Analyze Fit", variant: "primary" };
  if (activeAction === "resume" && existing) return { label: "Ready to Export", nextTab: "resume", variant: "secondary" };
  if (activeAction === "resume") return { label: all.latestScore ? "Generate Resume" : "Analyze Fit First", nextTab: all.latestScore ? "" : "fit", variant: all.latestScore ? "primary" : "secondary" };
  if (activeAction === "message" && existing) return { label: "View Message", nextTab: "message", variant: "secondary" };
  if (activeAction === "message" && !all.latestScore) return { label: "Analyze Fit First", nextTab: "fit", variant: "secondary" };
  if (activeAction === "message" && !all.latestResume) return { label: "Generate Resume First", nextTab: "resume", variant: "secondary" };
  return { label: "Generate Recruiter Message", variant: "primary" };
}

function getLocalError(action, profile, job) {
  if (!canRunAi(profile)) return "Add your base resume before running AI tools.";
  if (!job?.job_description?.trim()) return "Paste the job description before running AI tools.";
  if (!["fit", "resume", "message"].includes(action)) return "That AI action is not available.";
  return "";
}

function AiSkeleton({ action }) {
  const copy = {
    fit: ["Analyzing your background against this role...", "Comparing your profile, base resume, and the saved job description."],
    resume: ["Optimizing your resume for this role...", "Refining your resume based on this job description."],
    message: ["Drafting a concise recruiter outreach message...", "Pulling out a couple of grounded strengths for a human note."],
  }[action];
  return (
    <div className="mt-4 rounded-lg border border-brand-100 bg-white p-6 text-center shadow-card">
      <div className="mx-auto flex max-w-xl flex-col items-center">
        <span className="h-9 w-9 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" />
        <p className="mt-4 font-bold text-brand-900">{copy[0]}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{copy[1]} This may take a few seconds.</p>
      </div>
      <div className="mx-auto mt-5 grid max-w-2xl gap-2">
        <div className="h-3 w-11/12 animate-pulse rounded bg-brand-100" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-brand-100" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-brand-100" />
      </div>
    </div>
  );
}

export function FitResult({ score, onGenerate, onRegenerate, onContinue, onRecruiterView, loading, showAction = true }) {
  const { isCompact } = useIntelligenceMode();
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  if (!score) return <EmptyAiState title="No fit analysis yet" description="Start with analysis so OccuBoard can identify fit, risks, keywords, and tailoring angles." action={showAction && onGenerate ? "Analyze Fit" : ""} onAction={onGenerate} loading={loading} />;
  const tone = getScoreTone(score.score);
  const allStrengths = score.strengths || [];
  const strengths = isCompact && !showFullAnalysis ? allStrengths.slice(0, 3) : allStrengths;
  const fullDetailsVisible = !isCompact || showFullAnalysis;
  return (
    <div className={`w-full animate-[fadeIn_260ms_ease-out] rounded-lg border p-4 shadow-card sm:p-4 ${tone.panel}`}>
      <AnalysisExecutiveSummary score={score} onContinue={onContinue} onRecruiterView={onRecruiterView} />
      {fullDetailsVisible && (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={`grid h-24 w-24 shrink-0 place-items-center rounded-full border-4 ${tone.ring}`}>
              <span className={`text-4xl font-black ${tone.score}`}>{score.score}</span>
            </div>
            <div>
              <p className={`text-lg font-black ${tone.score}`}>{tone.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Fit score</p>
              <p className="mt-1 text-xs text-slate-500">Saved {formatDate(score.created_at?.slice(0, 10))}</p>
            </div>
          </div>
          <RecommendationBadge value={score.recommendation} />
        </div>
      )}
      <p className="mt-3 rounded-lg bg-white/80 p-3 text-sm font-medium leading-6 text-slate-700">{score.summary}</p>
      <AiList title="Strengths" items={strengths} />
      <GapList gaps={score.gaps} gapAssessments={score.gapAssessments || score.gap_assessments} mitigationSuggestions={score.mitigationSuggestions || score.mitigation_suggestions} limit={isCompact && !showFullAnalysis ? 2 : undefined} />
      <MitigationStrategySummary score={score} />
      {isCompact && !showFullAnalysis && (
        <button
          type="button"
          className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand-800 ring-1 ring-brand-100 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
          aria-expanded={showFullAnalysis}
          onClick={() => setShowFullAnalysis(true)}
        >
          View full analysis
          <ChevronDown size={13} aria-hidden="true" />
        </button>
      )}
      {fullDetailsVisible && (
        <>
          <TransferableStrengths items={score.transferable_strengths || score.transferableStrengths} />
          <BetterAlignedRoles items={score.better_aligned_roles || score.betterAlignedRoles} />
          <AiList title="Keywords" items={score.keywords} inline />
          {isCompact && (
            <button
              type="button"
              className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand-800 ring-1 ring-brand-100 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
              onClick={() => setShowFullAnalysis(false)}
            >
              Hide full analysis
              <ChevronDown size={13} className="rotate-180" aria-hidden="true" />
            </button>
          )}
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {onRegenerate && <RegenerateButton label="Regenerate analysis" onClick={onRegenerate} disabled={Boolean(loading)} />}
      </div>
    </div>
  );
}

export function ResumeResult({ resume, job: currentJob, score, materials = {}, analysisReady = true, onAnalyze, onGenerate, onRegenerate, onExportComplete, onOpenRecruiterView, onOpenExport, onOpenMessage, onOpenInterview, loading, showAction = true, hideIndividualExport = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const { profile, jobs, updateResumeVersion } = useWorkspaceStore();
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(resume?.content || "");
  const [saveState, setSaveState] = useState("");
  const job = currentJob || (resume ? jobs.find((item) => item.id === resume.job_id) : null);
  const whyThisFits = extractWhyThisFits(draft);
  const displayResume = resume ? { ...resume, content: draft } : resume;
  useEffect(() => {
    setDraft(resume?.content || "");
    setEditOpen(false);
    setSaveState("");
  }, [resume?.id, resume?.content]);

  async function saveEdits() {
    if (!resume?.id || !draft.trim()) return;
    setSaveState("saving");
    try {
      await updateResumeVersion(user, resume.id, { content: draft });
      setSaveState("saved");
      toast.success("Resume edits saved.");
      window.setTimeout(() => setSaveState(""), 2200);
    } catch {
      setSaveState("error");
      toast.error("Could not save resume edits.");
    }
  }

  if (!resume && !analysisReady) return <EmptyAiState title="No tailored resume yet" description="Generate the fit analysis first so your resume can be tailored from the strongest evidence." action={showAction && onAnalyze ? "Analyze Fit" : ""} onAction={onAnalyze} loading={loading} />;
  if (!resume) return <EmptyAiState title="No tailored resume yet" description="Create an application-ready resume version using your base resume and this job." action={showAction && onGenerate ? "Generate Resume" : ""} onAction={onGenerate} loading={loading} />;
  return (
    <div id="tailored-resume-preview" className="w-full scroll-mt-6 rounded-lg bg-brand-50 p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-500">Ready to Apply</p>
          <h4 className="mt-1 font-bold">{resume.title}</h4>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Your tailored resume is ready. Review the polished version below, then continue to Recruiter View or export it from here.
          </p>
        </div>
        <CopyButton text={draft} />
      </div>
      <div className="mt-4 rounded-lg bg-white/90 p-3 ring-1 ring-brand-100">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-ink">Tailored Resume Ready</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">Choose the next application step without scrolling through the full resume.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onOpenRecruiterView && <Button className="min-h-8 px-3 text-xs" onClick={onOpenRecruiterView}>Review Recruiter View</Button>}
            {onOpenExport && <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={onOpenExport}>Export Resume</Button>}
            {onOpenMessage && <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={onOpenMessage}>Generate Recruiter Message</Button>}
            {onOpenInterview && <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={onOpenInterview}>Prepare Interview</Button>}
          </div>
        </div>
      </div>
      <ResumeFitImprovementSnapshot score={score} generatedText={draft} />
      {whyThisFits && (
        <div className="mt-4 rounded-lg bg-white/85 p-4 text-sm leading-6 text-slate-700">
          <p className="font-bold text-ink">Why this fits</p>
          <p className="mt-2">{whyThisFits}</p>
        </div>
      )}
      <RecruiterConfidenceIndicator label="Recruiter-ready positioning improved" />
      <RewriteVisibilityPanel material={displayResume} materials={{ ...materials, resume: displayResume }} score={score} originalText={profile?.base_resume_text} generatedText={draft} materialType="resume" className="mt-3" />
      {!hideIndividualExport && (
        <div className="mt-5">
          <ResumeExportPanel resume={displayResume} profile={profile} job={job} score={score} source="resume_page" compact onExportComplete={onExportComplete} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
          to={`/app/generated-resumes?resume=${resume.id}`}
        >
          View in Generated Resumes
        </Link>
      </div>
      <section className="mt-4 overflow-hidden rounded-lg bg-white/90 ring-1 ring-brand-100">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
          onClick={() => {
            setEditOpen((value) => !value);
          }}
          aria-expanded={editOpen}
        >
          <div>
            <p className="text-sm font-bold text-ink">Edit Resume</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">Optional. Saved edits update preview, copy, PDF, DOCX, and package export content.</p>
          </div>
          <ChevronDown size={16} className={`shrink-0 text-brand-700 transition ${editOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {editOpen && (
          <div className="border-t border-brand-100 p-4">
            <textarea
              className="min-h-[420px] w-full rounded-lg border border-brand-100 bg-white p-4 text-sm leading-6 text-slate-800 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setSaveState("dirty");
              }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button className="min-h-8 px-3 text-xs" onClick={saveEdits} disabled={saveState === "saving" || !draft.trim()}>
                {saveState === "saving" && <Loader2 size={14} className="animate-spin" />}
                {saveState === "saving" ? "Saving..." : "Save edits"}
              </Button>
              <Button variant="ghost" className="min-h-8 px-3 text-xs" onClick={() => { setDraft(resume.content || ""); setEditOpen(false); setSaveState(""); }}>
                Cancel
              </Button>
              {saveState === "dirty" && <span className="text-xs font-semibold text-amber-700">Unsaved changes</span>}
              {saveState === "saved" && <span className="text-xs font-semibold text-emerald-700">Saved</span>}
              {saveState === "error" && <span className="text-xs font-semibold text-rose-700">Could not save</span>}
            </div>
          </div>
        )}
      </section>
      <div className="mt-4 rounded-lg bg-white/85 p-3 ring-1 ring-brand-100">
        <p className="text-sm font-bold text-ink">Choose your next step</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {onOpenRecruiterView && <Button className="min-h-8 px-3 text-xs" onClick={onOpenRecruiterView}>Continue to Recruiter View</Button>}
          {onOpenExport && <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={onOpenExport}>Export Package</Button>}
          <Link className="inline-flex min-h-8 items-center rounded-lg bg-white px-3 text-xs font-bold text-brand-800 ring-1 ring-brand-100 hover:bg-brand-50" to="/app/new-jobs">Analyze Another Job</Link>
          {onOpenMessage && <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={onOpenMessage}>Optional: Generate Recruiter Message</Button>}
          {onOpenInterview && <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={onOpenInterview}>Optional: Prepare For Interview</Button>}
        </div>
      </div>
      {onRegenerate && <RegenerateButton label="Regenerate resume" onClick={onRegenerate} disabled={Boolean(loading)} />}
    </div>
  );
}

function ResumeFitImprovementSnapshot({ score, generatedText = "" }) {
  if (!score?.score) return null;
  const mitigationPlan = buildMitigationPlan(score);
  const recoveryScores = buildMaterialRecoveryScores({
    mitigationPlan,
    materials: { resume: { content: generatedText } },
  });
  const estimate = estimateOptimizedFit({
    baselineScore: score.score,
    recoveryScores,
    keywords: score.keywords,
    generatedText,
  });
  const delta = Math.max(0, Number(estimate.optimized || 0) - Number(estimate.initial || 0));
  return (
    <section className="mt-4 rounded-xl bg-white/90 p-3 shadow-sm ring-1 ring-brand-100 sm:p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">Fit Improvement</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <FitMetricCard label="Initial Fit" value={estimate.initial} tone="neutral" />
        <div className="text-center text-sm font-black text-brand-700">-&gt;</div>
        <FitMetricCard label="Optimized Fit" value={estimate.optimized} tone="success" />
      </div>
      <p className="mt-3 text-sm font-black text-emerald-800">
        {estimate.initial}% -&gt; {estimate.optimized}% {delta ? `(+${delta} improvement)` : "(positioning preserved)"}
      </p>
    </section>
  );
}

function FitMetricCard({ label, value, tone }) {
  return (
    <div className={`rounded-lg px-4 py-3 ring-1 ${tone === "success" ? "bg-emerald-50 text-emerald-900 ring-emerald-100" : "bg-slate-50 text-slate-800 ring-slate-100"}`}>
      <p className="text-xs font-bold uppercase tracking-[0.1em] opacity-75">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}%</p>
    </div>
  );
}

function AnalysisExecutiveSummary({ score, onContinue, onRecruiterView }) {
  const tone = getScoreTone(score.score);
  const readiness = calculateApplicationReadiness({ score });
  const considerations = getWeightedGaps(score.gaps, score.gapAssessments || score.gap_assessments, score.mitigationSuggestions || score.mitigation_suggestions);
  const topStrength = score.strengths?.[0] || readiness.strongestSignal;
  const mainConsideration = considerations[0]?.gap || readiness.biggestConsideration;
  const improvedCount = buildMitigationPlan(score).items.length;
  return (
    <section className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Executive Summary</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className={`text-4xl font-black ${tone.score}`}>{Math.round(Number(score.score))}</span>
            <span className={`text-lg font-black ${tone.score}`}>{tone.label}</span>
            <RecommendationBadge value={score.recommendation} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {onContinue && <Button className="min-h-9 px-3 text-xs" onClick={onContinue}>Continue to Resume</Button>}
          {onRecruiterView && <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={onRecruiterView}>View Recruiter View</Button>}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ExecutiveSummaryItem label="Top strength" value={topStrength} />
        <ExecutiveSummaryItem label="Main consideration" value={mainConsideration} />
        <ExecutiveSummaryItem label="Recruiter confidence" value={readiness.tier} />
        <ExecutiveSummaryItem label="Positioning improved" value={improvedCount ? `${improvedCount} hiring consideration${improvedCount === 1 ? "" : "s"} addressed` : "Ready for targeted tailoring"} />
      </div>
    </section>
  );
}

function ExecutiveSummaryItem({ label, value }) {
  return (
    <div className="rounded-lg bg-brand-50/70 p-3 ring-1 ring-brand-100">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold leading-5 text-slate-800">{value}</p>
    </div>
  );
}

export function MessageResult({ message, score, materials = {}, analysisReady = true, resumeReady = false, coverLetterReady = false, contacts = [], selectedContactId = "", onContactChange, onAnalyze, onResume, onSave, onLogActivity, onGenerate, onRegenerate, loading, showAction = true }) {
  const toast = useToast();
  const { profile } = useWorkspaceStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message?.content || "");
  const [saveState, setSaveState] = useState("");
  const associatedContact = contacts.find((contact) => contact.id === (message?.contact_id || selectedContactId));
  const readiness = [
    resumeReady && "Resume ready",
    coverLetterReady && "Cover letter ready",
  ].filter(Boolean);
  useEffect(() => {
    setDraft(message?.content || "");
    setEditing(false);
    setSaveState("");
  }, [message?.id, message?.content]);

  async function saveEdits() {
    if (!message || !draft.trim() || !onSave) return;
    setSaveState("saving");
    try {
      await onSave(message, { content: draft, contact_id: selectedContactId || message.contact_id || null });
      await onLogActivity?.("message_edited", { detail: "Recruiter message edited" });
      setSaveState("saved");
      setEditing(false);
      toast.success("Recruiter message saved.");
      window.setTimeout(() => setSaveState(""), 2200);
    } catch {
      setSaveState("error");
      toast.error("Could not save recruiter message.");
    }
  }

  async function copyMessage() {
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      await onLogActivity?.("message_copied", { detail: "Recruiter message copied" });
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not copy recruiter message.");
    }
  }

  if (!message) {
    if (!analysisReady) {
      return <EmptyAiState title="No recruiter message yet" description="Start with fit analysis before drafting outreach so the message is grounded in the strongest role evidence." action={showAction && onAnalyze ? "Analyze Fit" : ""} onAction={onAnalyze} loading={loading} />;
    }
    if (!resumeReady) {
      return <EmptyAiState title="No recruiter message yet" description="Generate the resume first, then draft a short outreach note that matches your application materials." action={showAction && onResume ? "Generate Resume" : ""} onAction={onResume} loading={loading} />;
    }
    return (
      <div className="grid gap-3">
        <MessageReadiness readiness={readiness} />
        <ContactSelector contacts={contacts} selectedContactId={selectedContactId} onContactChange={onContactChange} />
        <EmptyAiState title="No recruiter message yet" description="Create a short outreach message you can send to a recruiter or hiring contact." action={showAction && onGenerate ? "Generate Recruiter Message" : ""} onAction={onGenerate} loading={loading} />
      </div>
    );
  }
  return (
    <div className="w-full rounded-lg bg-brand-50 p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-bold">{normalizeMessageType(message.type)}</h4>
          <p className="text-xs text-slate-500">Saved {formatDate(message.created_at?.slice(0, 10))}</p>
          {associatedContact && <p className="mt-1 text-xs font-semibold text-brand-700">For: {associatedContact.name}</p>}
        </div>
        <Button variant="secondary" className="min-h-8 min-w-[72px] shrink-0 whitespace-nowrap px-3 text-xs" onClick={copyMessage}>
          <Clipboard size={14} aria-hidden="true" />
          Copy
        </Button>
      </div>
      <MessageReadiness readiness={readiness} />
      <ContactSelector contacts={contacts} selectedContactId={selectedContactId} onContactChange={onContactChange} />
      <RecruiterConfidenceIndicator label="Outreach positioning strengthened" className="mt-3" />
      {editing ? (
        <textarea
          className="mt-4 min-h-52 w-full rounded-lg border border-brand-100 bg-white p-4 text-sm leading-6 text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSaveState("dirty");
          }}
        />
      ) : (
        <p className="mt-4 whitespace-pre-wrap rounded-lg bg-white p-4 text-sm leading-6 text-slate-700">{draft}</p>
      )}
      <RewriteVisibilityPanel material={message} materials={materials} score={score} originalText={profile?.base_resume_text} generatedText={draft} materialType="message" className="mt-3" />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <Button className="min-h-8 px-3 text-xs" onClick={saveEdits} disabled={saveState === "saving" || !draft.trim()}>
              {saveState === "saving" && <Loader2 size={14} className="animate-spin" />}
              {saveState === "saving" ? "Saving..." : "Save edits"}
            </Button>
            <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => { setDraft(message.content || ""); setEditing(false); setSaveState(""); }}>Cancel</Button>
          </>
        ) : (
          <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => setEditing(true)}>Edit message</Button>
        )}
        {onRegenerate && <RegenerateButton label="Regenerate message" onClick={onRegenerate} disabled={Boolean(loading)} />}
        {saveState === "dirty" && <span className="text-xs font-semibold text-amber-700">Unsaved changes</span>}
        {saveState === "saved" && <span className="text-xs font-semibold text-emerald-700">Saved</span>}
        {saveState === "error" && <span className="text-xs font-semibold text-rose-700">Could not save</span>}
      </div>
    </div>
  );
}

function MitigationStrategySummary({ score }) {
  const { isCompact } = useIntelligenceMode();
  const plan = buildMitigationPlan(score);
  if (!plan.items.length) return null;
  if (isCompact) {
    return (
      <div className="mt-3 rounded-lg bg-white/85 p-3 shadow-sm ring-1 ring-brand-100">
        <p className="text-sm font-bold text-ink">Optimized positioning summary</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">OccuBoard strengthened operational positioning while preserving your original experience and tone.</p>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-lg bg-white/85 p-4 shadow-sm ring-1 ring-brand-100">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <Sparkles size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">Resume generation strategy</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">OccuBoard will use these findings when generating your application materials.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.items.map((item) => (
              <span key={item.id} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-100">
                {item.appliedLabel}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppliedMitigationList({ material, items, className = "" }) {
  const labels = items?.length ? items : getAppliedMitigationLabels(material);
  if (!labels.length) return null;
  return (
    <div className={`rounded-lg bg-white/85 p-3 text-sm ring-1 ring-brand-100 ${className}`}>
      <p className="font-bold text-ink">Improvements applied from analysis</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {labels.map((label) => (
          <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-100">
            <CheckCircle2 size={12} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ApplicationReadinessCard({ score, profile, resume, coverLetter, recruiterMessage, rewriteSections = [], compact = false, forceStrategic = false, className = "" }) {
  const readiness = calculateApplicationReadiness({ score, profile, resume, coverLetter, recruiterMessage, rewriteSections });
  const [expanded, setExpanded] = useState(false);
  const { isStrategic } = useIntelligenceMode();
  const strategicView = forceStrategic || isStrategic;
  const showDetails = strategicView || expanded;
  if (!score && !resume && !coverLetter && !recruiterMessage) return null;

  return (
    <section className={`rounded-xl bg-white/95 p-4 shadow-sm ring-1 ${strategicView ? "ring-brand-200" : "ring-brand-100"} ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-700">Recruiter Confidence</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="text-4xl font-black text-brand-950">{readiness.readiness}%</span>
            <h3 className="text-lg font-bold text-ink">{readiness.tier}</h3>
          </div>
        </div>
        <div className="min-w-40">
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${readiness.readiness}% recruiter confidence`}>
            <div className={`h-full rounded-full ${getReadinessBarTone(readiness.readiness)}`} style={{ width: `${readiness.readiness}%` }} />
          </div>
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "" : "md:grid-cols-3"}`}>
        <ReadinessSignal label="Strongest hiring signal" value={readiness.strongestSignal} tone="success" />
        <ReadinessSignal label="Primary concern" value={readiness.biggestConsideration} tone="neutral" />
        <ReadinessSignal label="Interview outlook" value={readiness.interviewLikelihood} tone="success" />
      </div>

      {!compact && (
        <button
          type="button"
          className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-800 ring-1 ring-brand-100 transition hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Hide calculation" : "How is this calculated?"}
          <ChevronDown size={13} className={`transition duration-200 ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}

      {showDetails && expanded && (
        <div className="mt-3 rounded-lg bg-slate-50/90 p-3 text-sm ring-1 ring-slate-200">
          <p className="font-bold text-ink">How Recruiter Confidence is calculated</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">Recruiter Confidence combines the signals below to estimate how clearly this application may move through an initial recruiter review.</p>
          <ul className="mt-2 grid gap-1.5 text-slate-700">
            <li>Match score and qualification alignment</li>
            <li>Missing qualifications and hiring considerations</li>
            <li>Transferable experience supported by the base resume</li>
            <li>Resume positioning strength and recruiter skim readability</li>
            <li>Hiring risk signals that may need clarification</li>
          </ul>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-600">Final Recruiter Confidence: {readiness.readiness}</p>
        </div>
      )}
    </section>
  );
}

function ReadinessSignal({ label, value, tone }) {
  return (
    <div className="rounded-lg bg-slate-50/80 p-3 ring-1 ring-slate-100">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-bold ${tone === "success" ? "text-emerald-800" : tone === "info" ? "text-brand-800" : "text-slate-700"}`}>{value}</p>
    </div>
  );
}

export function RecruiterConfidenceIndicator({ label = "Positioning improved", className = "" }) {
  return (
    <div className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-100 ${className}`}>
      <CheckCircle2 size={12} aria-hidden="true" />
      {label}
    </div>
  );
}

export function RewriteVisibilityPanel({ material, materials = {}, score, originalText = "", generatedText = "", materialType = "resume", forceStrategic = false, className = "" }) {
  const [expanded, setExpanded] = useState({});
  const { isCompact } = useIntelligenceMode();
  const compactView = isCompact && !forceStrategic;
  const mitigationPlan = buildMitigationPlan(score);
  const insights = buildRewriteInsights({
    originalText,
    generatedText,
    mitigationPlan,
    analysis: score,
    gaps: score?.gaps,
    strengths: score?.strengths,
    keywords: score?.keywords,
    materialType,
  }).sections;
  const appliedLabels = getAppliedMitigationLabels(material);
  const recovery = buildGapRecovery({ mitigationPlan, rewriteSections: insights, generatedText });
  const strategicRecovery = buildMaterialRecoveryScores({
    mitigationPlan,
    materials: {
      resume: materials.resume,
      coverLetter: materials.coverLetter,
      message: materials.message,
      current: { ...material, content: generatedText },
    },
    rewriteSections: insights,
  });
  const restraint = assessRewriteRestraint(originalText, generatedText);
  const maxRecoveryItems = compactView ? 2 : materialType === "resume" ? 4 : 2;
  const meaningfulRecovery = (strategicRecovery.length ? strategicRecovery : recovery).filter((item) => item.score > 0 || item.recovery !== "Unchanged").slice(0, maxRecoveryItems);
  const showPreservation = materialType === "resume" && restraint.preservationScore > 0;
  const strongRecoveries = meaningfulRecovery.filter((item) => item.recovery.startsWith("Strong")).length;
  const preservation = getPreservationCopy(restraint.preservationScore);
  const fitEstimate = estimateOptimizedFit({ baselineScore: score?.score, recoveryScores: meaningfulRecovery, rewriteSections: insights, keywords: score?.keywords, generatedText });

  if (!insights.length && !appliedLabels.length && !meaningfulRecovery.length && !showPreservation) return null;

  return (
    <section className={`rounded-lg bg-white/90 p-3 shadow-sm ring-1 ring-brand-100 sm:p-4 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-ink">Strengthened from analysis</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">Applied analysis findings to strengthen positioning.</p>
        </div>
        {showPreservation && (
          <span className="w-fit rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-100">
            {preservation.label}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {appliedLabels.length > 0 && <SummaryChip>{appliedLabels.length} improvement{appliedLabels.length === 1 ? "" : "s"}</SummaryChip>}
        {meaningfulRecovery.length > 0 && <SummaryChip>{strongRecoveries || meaningfulRecovery.length} {strongRecoveries ? "strong" : "active"} recover{(strongRecoveries || meaningfulRecovery.length) === 1 ? "y" : "ies"}</SummaryChip>}
        {showPreservation && <SummaryChip>{preservation.shortLabel}</SummaryChip>}
      </div>

      {fitEstimate && materialType === "resume" && (
        <div className="mt-3 rounded-lg bg-brand-50/70 p-3 ring-1 ring-brand-100">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold text-slate-600">Initial fit: {fitEstimate.initial}</span>
            <span className="font-bold text-brand-900">Optimized estimate: {fitEstimate.optimized}</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100">+{fitEstimate.delta} improvement</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">Estimate based on mitigation coverage, keyword recovery, and strengthened role alignment.</p>
        </div>
      )}

      {appliedLabels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {appliedLabels.map((label) => (
            <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-100">
              <CheckCircle2 size={12} aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
      )}

      {compactView && (
        <div className="mt-3 rounded-lg bg-brand-50/70 p-3 text-sm leading-6 text-slate-700 ring-1 ring-brand-100">
          OccuBoard strengthened operational positioning while preserving your original experience and tone.
        </div>
      )}

      {showPreservation && (
        <div className={`mt-3 rounded-lg bg-brand-50/70 p-3 text-sm text-slate-700 ring-1 ring-brand-100 ${compactView ? "hidden" : ""}`}>
          <p className="font-bold text-brand-900">{restraint.summary || preservation.label}</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">{restraint.preservationScore}% wording retained · tone {String(restraint.tonePreserved || "").toLowerCase()} · {String(restraint.keywordInjectionLevel || "light").toLowerCase()} keyword enhancement.</p>
        </div>
      )}

      {insights.length > 0 && (
        <div className={`mt-3 grid gap-2 ${compactView ? "" : "gap-3"}`}>
          {insights.slice(0, compactView ? (materialType === "resume" ? 2 : 1) : insights.length).map((section) => (
            <RewriteInsightCard
              key={section.id}
              section={section}
              materialType={materialType}
              recovery={meaningfulRecovery.find((item) => item.label === section.mitigationSource)}
              expanded={Boolean(expanded[section.id])}
              onToggle={() => setExpanded((current) => ({ ...current, [section.id]: !current[section.id] }))}
            />
          ))}
        </div>
      )}

      {meaningfulRecovery.length > 0 && (
        <div className={`mt-3 rounded-lg bg-white p-3 ring-1 ring-slate-100 ${compactView ? "hidden" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Gap recovery</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Recovery reflects improved positioning, not newly invented experience.</p>
          <div className="mt-3 grid gap-3">
            {meaningfulRecovery.map((item) => (
              <div key={item.gapId} className="grid gap-1.5 text-sm sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                <span className="min-w-0 text-slate-700">{item.label}</span>
                <RecoveryBar recovery={item.recovery} confidence={item.confidence} />
              </div>
            ))}
          </div>
        </div>
      )}
      {!compactView && strategicRecovery.length > 0 && <CoverageMatrix rows={strategicRecovery.slice(0, materialType === "resume" ? 4 : 3)} />}
      {!compactView && materialType === "resume" && (fitEstimate || appliedLabels.length > 0) && <RecoveryTimeline fitEstimate={fitEstimate} hasMessage={Boolean(materials.message)} hasResume={Boolean(materials.resume)} />}
    </section>
  );
}

export function RewriteInsightCard({ section, materialType, recovery, expanded, onToggle, compact = false }) {
  const changeId = `rewrite-change-${section.id}`;
  const addedItems = getAddedImprovementItems(section.category);
  return (
    <article className="rounded-lg bg-slate-50/80 p-3 ring-1 ring-slate-100 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-ink">{section.title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${recovery ? getRecoveryTone(recovery.recovery) : getRewriteConfidenceTone(section.confidence)}`}>
          {recovery?.recovery || capitalize(section.confidence)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-5 text-slate-600">{section.whyItHelps}</p>
      {addedItems.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Added</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {addedItems.map((item) => (
              <span key={item} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-100">
                <CheckCircle2 size={11} aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
      {!compact && (section.before || section.after) && (
        <div className="mt-3">
          <button
            type="button"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-brand-800 ring-1 ring-brand-100 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
            aria-expanded={expanded}
            aria-controls={changeId}
            onClick={onToggle}
          >
            {expanded ? "Hide wording change" : "View wording change"}
            <ChevronDown size={13} className={`transition duration-200 ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {expanded && (
            <div id={changeId} className={`mt-3 grid gap-2 ${materialType === "message" ? "" : "lg:grid-cols-2"}`}>
              <RewriteSnippet label="Before" text={section.before} />
              <RewriteSnippet label="After" text={section.after} emphasized />
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function SummaryChip({ children }) {
  return <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-100">{children}</span>;
}

export function RecoveryBar({ recovery, confidence }) {
  const percent = getRecoveryPercent(recovery);
  return (
    <div className="min-w-0" aria-label={`${recovery}: ${percent}% recovery strength`}>
      <div className="flex items-center gap-2">
        <div className="h-2 min-w-20 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${getRecoveryBarTone(recovery)}`} style={{ width: `${percent}%` }} />
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${getRecoveryTone(recovery)}`}>{recovery}</span>
      </div>
      {confidence && <p className="mt-1 text-[11px] font-semibold text-slate-500">{confidence}</p>}
    </div>
  );
}

export function CoverageMatrix({ rows }) {
  if (!rows.length) return null;
  return (
    <div className="mt-3 rounded-lg bg-white p-3 ring-1 ring-slate-100" title="Shows where OccuBoard strengthened positioning.">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Strategic coverage</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 pr-2 font-bold">Consideration</th>
              <th className="px-2 py-1 text-center font-bold">Resume</th>
              <th className="px-2 py-1 text-center font-bold">Cover Letter</th>
              <th className="px-2 py-1 text-center font-bold">Recruiter</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.gapId}>
                <td className="py-1.5 pr-2 font-semibold text-slate-700">{row.label}</td>
                <CoverageCell active={row.coverage.resume} type="covered" />
                <CoverageCell active={row.coverage.coverLetter} type="covered" />
                <CoverageCell active={row.coverage.recruiterMessage} type="reinforced" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CoverageCell({ active, type = "covered" }) {
  const label = active ? (type === "reinforced" ? "Reinforced" : "Covered") : "Missing";
  const tone = active
    ? type === "reinforced"
      ? "bg-brand-50 text-brand-800 ring-brand-100"
      : "bg-emerald-50 text-emerald-800 ring-emerald-100"
    : "bg-slate-50 text-slate-500 ring-slate-100";
  return (
    <td className="px-2 py-1.5 text-center">
      <span aria-label={label} title={label} className={`inline-flex min-h-6 items-center justify-center rounded-full px-2 text-[11px] font-bold ring-1 ${tone}`}>
        <span className="mr-1">{label}</span>
        {active ? "✓" : "—"}
      </span>
    </td>
  );
}

function RecoveryTimeline({ fitEstimate, hasResume, hasMessage }) {
  const items = [
    "Analysis complete",
    "Mitigation strategy generated",
    hasResume ? "Resume strengthened" : "",
    hasMessage ? "Recruiter positioning enhanced" : "",
    fitEstimate ? `Fit estimate improved +${fitEstimate.delta}` : "",
  ].filter(Boolean);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50/80 p-2.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-100">
      {items.map((item, index) => (
        <span key={item} className="inline-flex items-center gap-2">
          <span>{item}</span>
          {index < items.length - 1 && <span className="text-brand-300">→</span>}
        </span>
      ))}
    </div>
  );
}

function RewriteSnippet({ label, text, emphasized = false }) {
  return (
    <div className={`rounded-lg p-3 ring-1 ${emphasized ? "bg-brand-50 text-brand-950 ring-brand-100" : "bg-white text-slate-600 ring-slate-100"}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-6">{text}</p>
    </div>
  );
}

function getRewriteConfidenceTone(confidence) {
  return {
    strong: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    moderate: "bg-brand-50 text-brand-700 ring-brand-100",
    partial: "bg-slate-50 text-slate-600 ring-slate-100",
  }[confidence] ?? "bg-slate-50 text-slate-600 ring-slate-100";
}

function getAddedImprovementItems(category) {
  return {
    intake_escalation: ["intake tracking", "escalation coordination", "workflow ownership"],
    uat_rollout: ["rollout validation", "go-live readiness", "implementation testing"],
    onboarding_support: ["onboarding support", "user enablement", "adoption framing"],
    systems_adaptability: ["adjacent systems", "platform adaptability", "ERP/CRM transfer"],
    operational_support: ["hands-on support", "workflow follow-through", "operational coordination"],
    documentation_enablement: ["documentation", "training support", "enablement"],
    cross_functional_coordination: ["stakeholder coordination", "client communication", "team alignment"],
    seniority_softening: ["hands-on framing", "practical tone", "execution focus"],
  }[category] ?? [];
}

function getPreservationCopy(score) {
  if (score >= 80) return { label: "Highly preserved", shortLabel: "Voice highly preserved" };
  if (score >= 60) return { label: "Candidate voice mostly preserved", shortLabel: "Voice mostly preserved" };
  if (score >= 40) return { label: "Moderately rewritten", shortLabel: "Moderately rewritten" };
  return { label: "Heavily rewritten", shortLabel: "Heavily rewritten" };
}

function getRecoveryTone(recovery = "") {
  if (recovery.startsWith("Fully")) return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (recovery.startsWith("Strong")) return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (recovery.startsWith("Moderate")) return "bg-brand-50 text-brand-700 ring-brand-100";
  if (recovery.startsWith("Partial")) return "bg-amber-50 text-amber-700 ring-amber-100";
  return "bg-slate-50 text-slate-600 ring-slate-100";
}

function getRecoveryBarTone(recovery = "") {
  if (recovery.startsWith("Fully")) return "bg-emerald-500";
  if (recovery.startsWith("Strong")) return "bg-emerald-400";
  if (recovery.startsWith("Moderate")) return "bg-brand-500";
  if (recovery.startsWith("Partial")) return "bg-amber-400";
  return "bg-slate-300";
}

function getRecoveryPercent(recovery = "") {
  if (recovery.startsWith("Fully")) return 100;
  if (recovery.startsWith("Strong")) return 75;
  if (recovery.startsWith("Moderate")) return 50;
  if (recovery.startsWith("Partial")) return 25;
  return 8;
}

function getReadinessBarTone(readiness) {
  if (readiness >= 88) return "bg-emerald-500";
  if (readiness >= 78) return "bg-emerald-400";
  if (readiness >= 66) return "bg-brand-500";
  if (readiness >= 50) return "bg-amber-400";
  return "bg-slate-300";
}

function capitalize(value = "") {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function MessageReadiness({ readiness }) {
  if (!readiness.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {readiness.map((item) => (
        <span key={item} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700 ring-1 ring-brand-100">{item}</span>
      ))}
    </div>
  );
}

function ContactSelector({ contacts, selectedContactId, onContactChange }) {
  if (!contacts.length || !onContactChange) return null;
  return (
    <label className="mt-3 block text-xs font-semibold text-slate-600" htmlFor="message_contact">
      Associate message with contact
      <select
        id="message_contact"
        className="mt-1 w-full rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        value={selectedContactId}
        onChange={(event) => onContactChange(event.target.value)}
      >
        <option value="">No contact selected</option>
        {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
      </select>
    </label>
  );
}

export function GenerationHistory({ scores, resumes, messages }) {
  const [open, setOpen] = useState(false);
  const items = [
    ...scores.map((score) => ({ kind: "Fit Analysis", date: score.created_at, content: score.summary, score })),
    ...resumes.map((resume) => ({ kind: "Resume Draft", date: resume.updated_at || resume.created_at, content: resume.content, resume })),
    ...messages.map((message) => ({ kind: normalizeMessageType(message.type), date: message.created_at, content: message.content, message })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="mt-6 border-t border-brand-100 pt-4">
      <button type="button" className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-brand-50" onClick={() => setOpen((value) => !value)}>
        <span className="font-bold">Generation history</span>
        <span className="text-xs font-semibold text-brand-700">{items.length} item{items.length === 1 ? "" : "s"}</span>
      </button>
      {open && (
        <div className="mt-3 grid gap-3">
          {items.map((item, index) => <HistoryItem key={`${item.kind}-${item.date}-${index}`} item={item} index={index} total={items.length} />)}
        </div>
      )}
      {!items.length && (
        <p className="text-sm text-slate-500">Generated fit scores, resume drafts, and messages will appear here.</p>
      )}
    </div>
  );
}

function HistoryItem({ item, index, total }) {
  const title = item.score ? `Fit score: ${item.score.score}` : item.resume ? item.resume.title : normalizeMessageType(item.message.type);
  return (
    <div className="rounded-lg border border-brand-100 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{title}</p>
            {index === 0 && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-800">Latest</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Version {total - index} | Generated {formatDateTime(item.date)}
            {item.resume?.tailoring_intensity ? ` | ${item.resume.tailoring_intensity}` : ""}
            {item.resume?.recommendation ? ` | ${item.resume.recommendation}` : ""}
            {item.score?.recommendation ? ` | ${item.score.recommendation}` : ""}
          </p>
        </div>
        {item.content && <CopyButton text={item.content} />}
      </div>
    </div>
  );
}

function EmptyAiState({ title, description, action, onAction, loading }) {
  const active = Boolean(loading);
  return (
    <div className="rounded-lg border border-brand-100 bg-brand-50 p-5">
      <h4 className="font-bold text-brand-900">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      {onAction && action && (
        <Button className="mt-4 shadow-soft" onClick={onAction} disabled={active}>
          {active && <Loader2 size={14} className="animate-spin" />}
          {active ? getLoadingLabel(loading) : action}
        </Button>
      )}
    </div>
  );
}

function MissingOrError({ message }) {
  const needsProfile = message.includes("profile") || message.includes("base resume");
  return (
    <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">
      {message}
      {needsProfile && <Link className="ml-2 underline" to="/app/settings">Open profile setup</Link>}
    </div>
  );
}

function ResumeHeaderWarningModal({ open, missingItems = [], onCompleteProfile, onGenerateAnyway, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="resume-header-warning-title">
      <section className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl ring-1 ring-brand-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">Resume Header</p>
            <h2 id="resume-header-warning-title" className="mt-1 text-xl font-black text-ink">Your resume header is incomplete.</h2>
          </div>
          <button type="button" className="rounded-lg px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100" onClick={onClose} aria-label="Close resume header warning">
            X
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Adding contact details helps recruiters reach you and creates a stronger professional resume.
        </p>
        {missingItems.length > 0 && (
          <div className="mt-4 rounded-lg bg-brand-50/70 p-3 ring-1 ring-brand-100">
            <p className="text-sm font-black text-ink">Missing:</p>
            <ul className="mt-2 grid gap-1.5 text-sm font-semibold text-slate-700">
              {missingItems.map((item) => <li key={item.field}>{"\u2022"} {item.label}</li>)}
            </ul>
          </div>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onGenerateAnyway}>Generate Anyway</Button>
          <Button onClick={onCompleteProfile}>Complete Profile</Button>
        </div>
      </section>
    </div>
  );
}

function RegenerateButton({ label, onClick, disabled }) {
  return (
    <Button variant="ghost" className="mt-4 min-h-8 px-2 text-xs" onClick={onClick} disabled={disabled}>
      {disabled ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
      {disabled ? "Regenerating..." : label}
    </Button>
  );
}

function extractWhyThisFits(content = "") {
  const match = String(content).match(/(?:^|\n)\s*why this fits\s*:?\s*\n?([\s\S]*)$/i);
  return match?.[1]?.trim() || "";
}

function AiList({ title, items = [], inline = false }) {
  return (
    <div className="mt-4">
      <p className="text-sm font-bold">{title}</p>
      <div className={`mt-2 ${inline ? "flex flex-wrap gap-2" : "grid gap-2"}`}>
        {items.map((item) => (
          <span key={item} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">{item}</span>
        ))}
      </div>
    </div>
  );
}

function GapList({ gaps = [], gapAssessments = [], mitigationSuggestions = [], limit }) {
  const { isCompact } = useIntelligenceMode();
  const items = getWeightedGaps(gaps, gapAssessments, mitigationSuggestions);
  const visibleItems = Number.isFinite(Number(limit)) ? items.slice(0, Number(limit)) : items;
  const [expanded, setExpanded] = useState({});
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm font-bold">Hiring considerations</p>
        <p className="text-xs font-medium text-slate-500">Areas that may benefit from stronger positioning or clarification.</p>
      </div>
      <div className="mt-2 grid gap-2">
        {visibleItems.map((item, index) => {
          const text = item.gap;
          const key = `${normalizeText(text)}-${index}`;
          const coachingId = `gap-coaching-${index}-${normalizeText(text).slice(0, 28)}`;
          const mitigationItems = normalizeSuggestionItems(item.mitigationSuggestions);
          const hasSuggestions = Array.isArray(mitigationItems) && mitigationItems.length > 0;
          const isExpanded = expanded[key] ?? (!isCompact && item.severity === "critical");
          const suggestedPlacements = getSuggestedPlacements({ ...item, mitigationSuggestions: mitigationItems });
          const [quickWin, ...otherIdeas] = mitigationItems;
          return (
            <div key={text} className={`rounded-lg border-l-4 bg-white px-3 py-2.5 text-sm leading-6 text-slate-700 ring-1 ${getSeverityCardTone(item.severity)}`}>
              <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                <span className={`inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold leading-4 ${getSeverityBadgeTone(item.severity)}`}>
                  {getSeverityLabel(item.severity)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-6 text-slate-700">{getCompactConsiderationText(text, isCompact)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{getSeverityConfidenceCopy(item.severity)}</p>
                  {hasSuggestions && (
                    <button
                      type="button"
                      className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-extrabold text-brand-800 ring-1 ring-brand-200 shadow-sm transition hover:bg-brand-100 hover:text-brand-950 hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
                      aria-expanded={isExpanded}
                      aria-controls={coachingId}
                      onClick={() => setExpanded((current) => ({ ...current, [key]: !isExpanded }))}
                    >
                      <Lightbulb size={13} aria-hidden="true" />
                      {isExpanded ? "Hide strategy" : "How OccuBoard will use this"}
                      <ChevronDown size={13} className={`transition duration-200 ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              {hasSuggestions && isExpanded && (
                <div id={coachingId} className="mt-3 rounded-lg bg-brand-50/80 p-3 ring-1 ring-brand-100 transition duration-200 ease-out">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-700">How OccuBoard will use this</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">These considerations will inform the tailored resume, recruiter message, and interview prep.</p>
                  {quickWin && (
                    <div className="mt-3 rounded-lg bg-white/85 p-2.5 text-[13px] leading-5 text-slate-700 ring-1 ring-brand-100">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-700">Quick win</p>
                      <p className="mt-1">{formatOccuBoardSuggestion(quickWin)}</p>
                    </div>
                  )}
                  {otherIdeas.length > 0 && (
                    <>
                      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Other ideas</p>
                      <ul className="mt-1.5 grid gap-1.5 text-[13px] leading-5 text-slate-700">
                        {otherIdeas.map((suggestion) => (
                          <li key={suggestion} className="flex gap-2">
                            <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                            <span>{formatOccuBoardSuggestion(suggestion)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className="mt-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Suggested placement</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {suggestedPlacements.map((placement) => (
                        <span key={placement} className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-100">{placement}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getWeightedGaps(gaps = [], gapAssessments = [], mitigationSuggestions = []) {
  const normalizedGaps = normalizeArray(gaps);
  const normalizedAssessments = normalizeArray(gapAssessments);
  const normalizedMitigations = normalizeArray(mitigationSuggestions);
  const assessments = normalizedAssessments.length
    ? normalizedAssessments
    : normalizedGaps.map((gap) => {
        const text = getGapText(gap);
        const mitigation = findMitigationForGap(text, normalizedMitigations);
        return {
          gap: text,
          severity: gap?.severity || inferUiSeverity(text),
          confidence: gap?.confidence || "partial",
          mitigationSuggestions: getSuggestionItems(gap, mitigation),
        };
      });
  const severityRank = { critical: 0, moderate: 1, minor: 2, informational: 3 };
  const confidenceRank = { missing: 0, partial: 1, strong: 2 };
  return assessments
    .filter((item) => item?.gap)
    .map((item) => ({
      gap: item.gap,
      severity: normalizeSeverity(item.severity),
      confidence: normalizeConfidence(item.confidence),
      mitigationSuggestions: getSuggestionItems(item, findMitigationForGap(item.gap, normalizedMitigations)),
    }))
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || confidenceRank[a.confidence] - confidenceRank[b.confidence]);
}

function getGapText(gap) {
  if (typeof gap === "string") return gap;
  return gap?.gap || gap?.text || "";
}

function findMitigationForGap(gap, mitigationSuggestions = []) {
  const items = normalizeArray(mitigationSuggestions);
  const normalizedGap = normalizeText(gap);
  return items.find((item) => {
    const itemGap = normalizeText(item.gap);
    return itemGap && (itemGap === normalizedGap || itemGap.includes(normalizedGap.slice(0, 40)) || normalizedGap.includes(itemGap.slice(0, 40)));
  });
}

function getSuggestionItems(primary = {}, fallback = {}) {
  const direct = normalizeSuggestionItems(primary?.mitigationSuggestions ?? primary?.mitigation_suggestions ?? primary?.suggestions ?? primary?.mitigation);
  if (direct.length) return direct;
  const fallbackItems = normalizeSuggestionItems(fallback?.mitigationSuggestions ?? fallback?.mitigation_suggestions ?? fallback?.suggestions ?? fallback?.mitigation);
  if (fallbackItems.length) return fallbackItems;
  return getFallbackMitigationSuggestions(primary?.gap || primary?.text || primary || fallback?.gap || fallback?.text || "");
}

function formatOccuBoardSuggestion(suggestion = "") {
  const text = String(suggestion).trim();
  if (!text) return "";
  if (/^occuboard\s+will\b/i.test(text)) return text;
  const cleaned = text
    .replace(/^you\s+should\s+/i, "")
    .replace(/^prepare\s+/i, "prepare ")
    .replace(/^highlight\s+/i, "highlight ")
    .replace(/^mention\s+/i, "mention ")
    .replace(/^position\s+/i, "position ");
  return `OccuBoard will strengthen this by ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
}

function normalizeSuggestionItems(value) {
  return normalizeArray(value)
    .map((item) => {
      if (typeof item === "string") return item;
      return item?.suggestion || item?.text || item?.label || item?.content || "";
    })
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function inferUiSeverity(gap = "") {
  if (/\b(certification|required license|no relevant experience|no customer-facing|no onboarding)\b/i.test(gap)) return "critical";
  if (/\b(ITSM|service\s*desk|ownership|industry-specific|workflow experience)\b/i.test(gap)) return "moderate";
  if (/\b(BuildOps|Sage\s*Intacct|Smartsheet|UAT|platform|tool)\b/i.test(gap)) return "minor";
  if (/\b(junior|senior|startup|enterprise|environment|pace)\b/i.test(gap)) return "informational";
  return "moderate";
}

function normalizeSeverity(value) {
  return ["critical", "moderate", "minor", "informational"].includes(value) ? value : "moderate";
}

function normalizeConfidence(value) {
  return ["strong", "partial", "missing"].includes(value) ? value : "partial";
}

function getSeverityBadgeTone(severity) {
  return {
    critical: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    moderate: "bg-amber-50 text-amber-800 ring-1 ring-amber-100",
    minor: "bg-sky-50 text-slate-700 ring-1 ring-sky-100",
    informational: "bg-slate-50 text-slate-500 ring-1 ring-slate-100",
  }[severity] ?? "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
}

function getSeverityLabel(severity) {
  return {
    critical: "Critical",
    moderate: "Moderate",
    minor: "Minor",
    informational: "Info",
  }[severity] ?? "Moderate";
}

function getSeverityConfidenceCopy(severity) {
  return {
    critical: "Likely to impact screening.",
    moderate: "Worth addressing if possible.",
    minor: "Transferable experience likely offsets this.",
    informational: "Mostly framing/context.",
  }[severity] ?? "Worth addressing if possible.";
}

function getCompactConsiderationText(text, isCompact) {
  if (!isCompact) return text;
  const value = String(text || "");
  if (value.length <= 120) return value;
  return `${value.slice(0, 117).trim()}...`;
}

function getSuggestedPlacements(item = {}) {
  const text = normalizeText(`${item.gap || ""} ${(item.mitigationSuggestions || []).join(" ")}`);
  if (isUatValidationGap(text)) {
    return ["Resume", "Interview", "Cover letter"];
  }
  if (/\b(buildops|sage intacct|smartsheet|zendesk|servicenow|jira|platform|tool|system)\b/.test(text)) {
    return ["Recruiter message", "Interview"];
  }
  if (/\b(keyword|wording|uat|explicit|mention|listed|documentation|training|onboarding)\b/.test(text)) {
    return /\b(documentation|training|onboarding)\b/.test(text) ? ["Resume", "Cover letter"] : ["Resume"];
  }
  if (/\b(seniority|junior|senior|startup|enterprise|framing|context)\b/.test(text)) {
    return ["Recruiter message", "Interview"];
  }
  return ["Resume", "Recruiter message", "Interview"];
}

function getFallbackMitigationSuggestions(gap = "") {
  const text = normalizeText(gap);
  if (isUatValidationGap(text)) {
    const suggestions = [
      "Mention testing, validation, or rollout support from implementation projects.",
      "Use go-live preparation and client acceptance steps as UAT-adjacent experience.",
      "Highlight how you confirmed workflows, data mapping, or configurations before launch.",
      "Reference any stakeholder review, sign-off, or post-launch validation work.",
    ];
    if (isTicketingGap(text)) {
      suggestions.push("If relevant, connect Jira or workflow tracking to issue resolution during rollout.");
    }
    return suggestions;
  }
  if (isTicketingGap(text)) {
    return [
      "Position Jira workflow coordination as intake-tracking experience.",
      "Mention escalation coordination from implementation or support work.",
      "Connect onboarding support and issue-resolution workflows to service-desk readiness.",
    ];
  }
  if (/\b(buildops|sage intacct|smartsheet|platform|tool|erp|crm|system)\b/.test(text)) {
    return [
      "Emphasize ability to learn adjacent operational systems quickly.",
      "Reference similar ERP, CRM, or workflow tools already used.",
    ];
  }
  if (/\b(seniority|junior|senior|startup|enterprise|framing|context|overqualified)\b/.test(text)) {
    return [
      "Position yourself as hands-on and execution-focused.",
      "Emphasize interest in practical operational ownership.",
    ];
  }
  if (/\b(documentation|training|onboarding|enablement|guide|quick reference)\b/.test(text)) {
    return [
      "Highlight onboarding documentation and quick-reference guide creation.",
      "Connect training support to user enablement and adoption.",
    ];
  }
  return [];
}

function isUatValidationGap(text = "") {
  return /\b(uat|user acceptance testing|testing|validation|rollout validation|qa|quality assurance|go live testing|go live|acceptance criteria|release validation|implementation validation|process validation)\b/.test(text);
}

function isTicketingGap(text = "") {
  return /\b(itsm|ticket|ticketing|service desk|zendesk|servicenow|jira|intake|support queue|escalation)\b/.test(text);
}

function getSeverityCardTone(severity) {
  return {
    critical: "border-l-rose-300 ring-rose-100",
    moderate: "border-l-amber-300 ring-amber-100",
    minor: "border-l-sky-200 ring-slate-100",
    informational: "border-l-slate-200 ring-slate-100",
  }[severity] ?? "border-l-slate-200 ring-slate-100";
}

function normalizeText(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function TransferableStrengths({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <p className="text-sm font-bold">Transferable Strengths</p>
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <div key={`${item.skill}-${item.whyItMatters}`} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold text-ink">{item.skill}</span>
            <span className="block text-slate-600">{item.whyItMatters}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BetterAlignedRoles({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <p className="text-sm font-bold">Better Aligned Roles</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={`${item.role}-${item.reason}`}
            type="button"
            className="rounded-lg bg-white px-3 py-2 text-left text-sm text-brand-800 ring-1 ring-brand-100 hover:bg-brand-50"
            title={item.reason}
          >
            {item.role}
          </button>
        ))}
      </div>
    </div>
  );
}

function RecommendationBadge({ value }) {
  const tone = value === "Apply" ? "bg-emerald-100 text-emerald-700" : value === "Maybe" ? "bg-amber-100 text-amber-800" : "bg-rose-50 text-rose-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{value}</span>;
}

function getScoreTone(score) {
  const value = Number(score);
  const tone = getFitScoreTone(value);
  if (value >= 80) return { label: tone.label, panel: "border-emerald-200 bg-emerald-50", ring: "border-emerald-200 bg-white", score: "text-emerald-700" };
  if (value >= 70) return { label: tone.label, panel: "border-sky-200 bg-sky-50", ring: "border-sky-200 bg-white", score: "text-sky-700" };
  if (value >= 60) return { label: tone.label, panel: "border-amber-200 bg-amber-50", ring: "border-amber-200 bg-white", score: "text-amber-700" };
  return { label: tone.label, panel: "border-rose-100 bg-rose-50", ring: "border-rose-100 bg-white", score: "text-rose-700" };
}

function formatDateTime(value) {
  if (!value) return "Not dated";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function CopyButton({ text, label = "Copy", variant = "default", successMessage = "Copied to clipboard." }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(text || "");
      setCopied(true);
      toast.success(successMessage);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Could not copy text.");
    }
  }
  return (
    <button type="button" onClick={copy} className={`inline-flex min-h-8 min-w-[72px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${variant === "ghost" ? "bg-transparent" : ""}`}>
      <Clipboard size={14} className="shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap">{copied ? "Copied" : label}</span>
    </button>
  );
}

function getAiSuccessMessage(action) {
  return {
    fit: "Fit analysis saved.",
    resume: "Tailored resume saved.",
    message: "Recruiter message saved.",
  }[action] || "AI result saved.";
}

function getAiErrorMessage(action) {
  return {
    fit: "Could not analyze fit.",
    resume: "Could not tailor resume.",
    message: "Could not generate recruiter message.",
  }[action] || "Could not generate this yet.";
}
