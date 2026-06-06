import { useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../../components/layout/Logo.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";

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
    <div className="grid min-h-screen place-items-center bg-brand-50 px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-brand-100 bg-white p-6 shadow-soft">
        <Link to="/" className="mb-8 block"><Logo /></Link>
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
