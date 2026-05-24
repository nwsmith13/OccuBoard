import { ArrowRight, Bell, Briefcase, FileText, LayoutDashboard, Mail, PanelsTopLeft, Route, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../components/layout/Logo.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";

const features = [
  ["Job Tracking", Briefcase, "Save roles, companies, links, deadlines, and notes in one organized workspace."],
  ["Resume Tailoring", FileText, "Keep a base resume ready so each opportunity can become a focused application."],
  ["Application Pipeline", Route, "Move each role through Saved, Applied, Interview, or Closed."],
  ["Recruiter Messages", Mail, "Draft and save outreach, follow-ups, and short notes for each opportunity."],
  ["Career Dashboard", LayoutDashboard, "See what needs attention today without digging through spreadsheets."],
  ["Follow-Up Reminders", Bell, "Track follow-up dates so promising opportunities do not disappear."],
];

export function LandingPage() {
  return (
    <div className="bg-white text-ink">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-3">
          <Link className="text-sm font-semibold text-slate-600 hover:text-brand-800" to="/login">Login</Link>
          <Link to="/signup">
            <Button className="min-h-9 px-3">Get Started</Button>
          </Link>
        </nav>
      </header>

      <main>
        <section className="border-y border-brand-100 bg-gradient-to-b from-brand-50 to-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:py-20">
            <div>
              <p className="mb-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-card">
                Your job search, organized
              </p>
              <h1 className="max-w-3xl text-5xl font-bold tracking-normal text-ink sm:text-6xl">
                Your career command center.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Organize your job search, tailor resumes, track applications, and apply smarter - all in one workspace.
              </p>
              <p className="mt-4 max-w-2xl text-sm font-semibold text-brand-800">
                Built for job seekers who are tired of messy spreadsheets and scattered applications.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/signup"><Button>Get Started <ArrowRight size={18} /></Button></Link>
                <Link to="/app"><Button variant="secondary">See How It Works</Button></Link>
              </div>
            </div>
            <DashboardMock />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-3xl font-bold">Everything has a place.</h2>
            <p className="mt-3 text-slate-600">A calm system for the moving pieces of a modern job search.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([label, Icon, description]) => (
              <Card key={label}>
                <Icon className="mb-4 text-brand-700" size={24} />
                <h3 className="text-lg font-bold">{label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-brand-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-bold">A simple workflow that holds together.</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {["Save Jobs", "Tailor Applications", "Track Progress"].map((step, index) => (
                <Card key={step} className="relative overflow-hidden">
                  <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-700 text-lg font-bold text-white">{index + 1}</div>
                  <h3 className="text-xl font-bold">{step}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Move from interest to action with a clear next step.</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-bold">Dashboard preview</h2>
              <p className="mt-3 text-slate-600">A focused view of applications, follow-ups, and recent movement.</p>
            </div>
            <DashboardMock />
          </div>
        </section>
      </main>

      <footer className="border-t border-brand-100 bg-ink px-4 py-12 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Take control of your job search.</h2>
            <p className="mt-2 text-brand-100">A calmer workspace for focused job search momentum.</p>
          </div>
          <Link to="/signup"><Button variant="secondary">Get Started</Button></Link>
        </div>
      </footer>
    </div>
  );
}

function DashboardMock() {
  return (
    <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-brand-900"><PanelsTopLeft size={20} /> Pipeline</div>
        <Sparkles className="text-brand-400" size={20} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {["Saved", "Applied", "Interview"].map((stage, index) => (
          <div key={stage} className="rounded-lg bg-brand-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-500">{stage}</div>
            <div className="mt-4 rounded-lg bg-white p-3 shadow-card">
              <div className="h-2 w-24 rounded bg-brand-200" />
              <div className="mt-3 h-2 w-16 rounded bg-slate-200" />
              <div className="mt-5 text-2xl font-bold text-ink">{[8, 5, 2][index]}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
