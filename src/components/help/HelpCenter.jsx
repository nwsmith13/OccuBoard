import { ChevronRight, HelpCircle, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { restartProductTour } from "../../lib/onboarding.js";
import { trackProductEvent } from "../../lib/productAnalytics.js";
import { Button } from "../ui/Button.jsx";

const helpSections = [
  ["How OccuBoard Works", "Move from a base resume to role analysis, tailored materials, interview preparation, export, and application tracking."],
  ["Uploading Your Resume", "Upload a PDF, DOCX, or TXT resume. OccuBoard uses the extracted text as the evidence base for future materials."],
  ["Adding Jobs", "Paste the full job description whenever possible. A URL can be saved as context, but pasted text produces the strongest analysis."],
  ["Analyzing Fit", "Fit analysis highlights strengths, hiring considerations, keywords, and evidence-based positioning opportunities."],
  ["Tailoring Resumes", "Generated resumes strengthen relevant wording while staying grounded in experience already present in your base resume."],
  ["Recruiter View", "See likely first impressions, hesitation points, recovery, and where positioning was strengthened across materials."],
  ["Interview Preparation", "Prepare likely questions, STAR stories, company research, talking points, and topics recruiters may ask about."],
  ["Export Packages", "Choose the application and interview assets you want and download them as one focused package."],
  ["Application Tracking", "Track status, activity, follow-ups, contacts, notes, and tasks from each Job Command Center."],
  ["Billing & Subscription", "Free accounts include three AI-powered applications. OccuBoard Pro removes application limits and can be managed in Settings."],
  ["Privacy & Data Security", "Your account data is stored per authenticated user. Review the Privacy Policy in Settings for provider and deletion details."],
];

export function HelpCenter({ open, initialSection = "", onClose, onRestart }) {
  const [expanded, setExpanded] = useState(initialSection);

  useEffect(() => {
    if (open) setExpanded(initialSection);
  }, [initialSection, open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  function restartTour() {
    restartProductTour();
    trackProductEvent("tour_restarted");
    onRestart?.();
  }

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-ink/30" onMouseDown={onClose}>
      <section className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="help-center-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-brand-100 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">Help & Learning</p>
            <h2 id="help-center-title" className="mt-1 text-2xl font-black text-ink">OccuBoard Help Center</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Clear answers for every part of your application journey.</p>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-500 transition hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100" onClick={onClose} aria-label="Close Help Center">
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-2">
            {helpSections.map(([title, copy]) => {
              const selected = expanded === title;
              return (
                <section key={title} className="rounded-xl bg-slate-50/80 ring-1 ring-slate-200">
                  <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100" aria-expanded={selected} onClick={() => setExpanded(selected ? "" : title)}>
                    <span className="font-bold text-ink">{title}</span>
                    <ChevronRight size={17} className={`shrink-0 text-slate-400 transition ${selected ? "rotate-90" : ""}`} aria-hidden="true" />
                  </button>
                  {selected && <p className="border-t border-slate-200 px-4 py-3 text-sm leading-6 text-slate-600">{copy}</p>}
                </section>
              );
            })}
          </div>

          <section className="mt-5 rounded-xl bg-brand-50 p-4 ring-1 ring-brand-100">
            <div className="flex items-start gap-3">
              <HelpCircle size={20} className="mt-0.5 shrink-0 text-brand-700" aria-hidden="true" />
              <div>
                <h3 className="font-black text-ink">Want the guided walkthrough again?</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">Restarting the product tour does not remove your resume, jobs, or generated materials.</p>
                <Button variant="secondary" className="mt-3" onClick={restartTour}>
                  <RotateCcw size={15} aria-hidden="true" /> Restart Product Tour
                </Button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
