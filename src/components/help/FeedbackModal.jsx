import { Loader2, Mail, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext.jsx";
import { feedbackTypes, submitFeedback } from "../../lib/feedbackService.js";
import { Button } from "../ui/Button.jsx";

const initialForm = {
  type: "Feedback",
  subject: "",
  message: "",
};

export function FeedbackModal({ open, type = "Feedback", userEmail = "", onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...initialForm, type });
  const [sending, setSending] = useState(false);
  const [fallbackMailto, setFallbackMailto] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ ...initialForm, type: type || "Feedback" });
      setFallbackMailto("");
    }
  }, [open, type]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape" && !sending) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, sending]);

  if (!open) return null;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (sending) return;
    if (!form.subject.trim() || !form.message.trim()) {
      toast.warning("Add a subject and message before sending.");
      return;
    }
    setSending(true);
    try {
      await submitFeedback({
        ...form,
        userEmail,
        currentUrl: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });
      toast.success("Thanks. Your message was sent.");
      onClose();
    } catch (error) {
      setFallbackMailto(error.mailto || "mailto:hello@occuboard.io");
      toast.error(error.message || "Could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/35 px-4 py-6" onMouseDown={() => !sending && onClose()}>
      <section
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-brand-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-brand-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-brand-100">
              <Mail size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">OccuBoard Support</p>
              <h2 id="feedback-title" className="mt-1 text-xl font-black text-ink">Send us a message</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Share feedback, report a bug, ask for help, or request a feature.</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
            onClick={onClose}
            disabled={sending}
            aria-label="Close feedback form"
          >
            <X size={20} />
          </button>
        </header>

        <form className="grid gap-4 px-5 py-5" onSubmit={handleSubmit}>
          <label className="grid gap-1.5 text-sm font-bold text-ink">
            Type
            <select
              className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              value={form.type}
              onChange={(event) => updateField("type", event.target.value)}
            >
              {feedbackTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-ink">
            Subject
            <input
              className="rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              value={form.subject}
              onChange={(event) => updateField("subject", event.target.value)}
              maxLength={140}
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-ink">
            Message
            <textarea
              className="min-h-36 rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm leading-6 text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              value={form.message}
              onChange={(event) => updateField("message", event.target.value)}
              required
            />
          </label>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-500 ring-1 ring-slate-100">
            We will include your account email, current page, browser, and timestamp so support has the context needed to help.
          </p>
          {fallbackMailto && (
            <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold leading-6 text-brand-900 ring-1 ring-brand-100">
              You can also email us directly at{" "}
              <a className="font-black underline decoration-brand-300 underline-offset-2" href={fallbackMailto}>hello@occuboard.io</a>.
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={sending}>Cancel</Button>
            <Button type="submit" disabled={sending}>
              {sending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {sending ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
