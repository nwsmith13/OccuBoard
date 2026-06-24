import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";

const stackedLogo = "/occuboard-logo-stacked.svg";

export function AuthForm({ mode, title, submitLabel, footer, notice = "", onSuccess }) {
  const { signIn, signUp, isConfigured } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!isConfigured) {
      onSuccess();
      return;
    }
    setSubmitting(true);
    try {
      const response =
        mode === "signup" ? await signUp(form.email, form.password, form.name) : await signIn(form.email, form.password);
      if (response?.error) {
        setError(getAuthErrorMessage(response.error.message, mode));
        return;
      }
      if (mode === "signup" && !response?.data?.session) {
        setConfirmationEmail(form.email.trim());
        return;
      }
      onSuccess(response);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "";
      if (mode === "signup" && /unexpected end of json|failed to execute ['"]json['"]/i.test(message)) {
        setConfirmationEmail(form.email.trim());
        return;
      }
      setError(mode === "signup" ? "We couldn't finish creating your account. Please try again." : "We couldn't sign you in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmationEmail) {
    return (
      <div className="relative grid min-h-screen place-items-center bg-[#07111F] px-4 py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,122,0,0.18),transparent_30%),linear-gradient(135deg,#07111F_0%,#0D1B2A_100%)]" aria-hidden="true" />
        <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 text-center shadow-soft">
          <Link to="/" className="mx-auto mb-8 block w-fit" aria-label="OccuBoard home">
            <img src={stackedLogo} alt="OccuBoard" className="h-auto w-40 object-contain sm:w-44" />
          </Link>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-2xl ring-1 ring-emerald-100" aria-hidden="true">
            ✓
          </span>
          <h1 className="mt-5 text-3xl font-bold">Check your email to confirm your account.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            We sent a confirmation link to <strong className="text-ink">{confirmationEmail}</strong>. Confirm your email before logging in.
          </p>
          <Link to="/login" className="mt-6 inline-flex">
            <Button>Back to login</Button>
          </Link>
          <nav className="mt-6 flex justify-center gap-4 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500" aria-label="Legal links">
            <Link className="hover:text-brand-800" to="/privacy">Privacy Policy</Link>
            <Link className="hover:text-brand-800" to="/terms">Terms of Service</Link>
          </nav>
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid min-h-screen place-items-center bg-[#07111F] px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(255,122,0,0.2),transparent_30%),radial-gradient(circle_at_84%_10%,rgba(34,197,94,0.12),transparent_25%),linear-gradient(135deg,#07111F_0%,#0D1B2A_100%)]" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 shadow-soft">
        <Link to="/" className="mx-auto mb-8 block w-fit" aria-label="OccuBoard home">
          <img src={stackedLogo} alt="OccuBoard" className="h-auto w-40 object-contain sm:w-44" />
        </Link>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">Analyze roles, strengthen applications, and stay ready for the next conversation.</p>
        {!isConfigured && (
          <div className="mt-5 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
            Supabase env vars are not set, so auth forms open the local demo workspace.
          </div>
        )}
        {notice && <p className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100">{notice}</p>}
        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          {mode === "signup" && <Field id="name" label="Name" name="name" value={form.name} onChange={update} required />}
          <Field id="email" label="Email" name="email" type="email" value={form.email} onChange={update} required />
          <Field id="password" label="Password" name="password" type="password" minLength={6} value={form.password} onChange={update} required />
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={submitting}>{submitting ? "Working..." : submitLabel}</Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-600">{footer}</p>
        <nav className="mt-4 flex justify-center gap-4 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500" aria-label="Legal links">
          <Link className="hover:text-brand-800" to="/privacy">Privacy Policy</Link>
          <Link className="hover:text-brand-800" to="/terms">Terms of Service</Link>
        </nav>
      </div>
    </div>
  );
}

function getAuthErrorMessage(message = "", mode = "login") {
  if (/already registered|already exists/i.test(message)) return "An account already exists for this email. Try logging in instead.";
  if (/invalid login credentials/i.test(message)) return "The email or password is incorrect.";
  if (/email not confirmed/i.test(message)) return "Confirm your email before logging in.";
  if (/rate limit|too many requests/i.test(message)) return "Please wait a moment before trying again.";
  return mode === "signup" ? "We couldn't create your account. Please try again." : "We couldn't sign you in. Please try again.";
}
