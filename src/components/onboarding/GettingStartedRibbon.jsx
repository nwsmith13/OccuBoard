import { CheckCircle2, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../ui/Button.jsx";
import { onboardingTrackerDismissedKey, writeBooleanFlag } from "../../lib/onboarding.js";

export function GettingStartedRibbon({ state, dismissed }) {
  const navigate = useNavigate();
  const location = useLocation();
  if (!state || dismissed || state.completed) return null;
  const currentId = getCurrentStepId(state);
  return (
    <section className="mb-4 rounded-2xl bg-white/95 px-3 py-3 shadow-sm ring-1 ring-brand-100 sm:px-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-brand-600">Getting Started</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">{state.complete} of {state.total} complete</p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          {state.steps.map((step) => (
            <button
              key={step.id}
              type="button"
              title={getStepGuidance(step)}
              onClick={() => {
                if (step.id === "resume" && location.pathname === "/app/resume-studio") {
                  window.dispatchEvent(new window.Event("occuboard:focus-resume-import"));
                  return;
                }
                navigate(getStepDestination(step.id, state.latestJobId));
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ring-1 transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${getStepTone(step, currentId)}`}
            >
              <span aria-hidden="true">{step.done ? "\u2713" : step.id === currentId ? "\u2192" : "\u25CB"}</span>
              {step.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function getStepDestination(stepId, jobId) {
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

function getStepGuidance(step) {
  if (step.done) return `${step.label} is complete. Open this section.`;
  return `Open ${step.label} to see how to complete this step.`;
}

export function CompletionRibbon({ state, dismissed, onDismiss }) {
  if (!state?.completed || dismissed) return null;
  return (
    <section className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-brand-50 px-4 py-4 shadow-sm ring-1 ring-emerald-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Finish Line</p>
          <h2 className="mt-1 text-xl font-black text-emerald-950">🎉 Application Package Complete</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Resume tailored", "Recruiter perspective reviewed", "Interview prep generated", "Application materials ready"].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-100">
                <CheckCircle2 size={13} aria-hidden="true" /> {item}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={state.latestJobId ? `/app/applications/${state.latestJobId}` : "/app/applications"} state={{ openJobTab: "overview", focus: "mark-applied" }}>
            <Button>Mark Applied</Button>
          </Link>
          <Link to="/app/new-jobs"><Button variant="secondary">Analyze Another Job</Button></Link>
          <button
            type="button"
            className="rounded-lg p-2 text-emerald-700 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
            onClick={() => {
              writeBooleanFlag(onboardingTrackerDismissedKey, true);
              onDismiss?.();
            }}
            aria-label="Dismiss completion message"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function getCurrentStepId(state) {
  return state.steps.find((step) => !step.done)?.id || "track";
}

function getStepTone(step, currentId) {
  if (step.done) return "bg-emerald-50 text-emerald-800 ring-emerald-100";
  if (step.id === currentId) return "bg-brand-50 text-brand-800 ring-brand-100";
  return "bg-slate-50 text-slate-600 ring-slate-100";
}
