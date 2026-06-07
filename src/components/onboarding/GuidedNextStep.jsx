import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "../ui/Button.jsx";

export function GuidedNextStep({
  title,
  eyebrow = "",
  message = "",
  nextStep = "",
  actionLabel,
  onAction,
  secondaryLabel = "",
  onSecondary,
  disabled = false,
  compact = false,
  className = "",
}) {
  return (
    <section className={`rounded-xl border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 via-white to-brand-50 shadow-sm ring-1 ring-emerald-100 ${compact ? "p-4" : "p-5"} ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>}
          <div className="flex items-center gap-2">
            <CheckCircle2 size={19} className="shrink-0 text-emerald-700" aria-hidden="true" />
            <h3 className="text-lg font-black text-ink">{title}</h3>
          </div>
          {message && <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-700">{message}</p>}
          {nextStep && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              <span className="font-black text-brand-800">Next step:</span> {nextStep}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {secondaryLabel && (
            <Button variant="ghost" className="w-fit" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
          <Button className="w-fit" onClick={onAction} disabled={disabled}>
            {actionLabel} <ArrowRight size={15} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}
