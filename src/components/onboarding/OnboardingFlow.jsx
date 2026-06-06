import { ArrowRight, CheckCircle2, FileText, Search, Sparkles, UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../ui/Button.jsx";

export function OnboardingFlow({ state, onDismiss }) {
  const step = getCurrentStep(state);
  const StepIcon = step.icon;
  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-emerald-50 px-4 py-8 text-ink sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center">
        <div className="rounded-3xl bg-white/95 p-5 shadow-soft ring-1 ring-brand-100 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-600">Step {step.stepNumber} of {state.total}</p>
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
            <Link to={step.href} onClick={step.dismissOnClick ? onDismiss : undefined} className="inline-flex">
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
              <div key={item.id} className={`rounded-xl px-3 py-2 ring-1 ${item.done ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-slate-50 text-slate-500 ring-slate-100"}`}>
                <p className="flex items-center gap-2 text-xs font-black">
                  <span>{item.done ? "\u2713" : "\u25CB"}</span>
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

function getCurrentStep(state) {
  if (!state.hasResume) {
    return {
      stepNumber: 1,
      icon: Sparkles,
      title: "Welcome to OccuBoard",
      subtitle: "Let's get your first application ready.",
      body: "OccuBoard helps you tailor resumes, organize applications, and stay focused on the opportunities most likely to convert into interviews.",
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
    title: "Your First Application Command Center Is Ready",
    subtitle: "You have completed the guided path.",
    body: "You created a tailored resume, reviewed recruiter perspective, prepared interview support, and exported an application package.",
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
