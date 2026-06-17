import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
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

const materialFeatures = [
  ["Tailored Resume", FileText, "Strengthen role-specific positioning while preserving your experience and voice."],
  ["Recruiter Outreach", Mail, "Generate concise, role-aware messages that sound human and credible."],
  ["Cover Letter", Briefcase, "Create optional cover letters with professional, startup, or conversational tone."],
  ["Interview Preparation", MessageCircleQuestion, "Prepare likely questions, STAR stories, talking points, research, and responses to concern areas."],
];

const workflowSteps = [
  ["Add Job", ClipboardList, "Paste the complete job description so OccuBoard can evaluate the role."],
  ["Evaluate Realistic Fit", Target, "Review match strength, evidence, and hiring considerations."],
  ["Review Recruiter View", Users, "See likely first impressions, concerns, and recruiter confidence."],
  ["Recover Considerations", ShieldCheck, "Turn true gaps into supported positioning opportunities."],
  ["Generate Materials", FileCheck2, "Create a tailored resume and optional outreach grounded in the analysis."],
  ["Apply & Prepare", CalendarCheck, "Submit your application, mark it applied, then prepare for interviews with role-specific questions and talking points."],
];

const demoSteps = [
  ["Paste job description", ClipboardList, "Start with the full job post so the analysis has real context."],
  ["Fit analysis appears", Target, "OccuBoard shows match strength, evidence, and hiring considerations."],
  ["Recruiter View highlights likely concerns", Users, "See what hiring teams may notice, value, or question."],
  ["Recovery strategy strengthens positioning", ShieldCheck, "Turn meaningful concerns into supported, truthful positioning."],
  ["Resume and recruiter message generated", FileText, "Create materials that carry the analysis through the application."],
  ["User marks application as Applied", CheckCircle2, "Track submission once the package is ready."],
  ["Interview Prep becomes the next recommended step", MessageCircleQuestion, "Prepare role-specific questions, talking points, and STAR stories."],
];

export function LandingPage() {
  return (
    <div className="w-full overflow-x-hidden bg-white text-ink">
      <header className="sticky top-3 z-50 mx-3 mt-3 flex max-w-7xl items-center justify-between gap-3 rounded-2xl border border-brand-100/80 bg-white/85 px-4 py-3 shadow-card backdrop-blur-xl sm:mx-6 sm:px-6 lg:mx-auto">
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

        <section id="know-before-you-apply" className="scroll-mt-28 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <div className="mb-8 max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">Know Before You Apply</p>
              <h2 className="mt-2 text-3xl font-bold">Know how your application may be evaluated.</h2>
              <p className="mt-3 leading-7 text-slate-600">
                Go beyond keyword matching. See where your experience aligns, what may concern a recruiter, and whether the opportunity is worth pursuing.
              </p>
            </div>
            <ShowcaseGrid
              visual={<RecruiterViewPreview />}
              title="See what recruiters may see before you apply."
              description="OccuBoard analyzes strengths, hiring considerations, recruiter confidence, and likely first impressions so you can understand how your application may be evaluated."
              highlights={[
                ["Strongest Hiring Signal", "SaaS implementation ownership"],
                ["Primary Concern", "Direct industry experience"],
                ["Recruiter Confidence", "85%"],
                ["Recommended Action", "Apply after quick review"],
              ]}
            />
          </div>
        </section>

        <section id="strategy" className="scroll-mt-28 bg-brand-50/60">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <ShowcaseGrid
              reverse
              visual={<RecoveryPreview />}
              eyebrow="Turn Insight Into Strategy"
              title="Turn hiring concerns into positioning opportunities."
              description="OccuBoard identifies concerns and shows how transferable experience, supporting evidence, and stronger positioning can improve application strength without inventing experience."
              highlights={[
                ["Recovery Strength", "Strong recovery"],
                ["Considerations Addressed", "3 of 4"],
                ["Recovery Status", "Direct industry experience partially recovered"],
                ["Recovery Explanation", "Position adjacent SaaS systems experience without overstating domain expertise."],
              ]}
            />
          </div>
        </section>

        <section id="coverage" className="scroll-mt-28 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
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
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
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

        <section id="how-it-works" className="scroll-mt-28 mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">How It Works</p>
            <h2 className="mt-2 text-3xl font-bold">From job description to application strategy.</h2>
          </div>
          <WorkflowPreview />
        </section>

        <section id="product-demo" className="scroll-mt-28 border-y border-brand-100 bg-brand-50/60">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <div className="mb-8 max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">60-second workflow preview</p>
              <h2 className="mt-2 text-3xl font-bold">See OccuBoard in action.</h2>
              <p className="mt-3 leading-7 text-slate-600">
                From job description to application strategy, OccuBoard shows the fit, the concerns, the recovery plan, and the next step.
              </p>
            </div>
            <WorkflowDemo />
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
  return (
    <ProductFrame id="intelligence-preview" label="Application Intelligence" title="Systems Implementation Specialist" icon={<Sparkles size={21} />}>
      <div className="grid grid-cols-2 gap-3">
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
    </ProductFrame>
  );
}

function RecruiterViewPreview() {
  return (
    <ProductFrame label="Recruiter View" title="Hiring-team perspective" icon={<Users size={21} />}>
      <div className="rounded-lg bg-emerald-50 p-4 ring-1 ring-emerald-100">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-emerald-700">Recommended Action</p>
        <p className="mt-1 text-lg font-black text-emerald-900">Apply after quick review</p>
        <p className="mt-2 text-xs leading-5 text-emerald-800">Competitive application with one positioning note to review before submitting.</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <PreviewMetric label="Competitive Match" value="82%" tone="emerald" />
        <PreviewMetric label="Recruiter Confidence" value="85%" tone="brand" />
      </div>
      <div className="mt-3 grid gap-3">
        <InsightRow label="Strongest Hiring Signal" value="SaaS implementation ownership" tone="green" />
        <InsightRow label="Primary Concern" value="Direct industry experience" tone="amber" />
        <InsightRow label="What recruiters may notice first" value="Operational systems background and customer-facing implementation work." tone="blue" />
      </div>
    </ProductFrame>
  );
}

function RecoveryPreview() {
  return (
    <ProductFrame label="Recovery" title="Hiring consideration recovery" icon={<ShieldCheck size={21} />}>
      <div className="rounded-lg bg-white p-3 ring-1 ring-brand-100">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.1em] text-brand-600">Highest Impact Recovery</p>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Fully addressed</span>
        </div>
        <p className="font-bold text-ink">Strengthened implementation and workflow positioning</p>
        <RecoveryBar percent={100} label="Recovery Strength" />
      </div>
      <div className="mt-3 grid gap-3">
        <RecoveryRow concern="Direct industry experience" status="Partial recovery" percent={45} tone="amber" />
        <RecoveryRow concern="Rollout validation language" status="Strong recovery" percent={78} tone="green" />
        <RecoveryRow concern="Systems adaptability" status="Fully addressed" percent={100} tone="green" />
      </div>
      <div className="mt-3 rounded-lg bg-brand-50 p-3 ring-1 ring-brand-100">
        <p className="text-[11px] font-black uppercase tracking-[0.1em] text-brand-700">Recovery Explanation</p>
        <p className="mt-1 text-sm leading-6 text-brand-900">Position adjacent SaaS, ERP, and workflow systems experience without claiming direct industry ownership.</p>
      </div>
    </ProductFrame>
  );
}

function CoveragePreview() {
  const rows = [
    ["SaaS implementation", "Covered", "Covered", "Covered", "Covered"],
    ["Industry experience", "Covered", "Partial", "Partial", "Covered"],
    ["Rollout validation", "Covered", "Covered", "Missing", "Covered"],
    ["Hands-on framing", "Covered", "Covered", "Covered", "Covered"],
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
        {["Resume", "Recruiter Message", "Cover Letter", "Interview Prep"].map((tab, index) => (
          <span key={tab} className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${index === 0 ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-brand-800 ring-brand-100"}`}>
            {tab}
          </span>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-brand-100 bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-black text-ink">Systems Implementation Specialist</p>
            <p className="text-sm text-slate-500">Tailored resume preview</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Optimized +6</span>
        </div>
        <div className="mt-4 grid gap-3">
          <MaterialLine text="Coordinated SaaS onboarding, workflow alignment, and implementation follow-through across customer-facing teams." />
          <MaterialLine text="Strengthened intake, issue tracking, documentation, and rollout-readiness language using supported project experience." />
          <MaterialLine text="Positioned adjacent ERP, CRM, Jira, and Asana experience as evidence of quick platform adoption." />
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-brand-50 p-3 ring-1 ring-brand-100">
        <p className="text-[11px] font-black uppercase tracking-[0.1em] text-brand-700">Strengthened from analysis</p>
        <p className="mt-1 text-sm font-bold text-brand-900">Added rollout validation framing and operational support alignment.</p>
      </div>
    </ProductFrame>
  );
}

function WorkflowPreview() {
  return (
    <div className="grid gap-3 lg:grid-cols-6">
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
            <div className="hidden lg:absolute lg:right-[-13px] lg:top-1/2 lg:z-10 lg:block lg:-translate-y-1/2 lg:text-brand-400">
              <ArrowRight size={22} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function WorkflowDemo() {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
      <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-600">Demo storyboard</p>
            <p className="mt-1 font-bold text-ink">Generate materials, apply, then prepare</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Applied</span>
        </div>
        <div className="grid gap-3">
          {demoSteps.map(([title, Icon, description], index) => (
            <div key={title} className="group flex gap-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100 transition duration-150 hover:bg-white hover:shadow-card">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${index === 5 ? "bg-emerald-600 text-white" : index === 6 ? "bg-brand-700 text-white" : "bg-white text-brand-700 ring-1 ring-brand-100"}`}>
                <Icon size={17} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-ink">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-brand-100 pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-600">Next Recommended Step</p>
            <p className="mt-1 font-bold text-ink">Interview Prep</p>
          </div>
          <MessageCircleQuestion className="text-brand-500" size={21} />
        </div>
        <div className="mt-4 grid gap-3">
          <div className="rounded-lg bg-emerald-50 p-4 ring-1 ring-emerald-100">
            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-emerald-700">Application marked applied</p>
            <p className="mt-1 text-lg font-black text-emerald-900">Submission tracked</p>
            <p className="mt-2 text-sm leading-6 text-emerald-800">OccuBoard keeps the opportunity active and shifts guidance toward interview readiness.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InsightRow label="Likely Questions" value="Implementation ownership, rollout validation, platform adoption" tone="blue" />
            <InsightRow label="Talking Points" value="SaaS systems, customer-facing operations, workflow follow-through" tone="green" />
          </div>
          <div className="rounded-lg bg-brand-50 p-3 ring-1 ring-brand-100">
            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-brand-700">Prepared after applying</p>
            <p className="mt-1 text-sm font-bold text-brand-900">Role-specific questions and talking points become the next focus after submission.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductFrame({ id, label, title, icon, children }) {
  return (
    <div id={id} className="min-w-0 rounded-lg border border-brand-100 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-brand-100 pb-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-600">{label}</p>
          <p className="mt-1 break-words font-bold text-ink">{title}</p>
        </div>
        <span className="shrink-0 text-brand-500">{icon}</span>
      </div>
      <div className="mt-4">{children}</div>
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

function InsightRow({ label, value, tone }) {
  const colors = {
    amber: "bg-amber-50 text-amber-900 ring-amber-100",
    blue: "bg-brand-50 text-brand-900 ring-brand-100",
    green: "bg-emerald-50 text-emerald-900 ring-emerald-100",
  };
  return (
    <div className={`rounded-lg p-3 ring-1 ${colors[tone] || colors.blue}`}>
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
