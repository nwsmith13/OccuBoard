import { todayIso } from "../lib/date.js";

export const stages = ["Saved", "Applied", "Interview", "Closed"];
export const priorities = ["Low", "Medium", "High"];
export const remoteTypes = ["Remote", "Hybrid", "Onsite"];

export const seedProfile = {
  id: "local-demo-user",
  full_name: "Demo Job Seeker",
  email: "demo@occuboard.local",
  location: "Chicago, IL",
  phone: "",
  target_roles: "Product Designer, Operations Lead, Customer Success Manager",
  base_resume_text:
    "Experienced operator with a track record of improving team workflows, customer outcomes, and cross-functional execution.",
  linkedin_url: "https://linkedin.com/in/demo",
  portfolio_url: "",
  created_at: new Date().toISOString(),
};

export const seedJobs = [
  {
    id: "job-1",
    user_id: "local-demo-user",
    company_name: "Northstar Labs",
    job_title: "Product Designer",
    location: "Remote",
    remote_type: "Remote",
    salary_range: "$110k-$135k",
    source_url: "https://example.com/northstar",
    job_description: "Design polished product workflows for a growing SaaS platform.",
    priority: "High",
    status: "Applied",
    date_saved: todayIso(),
    applied_date: todayIso(),
    followup_date: todayIso(),
    followup_status: "scheduled",
    followup_completed_at: null,
    followup_snoozed_until: null,
    followup_note: "Check for a response and send a short follow-up.",
    notes: "Portfolio examples are highly relevant.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "job-2",
    user_id: "local-demo-user",
    company_name: "BrightPath",
    job_title: "Customer Success Manager",
    location: "Chicago, IL",
    remote_type: "Hybrid",
    salary_range: "$85k-$105k",
    source_url: "https://example.com/brightpath",
    job_description: "Own customer onboarding, retention, and executive communication.",
    priority: "Medium",
    status: "Interview",
    date_saved: todayIso(),
    applied_date: todayIso(),
    followup_date: todayIso(),
    followup_status: "scheduled",
    followup_completed_at: null,
    followup_snoozed_until: null,
    followup_note: "Send a thank-you note after the interview.",
    notes: "Follow up after second interview.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "job-3",
    user_id: "local-demo-user",
    company_name: "NovaGrid",
    job_title: "Operations Lead",
    location: "Hybrid",
    remote_type: "Hybrid",
    salary_range: "$95k-$120k",
    source_url: "https://example.com/novagrid",
    job_description: "Improve internal operations across support, data, and product teams.",
    priority: "High",
    status: "Saved",
    date_saved: todayIso(),
    applied_date: null,
    followup_date: "",
    followup_status: "none",
    followup_completed_at: null,
    followup_snoozed_until: null,
    followup_note: "",
    notes: "Needs tailored operations story.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const seedActivityLogs = [
  {
    id: "activity-1",
    user_id: "local-demo-user",
    type: "Application",
    description: "Applied to Product Designer at Northstar Labs",
    created_at: new Date().toISOString(),
  },
  {
    id: "activity-2",
    user_id: "local-demo-user",
    type: "Job",
    description: "Saved Operations Lead at NovaGrid",
    created_at: new Date().toISOString(),
  },
];

export const seedJobActivityLogs = [];

export const seedResumeVersions = [
  {
    id: "resume-1",
    user_id: "local-demo-user",
    job_id: "job-1",
    title: "Product Designer - Northstar",
    content: "Draft tailored resume for Northstar Labs.",
    created_at: new Date().toISOString(),
  },
];

export const seedJobScores = [];

export const seedMessages = [];
