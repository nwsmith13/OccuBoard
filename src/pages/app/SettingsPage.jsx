import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { createBillingPortalSession, createCheckoutSession, FREE_LIMIT, getPlanLabel, isProSubscription } from "../../lib/billing.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { ProfileForm } from "../../components/profile/ProfileForm.jsx";
import { ResumeImportCard } from "../../components/resume/ResumeImportCard.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";

export function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const { billing, refreshBilling } = useWorkspaceStore();
  const [billingLoading, setBillingLoading] = useState("");
  const subscription = billing?.subscription || {};
  const usage = billing?.usage || {};
  const pro = isProSubscription(subscription);

  async function startCheckout() {
    setBillingLoading("checkout");
    try {
      const url = await createCheckoutSession(user);
      window.location.assign(url);
    } catch (error) {
      toast.error(error.message || "Could not open checkout.");
    } finally {
      setBillingLoading("");
    }
  }

  async function openPortal() {
    setBillingLoading("portal");
    try {
      const url = await createBillingPortalSession(user);
      window.location.assign(url);
    } catch (error) {
      toast.error(error.message || "Could not open billing portal.");
    } finally {
      setBillingLoading("");
    }
  }

  async function refresh() {
    await refreshBilling(user);
    toast.success("Billing refreshed.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
      <Card>
        <h2 className="text-xl font-bold">Profile and base resume</h2>
        <p className="mt-2 text-sm text-slate-600">Keep your core job search identity and resume text ready for each application.</p>
        <div className="mt-5">
          <ProfileForm />
        </div>
      </Card>
      <div className="grid gap-6">
        <BillingCard
          billing={billing}
          billingMessage={searchParams.get("billing")}
          loading={billingLoading}
          onUpgrade={startCheckout}
          onManage={openPortal}
          onRefresh={refresh}
          planLabel={getPlanLabel(subscription)}
          pro={pro}
          subscription={subscription}
          usage={usage}
        />
        <ResumeImportCard compact />
        <Card>
          <h2 className="text-xl font-bold">Theme</h2>
          <p className="mt-2 text-sm text-slate-600">Theme controls will live here as the product grows.</p>
          <div className="mt-5 flex gap-3">
            <span className="h-10 w-10 rounded-full border-4 border-brand-200 bg-brand-700" />
            <span className="h-10 w-10 rounded-full border border-slate-200 bg-white" />
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-bold">Account management</h2>
          <p className="mt-2 text-sm text-slate-600">Manage authentication, export, and account deletion settings when backend flows are connected.</p>
          <Button variant="secondary" className="mt-5">Manage account</Button>
        </Card>
      </div>
    </div>
  );
}

function BillingCard({ billingMessage, loading, onUpgrade, onManage, onRefresh, planLabel, pro, subscription, usage }) {
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Billing</p>
          <h2 className="mt-1 text-xl font-bold">Current Plan</h2>
          <p className="mt-1 text-sm text-slate-600">{pro ? "OccuBoard Pro" : "Free"}</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${pro ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-slate-50 text-slate-700 ring-slate-100"}`}>
          {planLabel}
        </span>
      </div>
      {billingMessage === "success" && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Checkout complete. Your subscription will update after Stripe confirms payment.</p>}
      {billingMessage === "cancelled" && <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">Checkout cancelled. You can upgrade anytime.</p>}
      {pro ? (
        <div className="mt-5 grid gap-4">
          <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-100">
            <p className="text-sm font-black text-emerald-950">OccuBoard Pro</p>
            <p className="mt-1 text-sm text-emerald-900">$7/month</p>
            <p className="mt-1 text-xs font-semibold text-emerald-800">{getSubscriptionStatusText({ pro, subscription })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onManage} disabled={loading === "portal"}>{loading === "portal" ? "Opening..." : "Manage Subscription"}</Button>
            <Button variant="secondary" onClick={onRefresh}>Refresh Billing</Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          <div className="grid gap-2">
            <UsageRow label="Job analyses" value={usage.job_analyses_used} />
            <UsageRow label="Resume generations" value={usage.resume_generations_used} />
            <UsageRow label="Applications" value={usage.application_count} />
          </div>
          <Button onClick={onUpgrade} disabled={loading === "checkout"}>{loading === "checkout" ? "Opening checkout..." : "Upgrade to Pro - $7/month"}</Button>
        </div>
      )}
    </Card>
  );
}

function UsageRow({ label, value = 0 }) {
  const used = Math.min(FREE_LIMIT, Number(value || 0));
  return (
    <div className="rounded-lg bg-brand-50/70 p-3 ring-1 ring-brand-100">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-ink">{label}</p>
        <p className="text-sm font-black text-brand-900">{used} / {FREE_LIMIT}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.round((used / FREE_LIMIT) * 100)}%` }} />
      </div>
    </div>
  );
}

function getSubscriptionStatusText({ pro, subscription = {} }) {
  if (subscription.status === "past_due") return "Past due - Pro access remains available for now.";
  if (subscription.cancel_at_period_end && subscription.current_period_end) return `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`;
  if (pro) return "Active";
  return "Free";
}
