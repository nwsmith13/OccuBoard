import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  Mail,
  MessageCircleQuestion,
  PanelsTopLeft,
  ShieldCheck,
  Target,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FeedbackModal } from "../components/help/FeedbackModal.jsx";
import { Logo } from "../components/layout/Logo.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { PublicFooter } from "./LegalPage.jsx";

const materialFeatures = [
  ["Tailored Resume", FileText, "Strengthen role-specific positioning while preserving your experience and voice."],
  ["Recruiter Outreach", Mail, "Generate concise, role-aware messages that sound human and credible."],
  ["Cover Letter", Briefcase, "Create optional cover letters with professional, startup, or conversational tone."],
  ["Interview Preparation", MessageCircleQuestion, "Prepare likely questions, STAR stories, talking points, research, and responses to concern areas."],
];

const workflowSteps = [
  ["Add a Job", ClipboardList, "Paste the complete job description so OccuBoard can evaluate the role."],
  ["Analyze Fit", Target, "Review match strength, evidence, and hiring considerations."],
  ["Review Recruiter Perspective", Users, "See likely first impressions, concerns, and recruiter confidence."],
  ["Recover Considerations", ShieldCheck, "Turn true gaps into supported positioning opportunities."],
  ["Generate Materials", FileCheck2, "Create a tailored resume and optional outreach grounded in the analysis."],
  ["Apply", CalendarCheck, "Submit your application and mark the opportunity applied."],
  ["Prepare for Interviews", MessageCircleQuestion, "Use role-specific questions, STAR stories, talking points, and concern responses after you apply."],
];

const heroTabs = [
  { id: "recruiter", label: "Recruiter Perspective", icon: Users },
  { id: "resume", label: "Resume Optimization", icon: FileText },
  { id: "recovery", label: "Recovery Strategy", icon: ShieldCheck },
  { id: "interview", label: "Interview Preparation", icon: MessageCircleQuestion },
  { id: "package", label: "Application Package", icon: FileCheck2 },
];

const productTourSteps = [
  {
    label: "Recruiter Perspective",
    icon: Users,
    title: "See how recruiters may read the application.",
    description: "OccuBoard surfaces recruiter confidence, likely first impressions, strongest signal, and primary concern before the user applies.",
    rows: [
      ["Recruiter Confidence", "85%"],
      ["Strongest Hiring Signal", "Customer onboarding and product adoption experience"],
      ["Primary Concern", "Limited direct healthcare experience"],
      ["Recommended Action", "Apply after quick review"],
    ],
  },
  {
    label: "Resume Optimization",
    icon: FileText,
    title: "See what changed in the resume.",
    description: "OccuBoard strengthens supported experience instead of copying keywords or inventing industry background.",
    rows: [
      ["Before", "Managed customer onboarding."],
      ["After", "Led customer onboarding, stakeholder communication, and adoption follow-through to improve product engagement and retention."],
      ["What changed", "Added ownership, communication, adoption, and retention framing."],
      ["Why it changed", "The job values customer outcomes, cross-functional communication, and product adoption."],
      ["Truthful positioning note", "No invented healthcare experience or fabricated certifications."],
    ],
  },
  {
    label: "Recovery Strategy",
    icon: ShieldCheck,
    title: "Recover concerns without inventing experience.",
    description: "OccuBoard strengthens transferable positioning across resume, outreach, and interview talking points.",
    rows: [
      ["Concern", "Limited direct healthcare experience"],
      ["Recovery Strength", "Strong Recovery"],
      ["What OccuBoard Changed", "Strengthened customer success, adoption, and stakeholder communication evidence."],
      ["Considerations Addressed", "3 of 4"],
    ],
  },
  {
    label: "Interview Preparation",
    icon: MessageCircleQuestion,
    title: "Turn likely questions into coaching.",
    description: "OccuBoard prepares question context, evaluation criteria, answer direction, and related stories.",
    rows: [
      ["Likely Question", "Tell me about a time you improved customer adoption of a product or process."],
      ["Why They Ask It", "They want to understand ownership, communication, and follow-through."],
      ["What They Evaluate", "Customer judgment, stakeholder communication, and measurable impact."],
      ["Suggested Direction", "Use a customer onboarding or retention story with the challenge, coordination, and outcome."],
      ["Related Story", "Improving customer retention through proactive account management."],
      ["STAR Stories Ready", "3"],
    ],
  },
  {
    label: "Application Package",
    icon: FileCheck2,
    title: "Finish with a focused application package.",
    description: "The user gets the materials and tracking context needed to apply, then prepare for interviews.",
    rows: [
      ["Resume", "Optimized"],
      ["Recruiter Message", "Generated"],
      ["Cover Letter", "Optional"],
      ["Interview Preparation", "Ready"],
      ["Application Tracking", "Ready"],
    ],
  },
];

export function LandingPage() {
  const [tourOpen, setTourOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div className="w-full overflow-x-hidden bg-white pt-20 text-ink sm:pt-24 2xl:pt-28">
      <header className="fixed left-3 right-3 top-3 z-[70] mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-2xl border border-brand-100/80 bg-white/85 px-4 py-2 shadow-card backdrop-blur-xl sm:left-6 sm:right-6 sm:px-5 2xl:px-6 2xl:py-3">
        <Logo className="h-9 sm:h-12 2xl:h-16" />
        <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link className="hidden text-xs font-semibold text-slate-600 hover:text-brand-800 min-[420px]:inline sm:text-sm" to="/login">Login</Link>
          <Link to="/signup">
            <Button className="min-h-9 px-2.5 text-xs sm:px-3 sm:text-sm">Get Started</Button>
          </Link>
        </nav>
      </header>

      <main>
        <section id="hero" className="border-y border-brand-100 bg-gradient-to-b from-brand-50 to-white">
          <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-8 overflow-hidden px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-center lg:gap-7 lg:py-6 2xl:gap-10 2xl:py-20">
            <div className="min-w-0">
              <p className="mb-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-card lg:mb-3 lg:py-1.5 2xl:mb-4 2xl:py-2">
                AI-powered job application copilot
              </p>
              <h1 className="max-w-3xl text-4xl font-bold tracking-normal text-ink sm:text-5xl lg:text-[2.85rem] lg:leading-[1.04] 2xl:text-6xl">
                Understand the role. Strengthen your application. Apply with confidence.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 lg:mt-3 lg:text-base lg:leading-7 2xl:mt-6 2xl:text-lg 2xl:leading-8">
                OccuBoard analyzes each job against your real experience, identifies hiring considerations, and helps you build a truthful strategy for your resume, recruiter outreach, and interview preparation.
              </p>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-brand-800 lg:mt-3">
                No invented experience. No generic keyword stuffing. Just clearer positioning grounded in what you have actually done.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 lg:mt-4 2xl:mt-8">
                <Link to="/signup"><Button>Analyze Your First Job <ArrowRight size={18} /></Button></Link>
                <a href="#how-it-works"><Button variant="secondary">See How It Works</Button></a>
              </div>
              <div className="mt-6 flex max-w-3xl flex-wrap gap-2 lg:mt-3">
                {["Recruiter Confidence Analysis", "Hiring Consideration Detection", "Truthful Recovery Strategy", "Interview Preparation", "Application Tracking"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-800 shadow-sm ring-1 ring-brand-100">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <IntelligencePreview />
          </div>
        </section>

        <section id="know-before-you-apply" className="scroll-mt-28 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-9 2xl:py-12">
            <div className="grid gap-5 rounded-xl border border-brand-100 bg-brand-50/60 p-4 shadow-soft sm:p-5 lg:grid-cols-[0.75fr_1.25fr_auto] lg:items-center">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">Recruiter Perspective</p>
                <h2 className="mt-1 text-2xl font-bold text-ink">Know what may stand out before you apply.</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Recruiter Confidence", "85%", "Positioned strongly enough to move forward."],
                  ["Strongest Signal", "Customer onboarding", "Product adoption and stakeholder communication."],
                  ["Primary Concern", "Healthcare experience", "Recovered with supported adjacent evidence."],
                ].map(([label, value, description]) => (
                  <div key={label} className="rounded-lg border border-brand-100 bg-white p-3 shadow-card">
                    <p className="text-[11px] font-black uppercase tracking-[0.1em] text-brand-600">{label}</p>
                    <p className="mt-1 text-lg font-black text-ink">{value}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{description}</p>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" className="w-fit justify-center whitespace-nowrap" onClick={() => setTourOpen(true)}>
                Explore Product Tour
              </Button>
            </div>
          </div>
        </section>

        <section id="strategy" className="scroll-mt-28 bg-brand-50/60">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12 2xl:py-14">
            <ShowcaseGrid
              reverse
              visual={<RecoveryPreview />}
              eyebrow="Turn Insight Into Strategy"
              title="Turn hiring concerns into positioning opportunities."
              description="OccuBoard identifies concerns and shows how transferable experience, supporting evidence, and stronger positioning can improve application strength without inventing experience. It shows how concerns are addressed without fabricating qualifications."
              highlights={[
                ["Recovery Strength", "Strong recovery"],
                ["Considerations Addressed", "3 of 4"],
                ["Recovery Status", "Limited healthcare experience recovered with adjacent evidence"],
                ["Recovery Explanation", "OccuBoard strengthened customer onboarding, adoption, and stakeholder communication without overstating healthcare expertise."],
              ]}
            />
          </div>
        </section>

        <section id="coverage" className="scroll-mt-28 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12 2xl:py-14">
            <ShowcaseGrid
              visual={<CoveragePreview />}
              title="See how every concern is addressed."
              description="Track how each hiring consideration is covered across your resume, recruiter outreach, cover letter, and interview preparation."
              highlights={[
                ["Resume Coverage", "100%"],
                ["Recruiter Message Coverage", "75%"],
                ["Considerations Addressed", "4 of 4"],
                ["Coverage Visibility", "Resume, message, cover letter, and interview prep"],
              ]}
            />
          </div>
        </section>

        <section id="materials" className="scroll-mt-28 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12 2xl:py-14">
            <div className="mb-8 max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">Build Better Application Materials</p>
              <h2 className="mt-2 text-3xl font-bold">Carry the strategy through every application material.</h2>
              <p className="mt-3 leading-7 text-slate-600">
                Your analysis informs each generated asset, keeping the application focused, consistent, and grounded in your real background.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="grid gap-4 sm:grid-cols-2">
                {materialFeatures.map(([label, Icon, featureDescription]) => (
                  <Card key={label}>
                    <Icon className="mb-4 text-brand-700" size={24} />
                    <h3 className="text-lg font-bold">{label}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{featureDescription}</p>
                  </Card>
                ))}
              </div>
              <MaterialsPreview />
            </div>
          </div>
        </section>

        <section id="application-workspace" className="scroll-mt-28 border-y border-brand-100 bg-brand-50/70">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.7fr_1fr] lg:items-center lg:py-12 2xl:py-14">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">Application Workspace</p>
              <h2 className="mt-2 text-3xl font-bold">Keep everything together once your strategy is ready.</h2>
              <p className="mt-3 max-w-xl leading-7 text-slate-600">
                The place that keeps everything organized once your strategy is ready, without turning your job search into another spreadsheet.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Applications", "Follow-ups", "Notes and contacts", "Generated materials", "Interview preparation"].map((item) => (
                  <span key={item} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-800 shadow-sm ring-1 ring-brand-100">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <WorkspacePreview />
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-28 mx-auto max-w-7xl px-4 py-12 sm:px-6 2xl:py-16">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">How It Works</p>
            <h2 className="mt-2 text-3xl font-bold">From job description to application strategy.</h2>
          </div>
          <WorkflowPreview />
        </section>

      </main>

      <footer className="border-t border-brand-100 bg-ink px-4 py-12 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Know what to strengthen before you apply.</h2>
            <p className="mt-2 text-brand-100">Turn your next job description into a realistic fit assessment, recruiter perspective, recovery strategy, and application plan.</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Link to="/signup"><Button variant="secondary">Analyze Your First Job</Button></Link>
            <p className="text-sm font-semibold text-brand-100">
              Questions?{" "}
              <button type="button" className="underline decoration-brand-200 underline-offset-4 hover:text-white" onClick={() => setFeedbackOpen(true)}>
                Contact us
              </button>{" "}
              at hello@occuboard.io.
            </p>
          </div>
        </div>
      </footer>
      <PublicFooter onContact={() => setFeedbackOpen(true)} />
      {tourOpen ? <ProductTourModal onClose={() => setTourOpen(false)} /> : null}
      <FeedbackModal open={feedbackOpen} type="Support Question" onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}

function ShowcaseGrid({ visual, eyebrow = "", title, description, highlights, reverse = false }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
      <div className={`min-w-0 ${reverse ? "order-2" : ""}`}>{visual}</div>
      <div className={`min-w-0 ${reverse ? "order-1" : ""}`}>
        {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p> : null}
        <h3 className="text-3xl font-bold text-ink">{title}</h3>
        <p className="mt-3 max-w-xl leading-7 text-slate-600">{description}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {highlights.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-brand-100 bg-white p-3 shadow-card">
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-brand-600">{label}</p>
              <p className="mt-1 text-sm font-bold leading-5 text-ink">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntelligencePreview() {
  const [activeTab, setActiveTab] = useState("recruiter");
  const [paused, setPaused] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const active = heroTabs.find((tab) => tab.id === activeTab) || heroTabs[0];
  const ActiveIcon = active.icon;

  useEffect(() => {
    if (paused) return undefined;
    if (typeof window === "undefined") return undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return undefined;
    const timer = window.setInterval(() => {
      setActiveTab((current) => {
        const currentIndex = heroTabs.findIndex((tab) => tab.id === current);
        return heroTabs[(currentIndex + 1) % heroTabs.length].id;
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [paused]);

  const handleSelect = (tabId) => {
    setActiveTab(tabId);
    setPaused(true);
  };

  return (
    <div id="intelligence-preview" className="min-w-0 rounded-xl border border-brand-100 bg-white p-2.5 shadow-soft sm:p-3 2xl:p-4">
      <div className="mb-2.5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap 2xl:mb-3" role="tablist" aria-label="Hero product preview">
        {heroTabs.map(({ id, label, icon: Icon }) => {
          const selected = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-black transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 2xl:min-h-10 2xl:gap-2 2xl:px-3 2xl:py-2 2xl:text-xs ${
                selected ? "bg-brand-700 text-white shadow-card" : "bg-brand-50 text-brand-800 ring-1 ring-brand-100 hover:bg-white hover:shadow-card"
              }`}
              onClick={() => handleSelect(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </div>
      <div className="rounded-lg border border-brand-100 bg-gradient-to-b from-white to-brand-50/70 p-3 shadow-card sm:p-4 2xl:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-brand-100 pb-3 2xl:pb-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-600">{active.label}</p>
            <p className="mt-1 break-words font-bold text-ink">Live application intelligence preview</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ActiveIcon className="text-brand-500" size={21} />
            <Button type="button" variant="secondary" className="min-h-8 justify-center px-2.5 text-[11px]" onClick={() => setTourOpen(true)}>
              Tour
            </Button>
          </div>
        </div>
        <HeroPreviewPanel activeTab={activeTab} />
      </div>
      {tourOpen ? <ProductTourModal onClose={() => setTourOpen(false)} /> : null}
    </div>
  );
}

function HeroPreviewPanel({ activeTab }) {
  if (activeTab === "resume") {
    return (
      <div className="mt-3 grid gap-2.5 2xl:mt-4 2xl:gap-3">
        <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
          <PreviewMetric label="Resume Optimized" value="+6" tone="emerald" />
          <div className="rounded-lg bg-white p-2.5 ring-1 ring-brand-100 2xl:p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-brand-600">Strengthened</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Onboarding ownership", "Stakeholder communication", "Product adoption", "Process improvement"].map((item) => (
                <span key={item} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-800 ring-1 ring-brand-100 2xl:px-2.5 2xl:py-1 2xl:text-xs">{item}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-3">
          <PreviewDetail label="Before" value="Managed customer onboarding." />
          <PreviewDetail
            label="After"
            value="Led customer onboarding, stakeholder communication, and adoption follow-through to improve product engagement and retention."
            tone="green"
          />
        </div>
        <div className="rounded-lg bg-brand-50 p-2.5 ring-1 ring-brand-100 2xl:p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.1em] text-brand-700">Truthful positioning note</p>
          <p className="mt-1 text-sm font-bold leading-6 text-brand-900">No invented healthcare experience. No fabricated certifications. No generic keyword stuffing.</p>
        </div>
      </div>
    );
  }

  if (activeTab === "recovery") {
    return (
      <div className="mt-3 grid gap-2.5 2xl:mt-4 2xl:gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <InsightRow label="Concern" value="Limited direct healthcare experience" tone="amber" />
          <PreviewMetric label="Recovery Strength" value="Strong" tone="emerald" />
        </div>
        <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-100 2xl:p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.1em] text-emerald-700">What OccuBoard Changed</p>
          <p className="mt-1 text-sm font-bold leading-6 text-emerald-900">
            Strengthened transferable customer success and adoption experience across the resume, recruiter outreach, and interview talking points.
          </p>
        </div>
        <div className="rounded-lg bg-white p-2.5 ring-1 ring-brand-100 2xl:p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-brand-600">Considerations Addressed</p>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-black text-brand-700">3 of 4</span>
          </div>
          <RecoveryBar percent={75} label="Recovery coverage" />
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100 2xl:p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">Truthfulness reminder</p>
          <p className="mt-1 text-sm font-bold text-slate-800">Recovered with supported experience, not invented claims.</p>
        </div>
      </div>
    );
  }

  if (activeTab === "interview") {
    return (
      <div className="mt-3 grid gap-2.5 2xl:mt-4 2xl:gap-3">
        <div className="rounded-lg bg-brand-50 p-3 ring-1 ring-brand-100 2xl:p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.1em] text-brand-700">Likely Question</p>
          <p className="mt-1 text-base font-black leading-6 text-brand-950 2xl:text-lg">Tell me about a time you improved customer adoption of a product or process.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InsightRow label="Why They Ask It" value="They want to understand ownership, communication, and follow-through." tone="blue" />
          <InsightRow label="What They Are Evaluating" value="Customer judgment, stakeholder communication, and measurable impact." tone="green" />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1.3fr_0.7fr]">
          <PreviewDetail
            label="Suggested Answer Direction"
            value="Use a customer onboarding or retention story. Explain the challenge, what you changed, who you coordinated with, and the outcome."
            tone="green"
          />
          <PreviewMetric label="STAR Stories Ready" value="3" tone="emerald" />
        </div>
        <PreviewDetail label="Related Story" value="Improving customer retention through proactive account management." />
      </div>
    );
  }

  if (activeTab === "package") {
    return (
      <div className="mt-3 grid gap-2.5 2xl:mt-4 2xl:gap-3">
        <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-100 2xl:p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.1em] text-emerald-700">Application Package Ready</p>
          <p className="mt-1 text-xl font-black text-emerald-950">Ready to apply with a focused package.</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">Recommended next step: Apply, then prepare for interviews.</p>
        </div>
        <PreviewPanelRows rows={[
          ["Resume", "Optimized"],
          ["Recruiter Message", "Generated"],
          ["Cover Letter", "Optional"],
          ["Interview Preparation", "Ready"],
          ["Application Tracking", "Ready"],
        ]} />
        <PreviewMetric label="Recruiter Confidence" value="85%" tone="brand" />
      </div>
    );
  }

  return (
      <div className="mt-3 grid gap-2.5 2xl:mt-4 2xl:gap-3">
      <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg bg-brand-50 p-3 ring-2 ring-brand-100 shadow-card 2xl:p-4">
          <p className="text-xs font-black uppercase tracking-[0.1em] text-brand-700">Recruiter Confidence</p>
          <p className="mt-1 text-4xl font-black text-brand-900 2xl:text-5xl">85%</p>
          <p className="mt-2 text-xs leading-5 text-brand-800">Likelihood this application is positioned strongly enough to move forward.</p>
        </div>
        <div className="grid gap-3">
          <InsightRow label="Strongest Hiring Signal" value="Customer onboarding and product adoption experience" tone="green" />
          <InsightRow label="Primary Concern" value="Limited direct healthcare experience" tone="amber" />
          <InsightRow label="Recommended Action" value="Apply After Quick Review" tone="blue" />
        </div>
      </div>
      <div className="rounded-lg bg-white p-2.5 ring-1 ring-brand-100 2xl:p-3">
        <p className="text-[11px] font-black uppercase tracking-[0.1em] text-brand-600">Recruiters May Notice First</p>
        <div className="mt-2 grid gap-2">
          {["Customer-facing ownership", "Stakeholder communication", "Retention improvement"].map((item) => (
            <div key={item} className="flex gap-2 rounded-lg bg-slate-50 p-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-100">
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={15} />
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecoveryPreview() {
  return (
    <ProductFrame label="Recovery" title="Hiring consideration recovery" icon={<ShieldCheck size={21} />}>
      <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-100">
        <p className="text-[11px] font-black uppercase tracking-[0.1em] text-amber-700">Concern</p>
        <p className="mt-1 text-sm font-bold text-amber-900">Limited direct healthcare experience</p>
      </div>
      <div className="mt-3 rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-100">
        <p className="text-[11px] font-black uppercase tracking-[0.1em] text-emerald-700">Recovery</p>
        <p className="mt-1 text-sm font-bold leading-6 text-emerald-900">OccuBoard strengthened adjacent customer onboarding, product adoption, and stakeholder communication experience without overstating healthcare expertise.</p>
      </div>
      <div className="mt-3 rounded-lg bg-white p-3 ring-1 ring-brand-100">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.1em] text-brand-600">Highest Impact Recovery</p>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Fully addressed</span>
        </div>
        <p className="font-bold text-ink">Strengthened customer success and adoption positioning</p>
        <RecoveryBar percent={100} label="Recovery Strength" />
      </div>
      <div className="mt-3 grid gap-3">
        <RecoveryRow concern="Healthcare experience" status="Partial recovery" percent={45} tone="amber" />
        <RecoveryRow concern="Enterprise account ownership" status="Strong recovery" percent={78} tone="green" />
        <RecoveryRow concern="Product adoption outcomes" status="Fully addressed" percent={100} tone="green" />
      </div>
      <div className="mt-3 rounded-lg bg-brand-50 p-3 ring-1 ring-brand-100">
        <p className="text-[11px] font-black uppercase tracking-[0.1em] text-brand-700">Recovery Explanation</p>
        <p className="mt-1 text-sm leading-6 text-brand-900">Recovered with supported customer success experience, not invented healthcare claims.</p>
      </div>
    </ProductFrame>
  );
}

function CoveragePreview() {
  const rows = [
    ["Customer onboarding", "Covered", "Covered", "Covered", "Covered"],
    ["Healthcare experience", "Covered", "Partial", "Partial", "Covered"],
    ["Enterprise accounts", "Covered", "Covered", "Missing", "Covered"],
    ["Retention improvement", "Covered", "Covered", "Covered", "Covered"],
  ];

  return (
    <ProductFrame label="Coverage" title="Strategic coverage matrix" icon={<CheckCircle2 size={21} />}>
      <div className="grid gap-3 sm:grid-cols-3">
        <PreviewMetric label="Resume Coverage" value="100%" tone="emerald" />
        <PreviewMetric label="Recruiter Message" value="75%" tone="brand" />
        <PreviewMetric label="Considerations Addressed" value="4/4" tone="emerald" />
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-brand-100">
        <div className="grid grid-cols-[1.4fr_repeat(4,0.8fr)] bg-brand-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-brand-700">
          <span>Concern</span>
          <span>Resume</span>
          <span>Message</span>
          <span>Letter</span>
          <span>Prep</span>
        </div>
        {rows.map(([concern, resume, message, letter, prep]) => (
          <div key={concern} className="grid grid-cols-[1.4fr_repeat(4,0.8fr)] items-center border-t border-brand-100 px-3 py-2 text-xs">
            <span className="font-semibold text-ink">{concern}</span>
            {[resume, message, letter, prep].map((status, index) => <CoverageDot key={`${concern}-${index}`} status={status} />)}
          </div>
        ))}
      </div>
    </ProductFrame>
  );
}

function MaterialsPreview() {
  return (
    <ProductFrame label="Generated Materials" title="Analysis-backed application package" icon={<FileText size={21} />}>
      <div className="flex flex-wrap gap-2">
        {["Resume", "Recruiter Message", "Cover Letter", "Interview Preparation"].map((tab, index) => (
          <span key={tab} className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${index === 0 ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-brand-800 ring-brand-100"}`}>
            {tab}
          </span>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-brand-100 bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-black text-ink">Customer Success Manager</p>
            <p className="text-sm text-slate-500">Tailored resume preview</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Optimized +6</span>
        </div>
        <div className="mt-4 grid gap-3">
          <MaterialLine text="Led customer onboarding, stakeholder communication, and adoption follow-through across customer-facing accounts." />
          <MaterialLine text="Strengthened retention improvement, process documentation, and product engagement language using supported experience." />
          <MaterialLine text="Positioned CRM, account coordination, and process improvement experience as evidence of customer success readiness." />
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-brand-50 p-3 ring-1 ring-brand-100">
        <p className="text-[11px] font-black uppercase tracking-[0.1em] text-brand-700">Strengthened from analysis</p>
        <p className="mt-1 text-sm font-bold text-brand-900">Added adoption, retention, and stakeholder communication framing from the analysis.</p>
      </div>
    </ProductFrame>
  );
}

function WorkflowPreview() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
      {workflowSteps.map(([title, Icon, description], index) => (
        <div key={title} className="relative">
          <Card className="h-full">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-700 text-white">
                <Icon size={20} />
              </div>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-black text-brand-700">{index + 1}</span>
            </div>
            <h3 className="text-base font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            <div className="mt-4 rounded-lg bg-brand-50 p-2 ring-1 ring-brand-100">
              <div className="h-2 w-2/3 rounded-full bg-brand-300" />
              <div className="mt-2 h-2 w-full rounded-full bg-white" />
              <div className="mt-2 h-2 w-4/5 rounded-full bg-white" />
            </div>
          </Card>
          {index < workflowSteps.length - 1 ? (
            <div className="hidden xl:absolute xl:right-[-13px] xl:top-1/2 xl:z-10 xl:block xl:-translate-y-1/2 xl:text-brand-400">
              <ArrowRight size={22} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ProductTourModal({ onClose }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = productTourSteps[activeIndex];
  const ActiveIcon = active.icon;
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === productTourSteps.length - 1;

  const goPrevious = () => setActiveIndex((index) => Math.max(0, index - 1));
  const goNext = () => setActiveIndex((index) => Math.min(productTourSteps.length - 1, index + 1));

  return (
    <div className="fixed inset-0 z-[90] bg-ink/55 p-3 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-labelledby="product-tour-title">
      <div className="mx-auto flex min-h-full max-w-4xl items-center justify-center 2xl:max-w-5xl">
        <div className="flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)]">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-brand-100 p-3 sm:p-4 2xl:p-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-600">Product tour</p>
              <h2 id="product-tour-title" className="mt-1 text-xl font-black text-ink sm:text-2xl">Explore OccuBoard&apos;s application copilot</h2>
            </div>
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-600 ring-1 ring-slate-100 transition hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
              onClick={onClose}
              aria-label="Close product tour"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[0.32fr_0.68fr] 2xl:grid-cols-[0.35fr_0.65fr]">
            <div className="border-b border-brand-100 bg-brand-50/70 p-3 lg:border-b-0 lg:border-r sm:p-4 2xl:p-5">
              <div className="grid gap-2">
                {productTourSteps.map(({ label, icon: Icon }, index) => {
                  const selected = index === activeIndex;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`flex items-center gap-2.5 rounded-lg p-2.5 text-left ring-1 transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 2xl:gap-3 2xl:p-3 ${
                        selected ? "bg-brand-700 text-white ring-brand-700 shadow-card" : "bg-white text-ink ring-brand-100 hover:shadow-card"
                      }`}
                      aria-pressed={selected}
                      onClick={() => setActiveIndex(index)}
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg 2xl:h-9 2xl:w-9 ${selected ? "bg-white/15 text-white" : "bg-brand-50 text-brand-700 ring-1 ring-brand-100"}`}>
                        <Icon size={17} />
                      </span>
                      <span className="text-xs font-black 2xl:text-sm">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-3 sm:p-4 2xl:p-6">
              <div className="rounded-xl border border-brand-100 bg-gradient-to-b from-white to-brand-50/70 p-3 shadow-card sm:p-4 2xl:p-5">
                <div className="flex items-start justify-between gap-4 border-b border-brand-100 pb-3 2xl:pb-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-600">{active.label}</p>
                    <h3 className="mt-1 text-xl font-black text-ink 2xl:text-2xl">{active.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 lg:leading-5 2xl:leading-6">{active.description}</p>
                  </div>
                  <ActiveIcon className="shrink-0 text-brand-500" size={24} />
                </div>
                <div className="mt-3 2xl:mt-4">
                  <PreviewPanelRows rows={active.rows} />
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between 2xl:mt-5">
                <p className="text-sm font-bold text-slate-500">{activeIndex + 1} of {productTourSteps.length}</p>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" disabled={isFirst} onClick={goPrevious}>
                    <ChevronLeft size={17} /> Previous
                  </Button>
                  {isLast ? (
                    <Button type="button" onClick={onClose}>Done</Button>
                  ) : (
                    <Button type="button" onClick={goNext}>Next <ChevronRight size={17} /></Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewPanelRows({ rows }) {
  return (
    <div className="grid gap-2 2xl:gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1.5 rounded-lg bg-white p-2.5 ring-1 ring-brand-100 sm:flex-row sm:items-start sm:justify-between sm:gap-3 2xl:gap-4 2xl:p-3">
          <span className="min-w-[7.25rem] shrink-0 whitespace-nowrap text-left text-[11px] font-black uppercase tracking-[0.08em] text-brand-600 2xl:min-w-[8.5rem] 2xl:text-xs 2xl:tracking-[0.1em]">{label}</span>
          <span className="min-w-0 text-left text-sm font-bold leading-5 text-ink sm:text-right">{value}</span>
        </div>
      ))}
    </div>
  );
}

function ProductFrame({ id, label, title, icon, children }) {
  return (
    <div id={id} className="min-w-0 rounded-lg border border-brand-100 bg-white p-3 shadow-soft sm:p-4 2xl:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-brand-100 pb-3 2xl:pb-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-600">{label}</p>
          <p className="mt-1 break-words font-bold text-ink">{title}</p>
        </div>
        <span className="shrink-0 text-brand-500">{icon}</span>
      </div>
      <div className="mt-3 2xl:mt-4">{children}</div>
    </div>
  );
}

function PreviewMetric({ label, value, tone }) {
  const colors = tone === "emerald"
    ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
    : "bg-brand-50 text-brand-800 ring-brand-100";
  return (
    <div className={`rounded-lg p-2.5 ring-1 2xl:p-3 ${colors}`}>
      <p className="text-2xl font-black 2xl:text-3xl">{value}</p>
      <p className="mt-1 text-xs font-bold">{label}</p>
    </div>
  );
}

function PreviewDetail({ label, value, tone = "slate" }) {
  const colors = tone === "green"
    ? "bg-emerald-50 ring-emerald-100 text-emerald-900"
    : "bg-slate-50 ring-slate-100 text-slate-800";
  return (
    <div className={`rounded-lg p-2.5 ring-1 2xl:p-3 ${colors}`}>
      <p className={`text-[11px] font-black uppercase tracking-[0.1em] ${tone === "green" ? "text-emerald-700" : "text-slate-500"}`}>{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function InsightRow({ label, value, tone }) {
  const colors = {
    amber: "bg-amber-50 text-amber-900 ring-amber-100",
    blue: "bg-brand-50 text-brand-900 ring-brand-100",
    green: "bg-emerald-50 text-emerald-900 ring-emerald-100",
  };
  return (
    <div className={`rounded-lg p-2.5 ring-1 2xl:p-3 ${colors[tone] || colors.blue}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.1em] opacity-75">{label}</p>
      <p className="mt-1 text-sm font-bold leading-5">{value}</p>
    </div>
  );
}

function RecoveryBar({ percent, label }) {
  return (
    <div className="mt-3" aria-label={`${label}: ${percent}%`}>
      <div className="flex items-center justify-between text-xs font-bold text-slate-600">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function RecoveryRow({ concern, status, percent, tone }) {
  const badge = tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
  const bar = tone === "green" ? "bg-emerald-500" : "bg-amber-400";
  return (
    <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-ink">{concern}</p>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${badge}`}>{status}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function CoverageDot({ status }) {
  const styles = {
    Covered: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    Partial: "bg-amber-50 text-amber-700 ring-amber-100",
    Missing: "bg-slate-50 text-slate-500 ring-slate-100",
  };
  const label = status === "Covered" ? "✓" : status === "Partial" ? "Partial" : "—";
  return <span className={`mr-1 rounded-full px-2 py-1 text-center text-[11px] font-bold ring-1 ${styles[status]}`}>{label}</span>;
}

function MaterialLine({ text }) {
  return (
    <div className="flex gap-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
      <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={16} />
      <p className="text-sm leading-6 text-slate-700">{text}</p>
    </div>
  );
}

function WorkspacePreview() {
  return (
    <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-brand-900"><PanelsTopLeft size={20} /> Application Workspace</div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">3 active</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Ready to Apply", "2", "Resume and strategy ready"],
          ["Interviewing", "1", "Prep kit prepared"],
          ["Follow-Up", "2", "Next actions scheduled"],
        ].map(([stage, value, note]) => (
          <div key={stage} className="rounded-lg bg-brand-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-600">{stage}</div>
            <div className="mt-3 rounded-lg bg-white p-3 shadow-card">
              <div className="text-2xl font-bold text-ink">{value}</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
