import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { createBillingPortalSession, createCheckoutSession, FREE_LIMIT, getPlanLabel, isProSubscription, verifyCheckoutSession } from "../../lib/billing.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { ProfileForm } from "../../components/profile/ProfileForm.jsx";
import { ResumeImportCard } from "../../components/resume/ResumeImportCard.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";

export function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { billing, refreshBilling } = useWorkspaceStore();
  const [billingLoading, setBillingLoading] = useState("");
  const [checkoutSyncState, setCheckoutSyncState] = useState("");
  const profileRef = useRef(null);
  const handledBillingReturnRef = useRef("");
  const subscription = billing?.subscription || {};
  const usage = billing?.usage || {};
  const pro = isProSubscription(subscription);

  async function startCheckout() {
    setBillingLoading("checkout");
    try {
      const url = await createCheckoutSession(user);
      window.location.assign(url);
    } catch (error) {
      if (error.code === "already_pro" || error.message === "You already have OccuBoard Pro.") {
        await refreshBilling(user);
        toast.success("You're already on OccuBoard Pro.");
        return;
      }
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

  useEffect(() => {
    if (searchParams.get("section") !== "profile") return;
    window.setTimeout(() => profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [searchParams]);

  useEffect(() => {
    const billingReturn = searchParams.get("billing");
    const sessionId = searchParams.get("session_id");
    const returnKey = `${billingReturn || ""}:${sessionId || ""}`;
    if (!billingReturn || handledBillingReturnRef.current === returnKey) return;
    handledBillingReturnRef.current = returnKey;
    if (billingReturn === "success") {
      let cancelled = false;
      async function confirmSubscription() {
        setCheckoutSyncState("confirming");
        for (let attempt = 0; attempt < 10; attempt += 1) {
          if (cancelled) return;
          try {
            if (sessionId) await verifyCheckoutSession(user, sessionId);
            const latestBilling = await refreshBilling(user);
            if (isProSubscription(latestBilling?.subscription)) {
              if (cancelled) return;
              setCheckoutSyncState("active");
              toast.success("Subscription successful. Welcome to OccuBoard Pro.");
              return;
            }
          } catch (error) {
            if (attempt === 9) toast.error(error.message || "Subscription succeeded, but billing refresh did not complete. Try refreshing billing.");
          }
          await wait(1500);
        }
        if (!cancelled) setCheckoutSyncState("pending");
      }
      confirmSubscription();
      return () => {
        cancelled = true;
      };
    }
    setCheckoutSyncState("");
    if (billingReturn === "cancelled") {
      toast.info("Checkout cancelled. You can upgrade anytime.");
    }
  }, [refreshBilling, searchParams, toast, user]);

  return (
    <div className="grid gap-6">
      {searchParams.get("billing") === "success" && (
        <CheckoutSuccessCard
          syncState={checkoutSyncState}
          pro={pro}
          loading={billingLoading === "portal"}
          onStartJobs={() => navigate("/app/new-jobs")}
          onManage={openPortal}
        />
      )}
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
            planLabel={getPlanLabel(subscription)}
            pro={pro}
            subscription={subscription}
            usage={usage}
          />
          <ResumeImportCard compact />
          <Card>
            <h2 className="text-xl font-bold">Account management</h2>
            <p className="mt-2 text-sm text-slate-600">Manage authentication, export, and account deletion settings when backend flows are connected.</p>
            <Button variant="secondary" className="mt-5">Manage account</Button>
          </Card>
          <Card>
            <h2 className="text-xl font-bold">Legal</h2>
            <p className="mt-2 text-sm text-slate-600">Review OccuBoard&apos;s privacy and service terms.</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
              <Link className="text-brand-700 hover:text-brand-900" to="/privacy">Privacy Policy</Link>
              <Link className="text-brand-700 hover:text-brand-900" to="/terms">Terms of Service</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CheckoutSuccessCard({ syncState, pro, loading, onStartJobs, onManage }) {
  const pending = syncState === "pending" && !pro;
  const confirming = syncState === "confirming" && !pro;
  return (
    <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-brand-50 shadow-soft ring-1 ring-emerald-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">OccuBoard Pro</p>
          <h2 className="mt-1 text-2xl font-black text-ink">🎉 Welcome to OccuBoard Pro</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-700">
            {confirming
              ? "Confirming your Pro subscription..."
              : pending
                ? "Your payment was successful. We're still syncing your subscription. Refresh in a moment if Pro doesn't appear."
                : "Your subscription is active. You can now create unlimited AI-powered applications, tailored resumes, recruiter messages, interview prep, and application tracking."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onStartJobs}>Start analyzing jobs</Button>
          <Button variant="secondary" onClick={onManage} disabled={loading}>{loading ? "Opening..." : "Manage subscription"}</Button>
        </div>
      </div>
    </Card>
  );
}

function BillingCard({ billingMessage, loading, onUpgrade, onManage, planLabel, pro, subscription, usage }) {
  const used = Math.min(FREE_LIMIT, Number(usage.application_count || 0));
  const remaining = Math.max(0, FREE_LIMIT - used);
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Billing</p>
          <h2 className="mt-1 text-xl font-bold">{pro ? "OccuBoard Pro Active" : "Free Plan"}</h2>
          <p className="mt-1 text-sm text-slate-600">{pro ? "Create as many AI-powered applications as you need." : `${remaining} of ${FREE_LIMIT} free AI-powered applications remaining.`}</p>
        </div>
        <span className={`w-fit shrink-0 self-start rounded-full px-3 py-1 text-xs font-black ring-1 ${pro ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-slate-50 text-slate-700 ring-slate-100"}`}>
          {pro ? "PRO" : planLabel}
        </span>
      </div>
      {billingMessage === "cancelled" && <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">Checkout cancelled. You can upgrade anytime.</p>}
      {pro ? (
        <div className="mt-5 grid gap-4">
          <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-100">
            <h3 className="text-lg font-black text-emerald-950">🎉 You&apos;re unlimited!</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-emerald-900">Create as many AI-powered applications as you need.</p>
            <p className="mt-3 text-sm font-black text-emerald-950">Benefits:</p>
            <ul className="mt-2 grid gap-1 text-sm font-semibold text-emerald-900">
              <li>• Unlimited applications</li>
              <li>• Unlimited resume tailoring</li>
              <li>• Unlimited recruiter messages</li>
              <li>• Unlimited interview prep</li>
              <li>• Priority future features and improvements</li>
            </ul>
            <p className="mt-1 text-xs font-semibold text-emerald-800">{getSubscriptionStatusText({ pro, subscription })}</p>
          </div>
          <Button className="w-fit" onClick={onManage} disabled={loading === "portal"}>{loading === "portal" ? "Opening..." : "Manage Subscription"}</Button>
          <p className="text-xs font-semibold text-slate-500">Secure billing powered by Stripe. Cancel anytime.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          <div className="rounded-lg bg-brand-50 p-3 ring-1 ring-brand-100">
            {Number(usage.application_count || 0) >= FREE_LIMIT ? (
              <>
                <p className="text-sm font-black text-brand-950">{"You've already completed 3 AI-powered applications."}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">Continue with unlimited applications, resume tailoring, recruiter messaging, and interview preparation.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-black text-brand-950">Free Plan</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{remaining} of {FREE_LIMIT} free AI-powered applications remaining.</p>
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
            <p className="mt-2 text-xs font-semibold text-slate-500">Secure billing powered by Stripe. Cancel anytime.</p>
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

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
