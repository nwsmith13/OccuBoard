import { X } from "lucide-react";
import { Button } from "../ui/Button.jsx";

export function BillingLimitModal({ open, title, upgrading = false, onUpgrade, onClose }) {
  if (!open) return null;
  const benefits = ["Fit analyses", "Tailored resumes", "Recruiter messages", "Interview preparation materials"];
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/35 p-4" role="dialog" aria-modal="true" aria-labelledby="billing-limit-title">
      <section className="w-full max-w-md rounded-xl bg-white p-5 shadow-soft ring-1 ring-brand-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">OccuBoard Pro</p>
            <h2 id="billing-limit-title" className="mt-1 text-xl font-black text-ink">{title || "🎉 You've completed your free applications"}</h2>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100" onClick={onClose} aria-label="Close upgrade prompt">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 rounded-lg bg-brand-50 p-3 ring-1 ring-brand-100">
          <p className="text-sm font-black text-brand-950">{"You've already generated:"}</p>
          <ul className="mt-2 grid gap-1 text-sm font-semibold text-slate-700">
            {benefits.map((benefit) => <li key={benefit}>• {benefit}</li>)}
          </ul>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-700">Continue with unlimited applications and AI-powered job search tools.</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" className="w-full sm:w-fit" onClick={onClose}>Maybe Later</Button>
          <Button className="w-full sm:w-fit" onClick={onUpgrade} disabled={upgrading}>
            {upgrading ? "Opening checkout..." : "🚀 Start OccuBoard Pro — $7/month"}
          </Button>
        </div>
        <p className="mt-3 text-center text-xs font-semibold text-slate-500">Cancel anytime.</p>
      </section>
    </div>
  );
}
