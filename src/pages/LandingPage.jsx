import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gauge,
  Lightbulb,
  Mail,
  MessageCircleQuestion,
  PanelsTopLeft,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../components/layout/Logo.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { PublicFooter } from "./LegalPage.jsx";

const intelligenceFeatures = [
  ["Realistic Fit Analysis", Target, "Compare the role with your actual experience, not just keyword overlap."],
  ["Hiring Considerations", AlertCircle, "See what may give a recruiter pause and how significant each concern really is."],
  ["Recruiter View", Users, "Understand what hiring teams are likely to notice, question, or value."],
  ["Recruiter Confidence", Gauge, "See whether your application is positioned strongly enough to move forward."],
];

const strategyFeatures = [
  ["Recovery Strategy", ShieldCheck, "Address hiring concerns with supported evidence and transferable experience."],
  ["Transferable Experience", Lightbulb, "Connect adjacent skills and systems to the responsibilities that matter."],
  ["Truthful Gap Recovery", CheckCircle2, "Address meaningful gaps without overstating experience or sounding defensive."],
  ["Recommended Next Actions", ClipboardList, "Know whether to strengthen, generate, prepare, follow up, or apply."],
];

const materialFeatures = [
  ["Tailored Resume", FileText, "Strengthen role-specific positioning while preserving your experience and voice."],
  ["Recruiter Outreach", Mail, "Generate concise, role-aware messages that sound human and credible."],
  ["Cover Letter", Briefcase, "Create optional cover letters with professional, startup, or conversational tone."],
  ["Interview Preparation", MessageCircleQuestion, "Prepare likely questions, STAR stories, talking points, research, and responses to concern areas."],
];

const workflowSteps = [
  ["Add a Job", "Paste the complete job description."],
  ["Evaluate Realistic Fit", "Review strengths, hiring considerations, and evidence."],
  ["Review Recruiter Perspective", "See likely first impressions and hesitation points."],
  ["Strengthen Positioning", "Build a truthful strategy around transferable experience."],
  ["Generate Materials", "Create a tailored resume and optional supporting outreach."],
  ["Prepare and Track", "Build interview materials and manage the opportunity in one workspace."],
];

export function LandingPage() {
  return (
    <div className="w-full overflow-x-hidden bg-white text-ink">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <Logo className="h-9 sm:h-16" />
        <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link className="hidden text-xs font-semibold text-slate-600 hover:text-brand-800 min-[420px]:inline sm:text-sm" to="/login">Login</Link>
          <Link to="/signup">
            <Button className="min-h-9 px-2.5 text-xs sm:px-3 sm:text-sm">Get Started</Button>
          </Link>
        </nav>
      </header>

      <main>
        <section id="hero" className="border-y border-brand-100 bg-gradient-to-b from-brand-50 to-white">
          <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-10 overflow-hidden px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-center lg:py-20">
            <div className="min-w-0">
              <p className="mb-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-card">
                AI-powered job application copilot
              </p>
              <h1 className="max-w-3xl text-4xl font-bold tracking-normal text-ink sm:text-6xl">
                Understand the role. Strengthen your application. Apply with confidence.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                OccuBoard analyzes each job against your real experience, identifies hiring considerations, and helps you build a truthful strategy for your resume, recruiter outreach, and interview preparation.
              </p>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-brand-800">
                No invented experience. No generic keyword stuffing. Just clearer positioning grounded in what you have actually done.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/signup"><Button>Analyze Your First Job <ArrowRight size={18} /></Button></Link>
                <a href="#how-it-works"><Button variant="secondary">See How It Works</Button></a>
              </div>
            </div>
            <IntelligencePreview />
          </div>
        </section>

        <FeatureSection
          id="know-before-you-apply"
          eyebrow="Know Before You Apply"
          title="Know how your application may be evaluated."
          description="Go beyond keyword matching. See where your experience aligns, what may concern a recruiter, and whether the opportunity is worth pursuing."
          features={intelligenceFeatures}
        />

        <FeatureSection
          id="strategy"
          eyebrow="Turn Insight Into Strategy"
          title="Turn every consideration into a positioning strategy."
          description="OccuBoard uses the analysis to strengthen your application without overstating your experience."
          features={strategyFeatures}
          tone="soft"
        />

        <FeatureSection
          id="materials"
          eyebrow="Build Better Application Materials"
          title="Carry the strategy through every application material."
          description="Your analysis informs each generated asset, keeping the application focused, consistent, and grounded in your real background."
          features={materialFeatures}
        />

        <section id="application-workspace" className="scroll-mt-6 border-y border-brand-100 bg-brand-50/70">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.7fr_1fr] lg:items-center">
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

        <section id="how-it-works" className="scroll-mt-6 mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">How It Works</p>
            <h2 className="mt-2 text-3xl font-bold">From job description to application strategy.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workflowSteps.map(([title, description], index) => (
              <Card key={title} className="relative overflow-hidden">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-700 text-base font-bold text-white">{index + 1}</div>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-brand-100 bg-ink px-4 py-12 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Know what to strengthen before you apply.</h2>
            <p className="mt-2 text-brand-100">Turn your next job description into a realistic fit assessment and focused application strategy.</p>
          </div>
          <Link to="/signup"><Button variant="secondary">Analyze Your First Job</Button></Link>
        </div>
      </footer>
      <PublicFooter />
    </div>
  );
}

function FeatureSection({ id, eyebrow, title, description, features, tone = "white" }) {
  return (
    <section id={id} className={`scroll-mt-6 ${tone === "soft" ? "bg-brand-50/60" : "bg-white"}`}>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-8 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>
          <h2 className="mt-2 text-3xl font-bold">{title}</h2>
          <p className="mt-3 leading-7 text-slate-600">{description}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(([label, Icon, featureDescription]) => (
            <Card key={label}>
              <Icon className="mb-4 text-brand-700" size={24} />
              <h3 className="text-lg font-bold">{label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{featureDescription}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function IntelligencePreview() {
  return (
    <div id="intelligence-preview" className="min-w-0 rounded-lg border border-brand-100 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-brand-100 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-600">Application Intelligence</p>
          <p className="mt-1 break-words font-bold text-ink">Systems Implementation Specialist</p>
        </div>
        <Sparkles className="text-brand-500" size={21} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <PreviewMetric label="Competitive Match" value="82%" tone="emerald" />
        <PreviewMetric label="Recruiter Confidence" value="85%" tone="brand" />
      </div>
      <div className="mt-3 grid gap-3">
        <PreviewDetail label="Top Strength" value="SaaS implementation ownership" />
        <PreviewDetail label="Hiring Consideration" value="Direct industry experience" />
        <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-100">
          <p className="text-[11px] font-black uppercase tracking-[0.1em] text-emerald-700">Recommended Action</p>
          <p className="mt-1 text-sm font-bold text-emerald-900">Apply after quick review</p>
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value, tone }) {
  const colors = tone === "emerald"
    ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
    : "bg-brand-50 text-brand-800 ring-brand-100";
  return (
    <div className={`rounded-lg p-3 ring-1 ${colors}`}>
      <p className="text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold">{label}</p>
    </div>
  );
}

function PreviewDetail({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
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
