export const metrics = [
  { label: "Applications This Week", value: "7" },
  { label: "Interviews", value: "2" },
  { label: "Follow-Ups Due", value: "4" },
  { label: "Saved Jobs", value: "18" },
  { label: "Resume Versions", value: "5" },
];

export const recentActivity = [
  { type: "Application", text: "Applied to Product Designer at Northstar Labs", time: "Today" },
  { type: "Resume", text: "Updated resume version for Growth Analyst role", time: "Yesterday" },
  { type: "Follow-up", text: "Scheduled follow-up with BrightPath recruiter", time: "May 16" },
];

export const followUps = [
  { company: "BrightPath", role: "Customer Success Manager", date: "May 20" },
  { company: "NovaGrid", role: "Operations Lead", date: "May 22" },
  { company: "AtlasWorks", role: "Program Manager", date: "May 24" },
];

export const initialJobs = [
  {
    id: "job-1",
    company: "Northstar Labs",
    role: "Product Designer",
    location: "Remote",
    salary: "$110k-$135k",
    status: "Applied",
    description: "Design polished product workflows for a growing SaaS platform.",
    sourceUrl: "https://example.com/northstar",
    notes: "Portfolio examples are highly relevant.",
  },
  {
    id: "job-2",
    company: "BrightPath",
    role: "Customer Success Manager",
    location: "Chicago, IL",
    salary: "$85k-$105k",
    status: "Interview",
    description: "Own customer onboarding, retention, and executive communication.",
    sourceUrl: "https://example.com/brightpath",
    notes: "Follow up after second interview.",
  },
  {
    id: "job-3",
    company: "NovaGrid",
    role: "Operations Lead",
    location: "Hybrid",
    salary: "$95k-$120k",
    status: "Saved",
    description: "Improve internal operations across support, data, and product teams.",
    sourceUrl: "https://example.com/novagrid",
    notes: "Needs tailored operations story.",
  },
];

export const initialApplications = [
  {
    id: "app-1",
    company: "NovaGrid",
    role: "Operations Lead",
    location: "Hybrid",
    stage: "Saved",
    appliedDate: "",
    followUpDate: "May 22",
  },
  {
    id: "app-2",
    company: "AtlasWorks",
    role: "Program Manager",
    location: "Remote",
    stage: "Saved",
    appliedDate: "",
    followUpDate: "May 24",
  },
  {
    id: "app-3",
    company: "Northstar Labs",
    role: "Product Designer",
    location: "Remote",
    stage: "Applied",
    appliedDate: "May 17",
    followUpDate: "May 23",
  },
  {
    id: "app-4",
    company: "BrightPath",
    role: "Customer Success Manager",
    location: "Chicago, IL",
    stage: "Interview",
    appliedDate: "May 10",
    followUpDate: "May 20",
  },
  {
    id: "app-5",
    company: "SignalHouse",
    role: "Marketing Strategist",
    location: "Remote",
    stage: "Closed",
    appliedDate: "May 5",
    followUpDate: "",
  },
];

export const stages = ["Saved", "Applied", "Interview", "Closed"];
