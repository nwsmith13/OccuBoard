import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";

const stackedLogo = "/occuboard-logo-stacked-on-dark.svg";

export function ForgotPasswordPage() {
  const { requestPasswordReset, isConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!isConfigured) {
      setSent(true);
      return;
    }
    setSubmitting(true);
    try {
      const response = await requestPasswordReset(email.trim());
      if (response?.error) {
        setError(response.error.message);
        return;
      }
      setSent(true);
    } catch {
      setError("We couldn't send the reset email. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center bg-[#07111F] px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(255,122,0,0.2),transparent_30%),linear-gradient(135deg,#07111F_0%,#0D1B2A_100%)]" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1B2A]/95 p-6 text-[#F8FAFC] shadow-soft">
        <Link to="/" className="mx-auto mb-4 block w-fit" aria-label="OccuBoard home">
          <img src={stackedLogo} alt="OccuBoard" className="h-auto w-48 object-contain sm:w-52" />
        </Link>
        {sent ? (
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-2xl text-emerald-700 ring-1 ring-emerald-100" aria-hidden="true">{"\u2713"}</span>
            <h1 className="mt-5 text-3xl font-bold">Check your email</h1>
            <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">Check your email for a password reset link.</p>
            <Link to="/login" className="mt-6 inline-flex"><Button>Back to login</Button></Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold">Reset your password</h1>
            <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">Enter your account email and we&apos;ll send you a secure reset link.</p>
            <form className="mt-6 grid gap-4" onSubmit={submit}>
              <Field id="reset_email" label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <Button type="submit" disabled={submitting}>{submitting ? "Sending..." : "Send reset link"}</Button>
            </form>
            <Link className="mt-5 block text-center text-sm font-semibold text-[#FFB26B] hover:text-[#FF7A00]" to="/login">Back to login</Link>
          </>
        )}
      </div>
    </div>
  );
}
