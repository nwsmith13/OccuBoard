import { Clipboard, RefreshCcw, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { canRunAi, generateAiOutput } from "../../lib/aiClient.js";
import { formatDate } from "../../lib/date.js";
import { getLatestForJob } from "../../lib/jobAiStatus.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { ResumeExportPanel } from "../resume/ResumeExportPanel.jsx";
import { Button } from "../ui/Button.jsx";

export function AiToolsPanel({ job, compact = false, contentOnly = false, activeTab = "fit", onTabChange, onExportComplete }) {
  const { user } = useAuth();
  const {
    profile,
    jobScores,
    resumeVersions,
    messages,
    saveJobScore,
    saveResumeVersion,
    saveMessage,
  } = useWorkspaceStore();
  const [aiState, setAiState] = useState({ loading: "", error: "", latest: null, confirm: "" });
  const [intensity, setIntensity] = useState("Balanced");
  const [manualIntensity, setManualIntensity] = useState(false);
  const loadingRef = useRef(null);
  const jobScoreHistory = jobScores.filter((score) => score.job_id === job.id);
  const resumeHistory = resumeVersions.filter((version) => version.job_id === job.id);
  const messageHistory = messages.filter((message) => message.job_id === job.id);
  const latestScore = getLatestForJob(jobScores, job.id);
  const latestResume = getLatestForJob(resumeVersions, job.id);
  const latestMessage = getLatestForJob(messages, job.id);
  const activeAction = ["fit", "resume", "message"].includes(activeTab) ? activeTab : "fit";

  async function runAi(action, { regenerate = false } = {}) {
    if (aiState.loading) return;
    if (regenerate && aiState.confirm !== action) {
      setAiState({ loading: "", latest: null, error: "", confirm: action });
      return;
    }
    const localError = getLocalError(action, profile, job);
    if (localError) {
      setAiState({ loading: "", latest: null, error: localError, confirm: "" });
      return;
    }
    setAiState({ loading: action, error: "", latest: null, confirm: "" });
    window.setTimeout(() => loadingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
    try {
      const effectiveIntensity = getEffectiveIntensity(action, intensity, manualIntensity, latestScore);
      const result = await generateAiOutput(action, profile, job, {
        tailoringIntensity: effectiveIntensity,
        manualIntensityOverride: manualIntensity,
        fitRecommendation: latestScore?.recommendation,
        fitSummary: latestScore?.summary,
      });
      if (action === "fit") await saveJobScore(user, job, { ...result, tailoringIntensity: effectiveIntensity });
      let savedResume = null;
      if (action === "resume") savedResume = await saveResumeVersion(user, job, result, { tailoringIntensity: effectiveIntensity, recommendation: latestScore?.recommendation });
      if (action === "message") await saveMessage(user, job, result);
      setAiState({ loading: "", error: "", latest: { action, result, resumeId: savedResume?.id }, confirm: "" });
      onTabChange?.(action);
    } catch (error) {
      setAiState({ loading: "", latest: null, error: error.message, confirm: "" });
    }
  }

  if (contentOnly) {
    return (
      <section className="grid gap-4">
        {aiState.loading && <div ref={loadingRef}><AiSkeleton action={aiState.loading} /></div>}
        {aiState.error && <MissingOrError message={aiState.error} />}
        {aiState.latest?.action === "fit" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
            Analysis completed. You have a clearer view of this opportunity.
          </div>
        )}
        {aiState.latest?.action === "resume" && aiState.latest.resumeId && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-bold">Tailored resume saved.</p>
            <Link className="mt-2 inline-flex font-semibold text-emerald-800 underline" to={`/app/generated-resumes?resume=${aiState.latest.resumeId}`}>
              View in Generated Resumes
            </Link>
          </div>
        )}
        {aiState.latest?.action === "message" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
            Recruiter message saved. Your outreach is ready when you are.
          </div>
        )}
        {activeAction === "fit" && <FitResult score={latestScore} onGenerate={() => runAi("fit")} onRegenerate={() => runAi("fit", { regenerate: true })} loading={aiState.loading} onContinue={() => onTabChange?.("resume")} />}
        {activeAction === "resume" && <ResumeResult resume={latestResume} onGenerate={() => runAi("resume")} onRegenerate={() => runAi("resume", { regenerate: true })} loading={aiState.loading} onExportComplete={onExportComplete} />}
        {activeAction === "message" && <MessageResult message={latestMessage} onGenerate={() => runAi("message")} onRegenerate={() => runAi("message", { regenerate: true })} loading={aiState.loading} />}
      </section>
    );
  }

  return (
    <section className={compact ? "grid gap-3" : "rounded-lg border border-brand-100 bg-white p-5 shadow-card"}>
      {!compact && (
        <>
          <h3 className="flex items-center gap-2 font-bold"><Sparkles size={18} className="text-brand-700" /> AI Tools</h3>
          <p className="mt-2 text-sm text-slate-600">Generate controlled drafts from your saved profile, base resume, and this job description.</p>
        </>
      )}
      <div className={`${compact ? "flex flex-col gap-2 rounded-lg border border-brand-100 bg-white/80 p-2 sm:flex-row sm:items-center sm:justify-between" : "mt-4 grid gap-3 md:grid-cols-3"}`}>
        {compact ? (
          <CompactGuidedAction
            activeAction={activeAction}
            latestScore={latestScore}
            latestResume={latestResume}
            latestMessage={latestMessage}
            loading={aiState.loading}
            onRun={runAi}
            onTabChange={onTabChange}
          />
        ) : (
          <div className="contents">
            <AiAction action="fit" label="Analysis" fullLabel="Analyze Fit" existing={latestScore} activeTab={activeTab} loading={aiState.loading} onRun={runAi} onView={() => onTabChange?.("fit")} />
            <AiAction action="resume" label="Resume" fullLabel="Tailor Resume" existing={latestResume} activeTab={activeTab} loading={aiState.loading} onRun={runAi} onView={() => onTabChange?.("resume")} />
            <AiAction action="message" label="Message" fullLabel="Generate Message" existing={latestMessage} activeTab={activeTab} loading={aiState.loading} onRun={runAi} onView={() => onTabChange?.("message")} />
          </div>
        )}
      </div>
      <div className={`${compact ? "rounded-lg bg-brand-50/70 p-3" : "mt-4 flex flex-col gap-2 rounded-lg bg-brand-50 p-3 sm:flex-row sm:items-center sm:justify-between"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-900">Tailoring intensity</p>
            <p className="text-xs text-slate-600">
              Controls how strongly resume wording is optimized for this role.
            </p>
            {latestScore?.recommendation === "Skip" && (
              <p className="mt-1 text-xs font-semibold text-amber-700">Conservative mode recommended for lower-fit roles.</p>
            )}
          </div>
          <select
            className="min-w-44 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-bold text-brand-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            value={getEffectiveIntensity("resume", intensity, manualIntensity, latestScore)}
            onChange={(event) => {
              setManualIntensity(true);
              setIntensity(event.target.value);
            }}
          >
            {["Conservative", "Balanced", "Aggressive"].map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>
        {!compact && (
          <p className="mt-2 text-xs text-slate-600">
            {getIntensityDescription(getEffectiveIntensity("resume", intensity, manualIntensity, latestScore))}
          </p>
        )}
      </div>
      {aiState.confirm && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Create a new version?</p>
          <p className="mt-1">This will keep the existing result and add a new history item.</p>
          <div className="mt-3 flex gap-2">
            <Button className="min-h-8 px-3 text-xs" onClick={() => runAi(aiState.confirm, { regenerate: true })}>Confirm regenerate</Button>
            <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => setAiState((current) => ({ ...current, confirm: "" }))}>Cancel</Button>
          </div>
        </div>
      )}
      {aiState.loading && <div ref={loadingRef}><AiSkeleton action={aiState.loading} /></div>}
      {aiState.error && <MissingOrError message={aiState.error} />}
      {aiState.latest?.action === "fit" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          Analysis completed. You have a clearer view of this opportunity.
        </div>
      )}
      {aiState.latest?.action === "resume" && aiState.latest.resumeId && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-bold">Tailored resume saved.</p>
          <Link className="mt-2 inline-flex font-semibold text-emerald-800 underline" to={`/app/generated-resumes?resume=${aiState.latest.resumeId}`}>
            View in Generated Resumes
          </Link>
        </div>
      )}
      {aiState.latest?.action === "message" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          Recruiter message saved. Your outreach is ready when you are.
        </div>
      )}
      {!compact && (
        <>
          {activeTab === "fit" && <FitResult score={latestScore} onGenerate={() => runAi("fit")} onRegenerate={() => runAi("fit", { regenerate: true })} loading={aiState.loading} />}
          {activeTab === "resume" && <ResumeResult resume={latestResume} onGenerate={() => runAi("resume")} onRegenerate={() => runAi("resume", { regenerate: true })} loading={aiState.loading} />}
          {activeTab === "message" && <MessageResult message={latestMessage} onGenerate={() => runAi("message")} onRegenerate={() => runAi("message", { regenerate: true })} loading={aiState.loading} />}
          <GenerationHistory scores={jobScoreHistory} resumes={resumeHistory} messages={messageHistory} />
        </>
      )}
    </section>
  );
}

function getEffectiveIntensity(action, intensity, manualIntensity, latestScore) {
  if (action === "resume" && latestScore?.recommendation === "Skip" && !manualIntensity) return "Conservative";
  return intensity;
}

function getIntensityDescription(value) {
  return {
    Conservative: "Minimal rewriting. Preserve original structure.",
    Balanced: "Optimize wording and alignment while preserving career identity.",
    Aggressive: "Stronger reframing and ATS optimization without inventing experience.",
  }[value];
}

function AiAction({ label, fullLabel, action, existing, activeTab, loading, onRun, onView }) {
  const active = loading === action;
  const selected = activeTab === action;
  const disabled = Boolean(loading);
  const text = existing ? `View ${label}` : fullLabel || label;
  return (
    <div className={`min-w-0 transition ${loading && !active ? "opacity-50" : ""}`}>
      <Button variant={selected ? "primary" : existing ? "secondary" : "primary"} className={`min-h-8 w-full px-3 text-xs sm:text-sm ${selected ? "shadow-soft" : ""}`} onClick={existing ? onView : () => onRun(action)} disabled={disabled}>
        {active ? "Working..." : text}
      </Button>
    </div>
  );
}

function CompactGuidedAction({ activeAction, latestScore, latestResume, latestMessage, loading, onRun, onTabChange }) {
  const state = {
    fit: latestScore,
    resume: latestResume,
    message: latestMessage,
  };
  const existing = state[activeAction];
  const primary = getPrimaryAction(activeAction, existing, { latestScore, latestResume, latestMessage });
  return (
    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Button
        className="min-h-9 px-4 text-sm"
        variant={primary.variant}
        onClick={() => {
          if (primary.nextTab) onTabChange?.(primary.nextTab);
          else onRun(activeAction);
        }}
        disabled={Boolean(loading)}
      >
        {loading === activeAction ? "Working..." : primary.label}
      </Button>
      <div className="flex flex-wrap gap-1">
        {[
          ["fit", "Analysis", latestScore],
          ["resume", "Resume", latestResume],
          ["message", "Message", latestMessage],
        ].map(([id, label, done]) => (
          <button
            key={id}
            type="button"
            className={`rounded-lg px-2 py-1 text-xs font-semibold ${activeAction === id ? "bg-brand-100 text-brand-900" : done ? "text-emerald-700 hover:bg-emerald-50" : "text-slate-500 hover:bg-brand-50"}`}
            onClick={() => onTabChange?.(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function getPrimaryAction(activeAction, existing, all) {
  if (activeAction === "fit" && existing) return { label: "Continue to Resume", nextTab: "resume", variant: "primary" };
  if (activeAction === "fit") return { label: "Analyze Fit", variant: "primary" };
  if (activeAction === "resume" && existing) return { label: "Ready to Export", nextTab: "resume", variant: "secondary" };
  if (activeAction === "resume") return { label: all.latestScore ? "Tailor Resume" : "Analyze Fit First", nextTab: all.latestScore ? "" : "fit", variant: all.latestScore ? "primary" : "secondary" };
  if (activeAction === "message" && existing) return { label: "View Message", nextTab: "message", variant: "secondary" };
  return { label: "Generate Recruiter Message", variant: "primary" };
}

function getLocalError(action, profile, job) {
  if (!canRunAi(profile)) return "Complete your profile target roles and base resume before running AI tools.";
  if (!job?.job_description?.trim()) return "Paste the job description before running AI tools.";
  if (!["fit", "resume", "message"].includes(action)) return "That AI action is not available.";
  return "";
}

function AiSkeleton({ action }) {
  const copy = {
    fit: ["Analyzing your background against this role...", "Comparing your profile, base resume, and the saved job description."],
    resume: ["Optimizing your resume for this role...", "Refining your resume based on this job description."],
    message: ["Drafting a concise recruiter outreach message...", "Pulling out a couple of grounded strengths for a human note."],
  }[action];
  return (
    <div className="mt-4 rounded-lg border border-brand-100 bg-white p-6 text-center shadow-card">
      <div className="mx-auto flex max-w-xl flex-col items-center">
        <span className="h-9 w-9 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" />
        <p className="mt-4 font-bold text-brand-900">{copy[0]}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{copy[1]} This may take a few seconds.</p>
      </div>
      <div className="mx-auto mt-5 grid max-w-2xl gap-2">
        <div className="h-3 w-11/12 animate-pulse rounded bg-brand-100" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-brand-100" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-brand-100" />
      </div>
    </div>
  );
}

export function FitResult({ score, onGenerate, onRegenerate, onContinue, loading, showAction = true }) {
  if (!score) return <EmptyAiState title="No fit analysis yet" description="See strengths, gaps, keywords, and a recommendation for this role." action={showAction && onGenerate ? "Analyze Fit" : ""} onAction={onGenerate} loading={loading} />;
  const tone = getScoreTone(score.score);
  return (
    <div className={`w-full animate-[fadeIn_260ms_ease-out] rounded-lg border p-6 shadow-card ${tone.panel}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className={`grid h-28 w-28 shrink-0 place-items-center rounded-full border-4 ${tone.ring}`}>
            <span className={`text-5xl font-black ${tone.score}`}>{score.score}</span>
          </div>
          <div>
            <p className={`text-lg font-black ${tone.score}`}>{tone.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">Fit score</p>
            <p className="mt-1 text-xs text-slate-500">Saved {formatDate(score.created_at?.slice(0, 10))}</p>
          </div>
        </div>
        <RecommendationBadge value={score.recommendation} />
      </div>
      <p className="mt-5 rounded-lg bg-white/80 p-4 text-sm font-medium leading-6 text-slate-700">{score.summary}</p>
      <AiList title="Strengths" items={score.strengths} />
      <AiList title="Gaps" items={score.gaps} />
      <TransferableStrengths items={score.transferable_strengths || score.transferableStrengths} />
      <BetterAlignedRoles items={score.better_aligned_roles || score.betterAlignedRoles} />
      <AiList title="Keywords" items={score.keywords} inline />
      <div className="mt-5 flex flex-wrap gap-2">
        {onContinue && <Button onClick={onContinue}>Continue to Resume</Button>}
        {onRegenerate && <RegenerateButton label="Regenerate analysis" onClick={onRegenerate} disabled={Boolean(loading)} />}
      </div>
    </div>
  );
}

export function ResumeResult({ resume, onGenerate, onRegenerate, onExportComplete, loading, showAction = true }) {
  const { profile, jobs } = useWorkspaceStore();
  const job = resume ? jobs.find((item) => item.id === resume.job_id) : null;
  const whyThisFits = extractWhyThisFits(resume?.content);
  if (!resume) return <EmptyAiState title="No tailored resume yet" description="Create an application-ready resume version using your base resume and this job." action={showAction && onGenerate ? "Tailor Resume" : ""} onAction={onGenerate} loading={loading} />;
  return (
    <div className="w-full rounded-lg bg-brand-50 p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-500">Ready to Apply</p>
          <h4 className="mt-1 font-bold">{resume.title}</h4>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Your tailored resume is ready. Review the polished version in Generated Resumes or export it from here.
          </p>
        </div>
        <CopyButton text={resume.content} />
      </div>
      {whyThisFits && (
        <div className="mt-4 rounded-lg bg-white/85 p-4 text-sm leading-6 text-slate-700">
          <p className="font-bold text-ink">Why this fits</p>
          <p className="mt-2">{whyThisFits}</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
          to={`/app/generated-resumes?resume=${resume.id}`}
        >
          View in Generated Resumes
        </Link>
      </div>
      <div className="mt-5">
        <ResumeExportPanel resume={resume} profile={profile} job={job} compact onExportComplete={onExportComplete} />
      </div>
      {onRegenerate && <RegenerateButton label="Regenerate resume" onClick={onRegenerate} disabled={Boolean(loading)} />}
    </div>
  );
}

export function MessageResult({ message, onGenerate, onRegenerate, loading, showAction = true }) {
  if (!message) return <EmptyAiState title="No recruiter message yet" description="Create a short outreach message you can send to a recruiter or hiring contact." action={showAction && onGenerate ? "Generate Recruiter Message" : ""} onAction={onGenerate} loading={loading} />;
  return (
    <div className="w-full rounded-lg bg-brand-50 p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-bold">{normalizeMessageType(message.type)}</h4>
          <p className="text-xs text-slate-500">Saved {formatDate(message.created_at?.slice(0, 10))}</p>
        </div>
        <CopyButton text={message.content} />
      </div>
      <p className="mt-4 whitespace-pre-wrap rounded-lg bg-white p-4 text-sm leading-6 text-slate-700">{message.content}</p>
      {onRegenerate && <RegenerateButton label="Regenerate message" onClick={onRegenerate} disabled={Boolean(loading)} />}
    </div>
  );
}

export function GenerationHistory({ scores, resumes, messages }) {
  const [open, setOpen] = useState(false);
  const items = [
    ...scores.map((score) => ({ kind: "Fit Analysis", date: score.created_at, content: score.summary, score })),
    ...resumes.map((resume) => ({ kind: "Resume Draft", date: resume.updated_at || resume.created_at, content: resume.content, resume })),
    ...messages.map((message) => ({ kind: "Recruiter Message", date: message.created_at, content: message.content, message })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="mt-6 border-t border-brand-100 pt-4">
      <button type="button" className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-brand-50" onClick={() => setOpen((value) => !value)}>
        <span className="font-bold">Generation history</span>
        <span className="text-xs font-semibold text-brand-700">{items.length} item{items.length === 1 ? "" : "s"}</span>
      </button>
      {open && (
        <div className="mt-3 grid gap-3">
          {items.map((item, index) => <HistoryItem key={`${item.kind}-${item.date}-${index}`} item={item} index={index} total={items.length} />)}
        </div>
      )}
      {!items.length && (
        <p className="text-sm text-slate-500">Generated fit scores, resume drafts, and messages will appear here.</p>
      )}
    </div>
  );
}

function HistoryItem({ item, index, total }) {
  const title = item.score ? `Fit score: ${item.score.score}` : item.resume ? item.resume.title : normalizeMessageType(item.message.type);
  return (
    <div className="rounded-lg border border-brand-100 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{title}</p>
            {index === 0 && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-800">Latest</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Version {total - index} | Generated {formatDateTime(item.date)}
            {item.resume?.tailoring_intensity ? ` | ${item.resume.tailoring_intensity}` : ""}
            {item.resume?.recommendation ? ` | ${item.resume.recommendation}` : ""}
            {item.score?.recommendation ? ` | ${item.score.recommendation}` : ""}
          </p>
        </div>
        {item.content && <CopyButton text={item.content} />}
      </div>
    </div>
  );
}

function EmptyAiState({ title, description, action, onAction, loading }) {
  return (
    <div className="rounded-lg border border-brand-100 bg-brand-50 p-5">
      <h4 className="font-bold text-brand-900">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      {onAction && action && <Button className="mt-4 shadow-soft" onClick={onAction} disabled={Boolean(loading)}>{action}</Button>}
    </div>
  );
}

function MissingOrError({ message }) {
  const needsProfile = message.includes("profile") || message.includes("base resume");
  return (
    <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">
      {message}
      {needsProfile && <Link className="ml-2 underline" to="/app/settings">Open profile setup</Link>}
    </div>
  );
}

function RegenerateButton({ label, onClick, disabled }) {
  return (
    <Button variant="ghost" className="mt-4 min-h-8 px-2 text-xs" onClick={onClick} disabled={disabled}>
      <RefreshCcw size={14} /> {label}
    </Button>
  );
}

function extractWhyThisFits(content = "") {
  const match = String(content).match(/(?:^|\n)\s*why this fits\s*:?\s*\n?([\s\S]*)$/i);
  return match?.[1]?.trim() || "";
}

function AiList({ title, items = [], inline = false }) {
  return (
    <div className="mt-4">
      <p className="text-sm font-bold">{title}</p>
      <div className={`mt-2 ${inline ? "flex flex-wrap gap-2" : "grid gap-2"}`}>
        {items.map((item) => (
          <span key={item} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">{item}</span>
        ))}
      </div>
    </div>
  );
}

function TransferableStrengths({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <p className="text-sm font-bold">Transferable Strengths</p>
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <div key={`${item.skill}-${item.whyItMatters}`} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold text-ink">{item.skill}</span>
            <span className="block text-slate-600">{item.whyItMatters}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BetterAlignedRoles({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <p className="text-sm font-bold">Better Aligned Roles</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={`${item.role}-${item.reason}`}
            type="button"
            className="rounded-lg bg-white px-3 py-2 text-left text-sm text-brand-800 ring-1 ring-brand-100 hover:bg-brand-50"
            title={item.reason}
          >
            {item.role}
          </button>
        ))}
      </div>
    </div>
  );
}

function RecommendationBadge({ value }) {
  const tone = value === "Apply" ? "bg-emerald-100 text-emerald-700" : value === "Maybe" ? "bg-amber-100 text-amber-800" : "bg-rose-50 text-rose-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{value}</span>;
}

function getScoreTone(score) {
  if (Number(score) >= 85) return { label: "Strong Match", panel: "border-emerald-200 bg-emerald-50", ring: "border-emerald-200 bg-white", score: "text-emerald-700" };
  if (Number(score) >= 65) return { label: "Good Potential", panel: "border-sky-200 bg-sky-50", ring: "border-sky-200 bg-white", score: "text-sky-700" };
  if (Number(score) >= 45) return { label: "Stretch Role", panel: "border-amber-200 bg-amber-50", ring: "border-amber-200 bg-white", score: "text-amber-700" };
  return { label: "Low Match", panel: "border-rose-100 bg-rose-50", ring: "border-rose-100 bg-white", score: "text-rose-700" };
}

function normalizeMessageType(type) {
  return type === "LinkedIn intro" ? "Recruiter Message" : type || "Recruiter Message";
}

function formatDateTime(value) {
  if (!value) return "Not dated";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text || "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-white">
      <Clipboard size={14} /> {copied ? "Copied" : "Copy"}
    </button>
  );
}
