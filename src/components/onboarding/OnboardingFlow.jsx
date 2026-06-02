import { ArrowRight, CheckCircle2, FileText, Search, Sparkles, UploadCloud } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/Button.jsx";

export function OnboardingFlow({ state, onDismiss }) {
  const [introComplete, setIntroComplete] = useState(false);
  const step = getCurrentStep(state, introComplete);
  const StepIcon = step.icon;
  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-emerald-50 px-4 py-8 text-ink sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center">
        <div className="rounded-3xl bg-white/95 p-5 shadow-soft ring-1 ring-brand-100 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-600">Step {step.stepNumber} of 5</p>
              <div className="mt-5 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-800 ring-1 ring-brand-100">
                  <StepIcon size={24} />
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
            {step.onClick ? (
              <Button className="min-h-11 px-5" onClick={() => step.onClick({ setIntroComplete })}>
                {step.cta} <ArrowRight size={16} />
              </Button>
            ) : (
              <Link to={step.href} onClick={step.dismissOnClick ? onDismiss : undefined} className="inline-flex">
                <Button className="min-h-11 px-5">
                  {step.cta} <ArrowRight size={16} />
                </Button>
              </Link>
            )}
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

          <div className="mt-8 grid gap-2 sm:grid-cols-5">
            {state.steps.map((item) => (
              <div key={item.id} className={`rounded-xl px-3 py-2 ring-1 ${item.done ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-slate-50 text-slate-500 ring-slate-100"}`}>
                <p className="flex items-center gap-2 text-xs font-black">
                  <span>{item.done ? "✓" : "○"}</span>
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function getCurrentStep(state, introComplete = false) {
  if (!state.hasResume && !introComplete) {
    return {
      stepNumber: 1,
      icon: Sparkles,
      title: "Welcome to OccuBoard",
      subtitle: "Let's get your first application ready.",
      body: "OccuBoard helps you tailor resumes, organize applications, and stay focused on the opportunities most likely to convert into interviews.",
      cta: "Get Started",
      onClick: ({ setIntroComplete }) => setIntroComplete(true),
      allowSkip: true,
    };
  }
  if (!state.hasResume) {
    return {
      stepNumber: 2,
      icon: UploadCloud,
      title: "Upload Your Resume",
      subtitle: "Your resume becomes the foundation for every tailored version.",
      body: "Upload your current resume. We'll use it as the foundation for every tailored application.",
      cta: "Upload Resume",
      href: "/app/resume-studio#resume-import",
      allowSkip: true,
    };
  }
  if (!state.hasAnalysis) {
    return {
      stepNumber: 3,
      icon: Search,
      title: "Analyze a Job",
      subtitle: "See how well your experience aligns.",
      body: "Paste a job description or job posting URL to understand fit, strengths, and the next move.",
      cta: "Analyze Job",
      href: "/app/new-jobs",
      allowSkip: true,
    };
  }
  if (!state.hasTailoredResume) {
    return {
      stepNumber: 4,
      icon: FileText,
      title: "Review Your Match",
      subtitle: "See strengths, considerations, and opportunities before applying.",
      body: "Open the analyzed opportunity, review the match, then generate a tailored resume from the strongest evidence.",
      cta: "Continue",
      href: "/app/applications",
      allowSkip: true,
      preview: <MatchPreview score={state.latestScore} />,
    };
  }
  if (!state.hasExport) {
    return {
      stepNumber: 5,
      icon: UploadCloud,
      title: "Generate Application Materials",
      subtitle: "Create the pieces you need to apply confidently.",
      body: "Generate a tailored resume and any supporting materials you want, then download your application package.",
      cta: "Generate Resume",
      href: "/app/applications",
      allowSkip: true,
      preview: <MaterialsPreview />,
    };
  }
  return {
    stepNumber: 5,
    icon: CheckCircle2,
    title: "Your First Application Is Ready",
    subtitle: "You're ready to apply.",
    body: "OccuBoard will help you stay organized and focused as opportunities move forward.",
    cta: "Go To Applications",
    href: "/app/applications",
    secondaryCta: "Analyze Another Job",
    secondaryHref: "/app/new-jobs",
    allowSkip: false,
    dismissOnClick: true,
  };
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
      <PreviewItem title={Number.isFinite(match) ? `${Math.round(match)}% Match` : "Match %"} copy="A clear fit signal" />
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
