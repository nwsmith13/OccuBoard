import { ArrowRight, CheckCircle2, FileText, Search, Sparkles, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { clearProductTourRestart } from "../../lib/onboarding.js";
import { Button } from "../ui/Button.jsx";
import { getFitScoreTone } from "../ui/FitScoreBadge.jsx";

const occuboardLogo = "/assets/occuboard-logo.svg";
const occuboardIcon = "/assets/favicon.svg";

export function OnboardingFlow({ state, emailConfirmed = false, onEmailConfirmationAcknowledged, onDismiss }) {
  const onboardingCardRef = useRef(null);
  const scrollFrameRef = useRef(null);
  const highlightTimerRef = useRef(null);
  const [highlightOnboarding, setHighlightOnboarding] = useState(false);
  const step = getCurrentStep(state);
  const StepIcon = step.icon;
  const showConfirmationSuccess = emailConfirmed && step.stepNumber === 1;

  useEffect(() => () => {
    if (scrollFrameRef.current) window.cancelAnimationFrame(scrollFrameRef.current);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
  }, []);

  function highlightAndFocusOnboarding() {
    const card = onboardingCardRef.current;
    if (!card) return;
    card.focus({ preventScroll: true });
    setHighlightOnboarding(false);
    window.requestAnimationFrame(() => setHighlightOnboarding(true));
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlightOnboarding(false), 1800);
  }

  function focusOnboardingCard() {
    const card = onboardingCardRef.current;
    if (!card) return;
    const initialRect = card.getBoundingClientRect();
    const isFullyVisible = initialRect.top >= 0 && initialRect.bottom <= window.innerHeight;

    if (isFullyVisible) {
      highlightAndFocusOnboarding();
      return;
    }

    card.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    const startedAt = window.performance.now();
    let previousTop = initialRect.top;
    let stableFrames = 0;

    function waitForScroll() {
      const currentCard = onboardingCardRef.current;
      if (!currentCard) return;
      const currentTop = currentCard.getBoundingClientRect().top;
      stableFrames = Math.abs(currentTop - previousTop) < 1 ? stableFrames + 1 : 0;
      previousTop = currentTop;

      if (stableFrames >= 4 || window.performance.now() - startedAt > 1600) {
        scrollFrameRef.current = null;
        highlightAndFocusOnboarding();
        return;
      }
      scrollFrameRef.current = window.requestAnimationFrame(waitForScroll);
    }

    if (scrollFrameRef.current) window.cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = window.requestAnimationFrame(waitForScroll);
  }

  function handlePrimaryAction() {
    clearProductTourRestart();
    if (showConfirmationSuccess) onEmailConfirmationAcknowledged?.();
    if (step.dismissOnClick) onDismiss?.();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-emerald-50 px-4 py-8 text-ink sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center">
        {showConfirmationSuccess && <EmailConfirmedBanner onContinue={focusOnboardingCard} />}
        <div ref={onboardingCardRef} tabIndex={-1} className={`rounded-3xl bg-white/95 p-5 shadow-soft ring-1 ring-brand-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 sm:p-8 lg:p-10 ${highlightOnboarding ? "onboarding-card-highlight" : ""}`}>
          <img src={occuboardLogo} alt="OccuBoard" className="mx-auto mb-6 h-12 w-auto max-w-[220px] object-contain sm:h-14 sm:max-w-[260px]" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-600">Step {step.stepNumber} of {state.total}</p>
              <div className="mt-5 flex items-center gap-3">
                <span className={step.iconAsset ? "grid h-12 w-12 shrink-0 place-items-center" : "grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-800 ring-1 ring-brand-100"}>
                  {step.iconAsset ? <img src={step.iconAsset} alt="" className="h-12 w-12 object-contain" /> : <StepIcon size={24} />}
                </span>
                <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{step.title}</h1>
              </div>
              <p className="mt-3 text-lg font-semibold text-slate-700">{step.subtitle}</p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{step.body}</p>
            </div>
            <ProgressOrb complete={state.complete} total={state.total} />
          </div>

          {step.preview && <div className="mt-7">{step.preview}</div>}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to={step.href} state={step.actionState} onClick={handlePrimaryAction} className={`inline-flex rounded-lg ${step.stepNumber === 1 ? "onboarding-primary-action" : ""}`}>
              <Button className="min-h-11 px-5">
                {step.cta} <ArrowRight size={16} />
              </Button>
            </Link>
            {step.secondaryHref && (
              <Link to={step.secondaryHref} onClick={onDismiss} className="inline-flex">
                <Button variant="secondary" className="min-h-11 px-5">{step.secondaryCta}</Button>
              </Link>
            )}
            {step.allowSkip && (
              <button type="button" onClick={onDismiss} className="w-fit rounded-lg px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
                Skip for now
              </button>
            )}
          </div>

          <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {state.steps.map((item) => (
              <Link
                key={item.id}
                to={getTourStepDestination(item.id, state.latestJobId)}
                onClick={clearProductTourRestart}
                title={item.done ? `${item.label} is complete. Open this section.` : `Open ${item.label} for guidance.`}
                className={`rounded-xl px-3 py-2 ring-1 transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${item.done ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-slate-50 text-slate-500 ring-slate-100"}`}
              >
                <p className="flex items-center gap-2 text-xs font-black">
                  <span>{item.done ? "\u2713" : "\u25CB"}</span>
                  {item.label}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function getTourStepDestination(stepId, jobId) {
  const jobBase = jobId ? `/app/applications/${jobId}` : "/app/applications";
  return {
    resume: "/app/resume-studio#resume-import",
    job: "/app/new-jobs",
    fit: `${jobBase}?tab=fit`,
    resumeGenerated: `${jobBase}?tab=resume`,
    recruiterView: `${jobBase}?tab=recruiterView`,
    interviewPrep: `${jobBase}?tab=interview`,
    export: `${jobBase}?tab=export`,
    track: jobBase,
  }[stepId] || "/app/dashboard";
}

function getCurrentStep(state) {
  if (!state.hasResume) {
    return {
      stepNumber: 1,
      icon: null,
      iconAsset: occuboardIcon,
      title: "Welcome to OccuBoard",
      subtitle: "Your workspace is ready. Let's build your first application.",
      body: "Start by uploading your resume and we'll guide you through the rest.",
      cta: "Get Started",
      href: "/app/resume-studio#resume-import",
      allowSkip: true,
    };
  }
  if (!state.hasJob) {
    return {
      stepNumber: 2,
      icon: Search,
      title: "Add Your First Job",
      subtitle: "Create the opportunity workspace.",
      body: "Paste a job description or job posting URL so OccuBoard can open your first Job Command Center.",
      cta: "Analyze Job",
      href: "/app/new-jobs",
      allowSkip: true,
    };
  }
  if (!state.hasAnalysis) {
    return {
      stepNumber: 3,
      icon: FileText,
      title: "Analyze Fit",
      subtitle: "See how well your experience aligns.",
      body: "Open the opportunity, generate fit analysis, and review match score, strengths, and hiring considerations.",
      cta: "Open Applications",
      href: "/app/applications",
      allowSkip: true,
      preview: <MatchPreview score={state.latestScore} />,
    };
  }
  if (!state.hasTailoredResume) {
    return {
      stepNumber: 4,
      icon: UploadCloud,
      title: "Generate Resume",
      subtitle: "Create the first tailored asset.",
      body: "Generate a tailored resume from your fit analysis and base resume.",
      cta: "Generate Resume",
      href: "/app/applications",
      allowSkip: true,
      preview: <MaterialsPreview />,
    };
  }
  if (!state.hasRecruiterView) {
    return {
      stepNumber: 5,
      icon: Sparkles,
      title: "Recruiter View",
      subtitle: "See the hiring-team perspective.",
      body: "Review what looks strong, what may raise questions, and whether this application is ready to submit.",
      cta: "Open Recruiter View",
      href: "/app/applications",
      allowSkip: true,
    };
  }
  if (!state.hasInterviewPrep) {
    return {
      stepNumber: 6,
      icon: FileText,
      title: "Interview Prep",
      subtitle: "Prepare before the interview arrives.",
      body: "Generate likely questions, STAR stories, talking points, and a cheat sheet grounded in this role.",
      cta: "Open Interview Prep",
      href: "/app/applications",
      allowSkip: true,
    };
  }
  if (!state.hasExport) {
    return {
      stepNumber: 7,
      icon: UploadCloud,
      title: "Export Package",
      subtitle: "Download the application package.",
      body: "Choose the files and prep materials you want, then download one focused package.",
      cta: "Open Export",
      href: "/app/applications",
      allowSkip: true,
    };
  }
  return {
    stepNumber: 8,
    icon: CheckCircle2,
    title: "Application Package Complete",
    subtitle: "Your first application is ready to move forward.",
    body: "Your resume is tailored, recruiter perspective is reviewed, interview prep is generated, and application materials are ready.",
    cta: "Mark Applied",
    href: state.latestJobId ? `/app/applications/${state.latestJobId}` : "/app/applications",
    actionState: { openJobTab: "overview", focus: "mark-applied" },
    secondaryCta: "Analyze Another Job",
    secondaryHref: "/app/new-jobs",
    allowSkip: false,
    dismissOnClick: true,
  };
}

function EmailConfirmedBanner({ onContinue }) {
  return (
    <section className="mb-4 rounded-2xl bg-emerald-50 p-4 shadow-sm ring-1 ring-emerald-200 sm:p-5" aria-label="Email confirmation success">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200" aria-hidden="true">{"\u2713"}</span>
          <div>
            <h2 className="text-lg font-black text-emerald-950">Email confirmed</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-emerald-900">Your email has been verified and your workspace is ready.</p>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={onContinue} className="min-h-10 shrink-0 border-emerald-200 bg-white px-4 text-emerald-800 hover:bg-emerald-100">
          Get Started <ArrowRight size={15} aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}

function ProgressOrb({ complete, total }) {
  return (
    <div className="rounded-3xl bg-brand-50/70 p-5 text-center ring-1 ring-brand-100">
      <p className="text-4xl font-black text-brand-900">{complete}</p>
      <p className="text-sm font-bold text-slate-600">of {total} complete</p>
    </div>
  );
}

function MatchPreview({ score }) {
  const match = Number(score?.score);
  const strengths = Array.isArray(score?.strengths) ? score.strengths.slice(0, 2) : [];
  const gaps = Array.isArray(score?.gaps) ? score.gaps.slice(0, 2) : [];
  return (
    <div className="grid gap-3 rounded-2xl bg-brand-50/60 p-4 ring-1 ring-brand-100 sm:grid-cols-3">
      <PreviewItem title={Number.isFinite(match) ? `${Math.round(match)}% Match` : "Match %"} copy={Number.isFinite(match) ? getFitScoreTone(match).label : "A clear fit signal"} />
      <PreviewItem title="Top strengths" copy={strengths.length ? strengths.join("; ") : "What to lead with"} />
      <PreviewItem title="Key considerations" copy={gaps.length ? gaps.join("; ") : "What to position carefully"} />
    </div>
  );
}

function MaterialsPreview() {
  return (
    <div className="grid gap-3 rounded-2xl bg-brand-50/60 p-4 ring-1 ring-brand-100 sm:grid-cols-4">
      <PreviewItem title="Resume" copy="Tailored" />
      <PreviewItem title="Cover Letter" copy="Optional" />
      <PreviewItem title="Recruiter Message" copy="Ready to copy" />
      <PreviewItem title="Interview Prep" copy="When needed" />
    </div>
  );
}

function PreviewItem({ title, copy }) {
  return (
    <div className="rounded-xl bg-white/85 p-3 ring-1 ring-white/80">
      <p className="text-sm font-black text-ink">{title}</p>
      <p className="mt-1 text-xs font-semibold text-slate-600">{copy}</p>
    </div>
  );
}
