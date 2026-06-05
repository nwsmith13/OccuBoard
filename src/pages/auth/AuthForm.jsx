import { useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../../components/layout/Logo.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";

export function AuthForm({ mode, title, submitLabel, footer, onSuccess }) {
  const { signIn, signUp, isConfigured } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!isConfigured) {
      onSuccess();
      return;
    }
    setSubmitting(true);
    const response =
      mode === "signup" ? await signUp(form.email, form.password, form.name) : await signIn(form.email, form.password);
    setSubmitting(false);
    if (response.error) {
      setError(response.error.message);
      return;
    }
    onSuccess();
  }

  return (
    <div className="grid min-h-screen place-items-center bg-brand-50 px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-brand-100 bg-white p-6 shadow-soft">
        <Link to="/" className="mb-8 block"><Logo /></Link>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">Keep your job search organized from the first saved role to the final offer.</p>
        {!isConfigured && (
          <div className="mt-5 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
            Supabase env vars are not set, so auth forms open the local demo workspace.
          </div>
        )}
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
