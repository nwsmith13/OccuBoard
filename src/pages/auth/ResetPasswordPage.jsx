import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";

const stackedLogo = "/occuboard-logo-stacked.svg";

export function ResetPasswordPage() {
  const { updatePassword, isConfigured } = useAuth();
  const [form, setForm] = useState({ password: "", confirmation: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      if (isConfigured) {
        const response = await updatePassword(form.password);
        if (response?.error) {
          setError(response.error.message);
          return;
        }
      }
      setUpdated(true);
    } catch {
      setError("We couldn't update your password. Request a new reset link and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center bg-[#07111F] px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(255,122,0,0.2),transparent_30%),linear-gradient(135deg,#07111F_0%,#0D1B2A_100%)]" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 shadow-soft">
        <Link to="/" className="mx-auto mb-8 block w-fit" aria-label="OccuBoard home">
          <img src={stackedLogo} alt="OccuBoard" className="h-auto w-40 object-contain sm:w-44" />
        </Link>
        {updated ? (
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-2xl text-emerald-700 ring-1 ring-emerald-100" aria-hidden="true">{"\u2713"}</span>
            <h1 className="mt-5 text-3xl font-bold">Password updated</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Your OccuBoard password has been changed successfully.</p>
            <Link to="/login" className="mt-6 inline-flex"><Button>Back to login</Button></Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold">Choose a new password</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Use at least six characters and choose something unique to OccuBoard.</p>
            <form className="mt-6 grid gap-4" onSubmit={submit}>
              <Field id="new_password" label="New password" name="password" type="password" minLength={6} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
              <Field id="confirm_password" label="Confirm password" name="confirmation" type="password" minLength={6} value={form.confirmation} onChange={(event) => setForm((current) => ({ ...current, confirmation: event.target.value }))} required />
              {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <Button type="submit" disabled={submitting}>{submitting ? "Updating..." : "Update password"}</Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
