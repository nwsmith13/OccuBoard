import { useEffect, useRef, useState } from "react";
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
  const profileRef = useRef(null);
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

  useEffect(() => {
    if (searchParams.get("section") !== "profile") return;
    window.setTimeout(() => profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [searchParams]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
      <div ref={profileRef} className="scroll-mt-24">
        <Card>
          <h2 className="text-xl font-bold">Profile and base resume</h2>
          <p className="mt-2 text-sm text-slate-600">Keep your core job search identity and resume text ready for each application.</p>
          <div className="mt-5">
            <ProfileForm />
          </div>
        </Card>
      </div>
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
          <h2 className="mt-1 text-xl font-bold">{pro ? "OccuBoard Pro Active" : "Free Plan"}</h2>
          <p className="mt-1 text-sm text-slate-600">{pro ? "Unlimited job search support is active." : `You have used ${Math.min(FREE_LIMIT, Number(usage.application_count || 0))} of ${FREE_LIMIT} free AI-powered applications.`}</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${pro ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-slate-50 text-slate-700 ring-slate-100"}`}>
          {pro ? "PRO" : planLabel}
        </span>
      </div>
      {billingMessage === "success" && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Checkout complete. Your subscription will update after Stripe confirms payment.</p>}
      {billingMessage === "cancelled" && <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">Checkout cancelled. You can upgrade anytime.</p>}
      {pro ? (
        <div className="mt-5 grid gap-4">
          <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-100">
            <p className="text-sm font-black text-emerald-950">Unlimited:</p>
            <ul className="mt-2 grid gap-1 text-sm font-semibold text-emerald-900">
              <li>• Applications</li>
              <li>• Resume generations</li>
              <li>• Recruiter messages</li>
              <li>• Interview prep</li>
            </ul>
            <p className="mt-1 text-xs font-semibold text-emerald-800">{getSubscriptionStatusText({ pro, subscription })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onManage} disabled={loading === "portal"}>{loading === "portal" ? "Opening..." : "Manage Subscription"}</Button>
            <Button variant="secondary" onClick={onRefresh}>Refresh Billing</Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          <div className="rounded-lg bg-brand-50 p-3 ring-1 ring-brand-100">
            {Number(usage.application_count || 0) >= FREE_LIMIT ? (
              <>
                <p className="text-sm font-black text-brand-950">{"You've used all 3 free AI-powered applications."}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">Upgrade to continue creating tailored resumes, recruiter messages, and interview preparation materials.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-black text-brand-950">Free Plan</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">You have used {Math.min(FREE_LIMIT, Number(usage.application_count || 0))} of {FREE_LIMIT} free AI-powered applications.</p>
              </>
            )}
            <div className="mt-3 rounded-lg bg-white/70 p-3 text-xs font-semibold leading-5 text-slate-700 ring-1 ring-white/80">
              <p className="font-black text-slate-800">Each application includes:</p>
              <ul className="mt-1 grid gap-1">
                <li>• Fit analysis</li>
                <li>• Resume tailoring</li>
                <li>• Recruiter messaging</li>
                <li>• Interview preparation</li>
              </ul>
            </div>
            <UsageBar value={usage.application_count} />
          </div>
          <div>
            <Button onClick={onUpgrade} disabled={loading === "checkout"}>{loading === "checkout" ? "Opening checkout..." : "🚀 Start OccuBoard Pro — $7/month"}</Button>
            <p className="mt-2 text-xs font-semibold text-slate-500">Cancel anytime.</p>
          </div>
        </div>
      )}
    </Card>
  );
}

function UsageBar({ value = 0 }) {
  const used = Math.min(FREE_LIMIT, Number(value || 0));
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-3 text-xs font-black text-brand-900">
        <span>AI-powered applications used</span>
        <span>{used} / {FREE_LIMIT}</span>
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
