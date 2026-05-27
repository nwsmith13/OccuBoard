import { ArrowRightCircle, Bell, BriefcaseBusiness, CalendarDays, CheckCircle2, FileText, LayoutDashboard, Mail, MessageCircle, Search, Settings, Sparkles, Upload, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isArchivedJob } from "../../lib/archive.js";
import { getFollowUpLabel, getFollowUpStatus, normalizeStage } from "../../lib/followUp.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "../../lib/jobDisplay.js";
import { isCoverLetter, isRecruiterMessage } from "../../lib/jobAiStatus.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { getNextBestAction } from "../../utils/nextBestAction.js";

const navigationItems = [
  { title: "Dashboard", subtitle: "Navigate", path: "/app/dashboard", aliases: "home focus today overview", icon: LayoutDashboard },
  { title: "Resume Studio", subtitle: "Navigate", path: "/app/resume-studio", aliases: "resume cv profile import upload", icon: FileText },
  { title: "New Jobs", subtitle: "Navigate", path: "/app/new-jobs", aliases: "new job analyze add job paste job", icon: Search },
  { title: "Generated Resumes", subtitle: "Navigate", path: "/app/generated-resumes", aliases: "tailored resumes exports materials", icon: FileText },
  { title: "Applications", subtitle: "Navigate", path: "/app/applications", aliases: "pipeline board jobs opportunities tracker", icon: BriefcaseBusiness },
  { title: "Settings", subtitle: "Navigate", path: "/app/settings", aliases: "account profile configuration", icon: Settings },
];

const globalCommands = [
  { title: "Analyze a new job", subtitle: "New Jobs", path: "/app/new-jobs", aliases: "new job analyze add job paste job", icon: Search },
  { title: "Import resume", subtitle: "Resume Studio", path: "/app/resume-studio", aliases: "upload resume import cv base resume", icon: Upload },
  { title: "View applications", subtitle: "Applications", path: "/app/applications", aliases: "pipeline board opportunities", icon: BriefcaseBusiness },
  { title: "View generated resumes", subtitle: "Generated Resumes", path: "/app/generated-resumes", aliases: "tailored resume export pdf docx", icon: FileText },
];

const tabCommands = [
  ["overview", "Open job", "Overview", "open view job opportunity"],
  ["fit", "Open Analysis", "Fit analysis", "analysis analyze fit score"],
  ["resume", "Open Resume", "Tailored resume", "resume cv export"],
  ["coverLetter", "Open Cover Letter", "Application package", "cover letter"],
  ["message", "Open Recruiter Message", "Outreach", "message recruiter outreach"],
  ["interview", "Open Interview Prep", "Interview Prep", "interview prep questions star"],
  ["export", "Open Export", "Application Materials", "export materials pdf docx"],
  ["overview", "Set follow-up", "Follow-up", "follow up reminder date"],
  ["overview", "Generate follow-up message", "Follow-up", "follow up message"],
  ["overview", "Add follow-up to calendar", "Follow-up calendar", "calendar reminder ics google outlook follow up"],
  ["interview", "Add interview to calendar", "Interview calendar", "calendar interview ics google outlook"],
];

const groupOrder = ["Jobs", "Contacts", "Materials", "Commands", "Navigation"];

export function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { jobs, jobScores, resumeVersions, messages, jobContacts, interviewPrep, updateJob } = useWorkspaceStore();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsRef = useRef([]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const items = useMemo(() => buildCommandItems({ jobs, jobScores, resumeVersions, messages, jobContacts, interviewPrep, navigate, updateJob, user, close: onClose }), [interviewPrep, jobContacts, jobScores, jobs, messages, navigate, onClose, resumeVersions, updateJob, user]);
  const filtered = useMemo(() => filterItems(items, query).slice(0, 28), [items, query]);
  const grouped = useMemo(() => groupOrder.map((group) => [group, filtered.filter((item) => item.group === group)]).filter(([, list]) => list.length), [filtered]);
  const activeItem = filtered[activeIndex];

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    resultsRef.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  function selectItem(item = activeItem) {
    if (!item) return;
    item.run();
  }

  function handleInputKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectItem();
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-ink/35 px-3 py-12 backdrop-blur-sm sm:px-6" role="dialog" aria-modal="true" aria-labelledby="command-palette-title" onMouseDown={onClose}>
      <section className="mx-auto flex max-h-[min(760px,calc(100dvh-4rem))] max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-brand-100" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-brand-100 px-4 py-3">
          <Search size={18} className="text-brand-700" aria-hidden="true" />
          <label htmlFor="command-search" className="sr-only">Search or run a command</label>
          <input
            ref={inputRef}
            id="command-search"
            className="min-h-11 flex-1 bg-transparent text-base font-semibold text-ink outline-none placeholder:text-slate-400"
            placeholder="Search or command..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={activeItem ? `command-result-${activeItem.id}` : undefined}
          />
          <button type="button" className="rounded-lg p-2 text-slate-500 transition hover:bg-brand-50 hover:text-slate-800" onClick={onClose} aria-label="Close command palette">
            <X size={18} />
          </button>
        </div>
        <h2 id="command-palette-title" className="sr-only">OccuBoard command palette</h2>
        <div id="command-results" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
          {!filtered.length && (
            <div className="px-4 py-10 text-center">
              <p className="font-bold text-ink">No results found.</p>
              <p className="mt-1 text-sm text-slate-500">Try searching by company, role, or action.</p>
            </div>
          )}
          {grouped.map(([group, list]) => (
            <div key={group} className="py-2">
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{group}</p>
              <div className="grid gap-1">
                {list.map((item) => {
                  const index = filtered.indexOf(item);
                  const selected = index === activeIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      ref={(element) => { resultsRef.current[index] = element; }}
                      id={`command-result-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${selected ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-50"}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectItem(item)}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${selected ? "bg-brand-100 text-brand-800" : "bg-slate-50 text-slate-500"}`}>
                        <Icon size={17} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink">{item.title}</span>
                        <span className="block truncate text-xs font-medium text-slate-500">{item.subtitle}</span>
                      </span>
                      {item.badge && <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-brand-700 ring-1 ring-brand-100">{item.badge}</span>}
                      {item.shortcut && <span className="hidden shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500 sm:inline">{item.shortcut}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-brand-100 px-4 py-2 text-[11px] font-semibold text-slate-400">
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </section>
    </div>
  );
}

function buildCommandItems({ jobs, jobScores, resumeVersions, messages, jobContacts, interviewPrep, navigate, updateJob, user, close }) {
  const items = [];
  const go = (path, state) => {
    navigate(path, state ? { state } : undefined);
    close();
  };
  const openJob = (job, openJobTab = "overview", options = {}) => {
    const params = [
      ["jobId", job.id],
      ["tab", openJobTab],
      options.focus && ["focus", options.focus],
      options.contactId && ["contactId", options.contactId],
    ].filter(Boolean).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
    go(`/app/applications?${params}`, {
      openJobId: job.id,
      openJobTab,
      initialTab: openJobTab,
      focus: options.focus || "",
      contactId: options.contactId || "",
    });
  };

  navigationItems.forEach((item) => items.push({
    ...item,
    id: `nav-${item.path}`,
    group: "Navigation",
    searchable: `${item.title} ${item.subtitle} ${item.aliases}`,
    run: () => go(item.path),
  }));

  globalCommands.forEach((item) => items.push({
    ...item,
    id: `cmd-${item.title}`,
    group: "Commands",
    searchable: `${item.title} ${item.subtitle} ${item.aliases}`,
    run: () => go(item.path),
  }));

  jobs.filter((job) => !isArchivedJob(job)).forEach((job) => {
    const company = getDisplayCompanyName(job);
    const title = getDisplayJobTitle(job);
    const stage = normalizeStage(job.status);
    const score = latestScore(jobScores, job.id);
    const contacts = jobContacts.filter((contact) => contact.job_id === job.id);
    const jobMessages = messages.filter((message) => message.job_id === job.id);
    const hasResume = resumeVersions.some((version) => version.job_id === job.id);
    const hasMessage = jobMessages.some(isRecruiterMessage);
    const hasCoverLetter = jobMessages.some(isCoverLetter);
    const nextBestAction = getNextBestAction(job, { score, aiStatus: { resumeDrafted: hasResume, messageDrafted: hasMessage, coverLetterDrafted: hasCoverLetter }, messages });
    const searchText = [
      title,
      company,
      stage,
      score?.score,
      job.notes,
      job.job_description,
      contacts.map((contact) => `${contact.name} ${contact.email} ${contact.linkedin_url}`).join(" "),
    ].join(" ");

    items.push({
      id: `job-${job.id}`,
      group: "Jobs",
      title,
      subtitle: `${company} · ${stage}${score ? ` · ${Math.round(Number(score.score))}%` : ""}`,
      badge: nextBestAction?.actionType !== "no_action" ? nextBestAction.label : "",
      icon: BriefcaseBusiness,
      searchable: searchText,
      run: () => openJob(job),
    });

    tabCommands.forEach(([tab, label, context, aliases]) => {
      if (tab === "interview" && stage !== "Interview") return;
      items.push({
        id: `job-${job.id}-${label}`,
        group: "Commands",
        title: label,
        subtitle: `${title} · ${context}`,
        badge: getFollowUpLabel(job),
        icon: getCommandIcon(label),
        searchable: `${label} ${aliases} ${title} ${company} ${stage}`,
        run: () => openJob(job, tab, label.toLowerCase().includes("follow-up") ? { focus: "followup" } : {}),
      });
    });

    if (stage !== "Applied") {
      items.push(stageCommand(job, "Move to Applied", "Applied", updateJob, user, openJob));
    }
    if (stage !== "Interview") {
      items.push(stageCommand(job, "Move to Interview", "Interview", updateJob, user, openJob));
    }
    if (stage !== "Closed") {
      items.push(stageCommand(job, "Move to Closed", "Closed", updateJob, user, openJob));
    }
    if (["due", "overdue", "scheduled", "snoozed"].includes(getFollowUpStatus(job))) {
      items.push({
        id: `job-${job.id}-mark-followed-up`,
        group: "Commands",
        title: "Mark followed up",
        subtitle: `${title} · ${company}`,
        badge: getFollowUpLabel(job),
        icon: CheckCircle2,
        searchable: `mark followed up complete follow up ${title} ${company}`,
        run: async () => {
          await updateJob(user, job.id, { followup_status: "completed", followup_completed_at: new Date().toISOString(), followup_snoozed_until: null });
          openJob(job, "overview", { focus: "followup" });
        },
      });
    }
  });

  jobContacts.forEach((contact) => {
    const job = jobs.find((item) => item.id === contact.job_id);
    if (!job || isArchivedJob(job)) return;
    items.push({
      id: `contact-${contact.id}`,
      group: "Contacts",
      title: contact.name || contact.email || "Contact",
      subtitle: `Contact - ${contact.company || getDisplayCompanyName(job)} - ${getDisplayJobTitle(job)}${contact.email ? ` - ${contact.email}` : ""}`,
      badge: contact.source,
      icon: UserRound,
      searchable: `${contact.name} ${contact.company} ${contact.email} ${contact.linkedin_url} ${contact.source} ${getDisplayJobTitle(job)} ${getDisplayCompanyName(job)}`,
      run: () => openJob(job, "overview", { focus: "contacts", contactId: contact.id }),
    });
  });

  const includeLegacyContactResults = false;
  if (includeLegacyContactResults) jobContacts.forEach((contact) => items.push({
    id: `contact-${contact.id}`,
    group: "Contacts",
    title: contact.name || contact.email || "Contact",
    subtitle: `${contact.company || "Contact"}${contact.email ? ` · ${contact.email}` : ""}`,
    badge: contact.source,
    icon: UserRound,
    searchable: `${contact.name} ${contact.company} ${contact.email} ${contact.linkedin_url} ${contact.source}`,
    run: () => {
      const job = jobs.find((item) => item.id === contact.job_id);
      if (job) openJob(job, "overview");
      else go("/app/applications");
    },
  }));

  resumeVersions.forEach((resume) => {
    const job = jobs.find((item) => item.id === resume.job_id);
    if (job && isArchivedJob(job)) return;
    items.push({
      id: `material-resume-${resume.id}`,
      group: "Materials",
      title: resume.title || "Tailored resume",
      subtitle: job ? `${getDisplayCompanyName(job)} · Resume` : "Resume",
      badge: "Resume",
      icon: FileText,
      searchable: `${resume.title} ${resume.content} resume cv ${job ? `${getDisplayJobTitle(job)} ${getDisplayCompanyName(job)}` : ""}`,
      run: () => job ? openJob(job, "resume") : go("/app/generated-resumes"),
    });
  });

  messages.forEach((message) => {
    const job = jobs.find((item) => item.id === message.job_id);
    if (job && isArchivedJob(job)) return;
    const isCover = isCoverLetter(message);
    const isRecruiter = isRecruiterMessage(message);
    const tab = isCover ? "coverLetter" : isRecruiter ? "message" : "overview";
    items.push({
      id: `material-message-${message.id}`,
      group: "Materials",
      title: message.type || "Generated message",
      subtitle: job ? `${getDisplayCompanyName(job)} · ${getDisplayJobTitle(job)}` : "Generated material",
      badge: isCover ? "Cover letter" : isRecruiter ? "Recruiter" : "Follow-up",
      icon: isCover ? FileText : MessageCircle,
      searchable: `${message.type} ${message.content} ${job ? `${getDisplayJobTitle(job)} ${getDisplayCompanyName(job)}` : ""}`,
      run: () => job ? openJob(job, tab) : go("/app/messages"),
    });
  });

  interviewPrep.forEach((prep) => {
    const job = jobs.find((item) => item.id === prep.job_id);
    if (!job) return;
    items.push({
      id: `material-interview-${prep.id}`,
      group: "Materials",
      title: "Interview prep",
      subtitle: `${getDisplayCompanyName(job)} · ${getDisplayJobTitle(job)}`,
      badge: "Prep",
      icon: Sparkles,
      searchable: `interview prep questions star ${getDisplayJobTitle(job)} ${getDisplayCompanyName(job)} ${JSON.stringify(prep.content || {})}`,
      run: () => openJob(job, "interview"),
    });
  });

  return items;
}

function stageCommand(job, title, stage, updateJob, user, openJob) {
  return {
    id: `job-${job.id}-${stage}`,
    group: "Commands",
    title,
    subtitle: `${getDisplayJobTitle(job)} · ${getDisplayCompanyName(job)}`,
    badge: stage,
    icon: ArrowRightCircle,
    searchable: `${title} ${stage} ${getDisplayJobTitle(job)} ${getDisplayCompanyName(job)}`,
    run: async () => {
      await updateJob(user, job.id, { status: stage, applied_date: stage === "Applied" ? job.applied_date || new Date().toISOString().slice(0, 10) : job.applied_date || null });
      openJob({ ...job, status: stage }, "overview");
    },
  };
}

function latestScore(scores, jobId) {
  return [...scores].filter((score) => score.job_id === jobId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

function filterItems(items, query) {
  const normalized = normalize(query);
  if (!normalized) return items.slice(0, 18);
  return items
    .map((item) => ({ item, score: scoreItem(item, normalized) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

function scoreItem(item, query) {
  const title = normalize(item.title);
  const subtitle = normalize(item.subtitle);
  const haystack = normalize(`${item.searchable} ${item.title} ${item.subtitle} ${item.badge || ""}`);
  if (title === query) return 100;
  if (title.startsWith(query)) return 80;
  if (subtitle.includes(query)) return 55;
  if (haystack.includes(query)) return 40;
  const terms = query.split(/\s+/).filter(Boolean);
  if (terms.length && terms.every((term) => haystack.includes(term))) return 30 + terms.length;
  return 0;
}

function normalize(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getCommandIcon(label = "") {
  if (label.includes("calendar")) return CalendarDays;
  if (label.includes("follow")) return Bell;
  if (label.includes("Message")) return Mail;
  if (label.includes("Interview")) return Sparkles;
  if (label.includes("Resume") || label.includes("Cover") || label.includes("Export")) return FileText;
  return ArrowRightCircle;
}
