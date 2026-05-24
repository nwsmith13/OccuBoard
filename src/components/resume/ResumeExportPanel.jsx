import { Download, Eye, FileText, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import {
  exportResumeDocx,
  exportResumePdf,
  getResumeExportHistory,
  openResumePrintPreview,
  parseResumeForExport,
} from "../../lib/resumeExport.js";
import { Button } from "../ui/Button.jsx";

const exportColors = {
  Purple: "#7c3aed",
  Blue: "#2563eb",
  Green: "#059669",
  Charcoal: "#334155",
};

export function ResumeExportPanel({ resume, content, profile, job, compact = false, showHistory = !compact, historyResumeId, onExportComplete }) {
  const [includeWhyThisFits, setIncludeWhyThisFits] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [exportStyle, setExportStyle] = useState("Professional");
  const [exportColor, setExportColor] = useState("Purple");
  const [exporting, setExporting] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState(() => getResumeExportHistory());
  const resumeContent = content || resume?.content || "";
  const parsedSections = useMemo(
    () => parseResumeForExport(resumeContent, { includeWhyThisFits, profile }),
    [includeWhyThisFits, profile, resumeContent],
  );
  const visibleHistory = useMemo(
    () => (historyResumeId ? history.filter((item) => item.resumeId === historyResumeId) : history),
    [history, historyResumeId],
  );

  async function runExport(type) {
    setExporting(type);
    setError("");
    try {
      if (type === "PDF") await exportResumePdf({ content: resumeContent, profile, job, resume, includeWhyThisFits, accentColor: exportColors[exportColor] });
      if (type === "DOCX") await exportResumeDocx({ content: resumeContent, profile, job, resume, includeWhyThisFits, accentColor: exportColors[exportColor] });
      setHistory(getResumeExportHistory());
      onExportComplete?.(resume);
      setSuccess(`Resume ready to send. ${type} export successful.`);
      window.setTimeout(() => setSuccess(""), 3200);
    } catch {
      setError(`We couldn't export the ${type} yet. Try again, or use Print Preview as a fallback.`);
    } finally {
      setExporting("");
    }
  }

  function printPreview() {
    setError("");
    try {
      openResumePrintPreview({ content: resumeContent, profile, job, includeWhyThisFits, accentColor: exportColors[exportColor] });
    } catch {
      setError("We couldn't open Print Preview. Check that pop-ups are allowed, then try again.");
    }
  }

  if (!resumeContent.trim()) {
    return (
      <section className={`rounded-lg bg-white/90 shadow-card ${compact ? "p-3" : "p-4"}`}>
        <p className="text-sm font-bold text-ink">Resume preview unavailable</p>
        <p className="mt-1 text-sm text-slate-500">This resume does not have saved text yet. Regenerate it from the job workspace when you are ready.</p>
      </section>
    );
  }

  return (
    <section className={`rounded-lg bg-white/90 shadow-card transition ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold text-ink">Export resume</p>
          <p className="mt-1 text-xs text-slate-500">Preview is export-ready. PDF and DOCX use this cleaned document structure.</p>
        </div>
        <div className="grid gap-2 rounded-lg bg-brand-50/70 p-2.5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Download</p>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-9 px-3 text-xs transition hover:-translate-y-0.5" onClick={() => runExport("PDF")} disabled={Boolean(exporting)}>
                <Download size={14} /> {exporting === "PDF" ? "Exporting..." : "PDF"}
            </Button>
            <Button className="min-h-9 px-3 text-xs transition hover:-translate-y-0.5" onClick={() => runExport("DOCX")} disabled={Boolean(exporting)}>
                <FileText size={14} /> {exporting === "DOCX" ? "Exporting..." : "DOCX"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => setShowPreview((value) => !value)}>
              <Eye size={14} /> {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>
            <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={printPreview}>
              <Printer size={14} /> Print Preview
            </Button>
          </div>
        </div>
      </div>

      {success && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{success}</p>}
      {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}

      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="flex items-start gap-3 rounded-lg bg-brand-50/70 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-brand-200 text-brand-700 focus:ring-brand-200"
            checked={includeWhyThisFits}
            onChange={(event) => setIncludeWhyThisFits(event.target.checked)}
          />
          <span>
            <span className="block font-semibold text-ink">Include Why This Fits section</span>
            <span className={`text-xs ${includeWhyThisFits ? "font-semibold text-brand-700" : "text-slate-500"}`}>
              {includeWhyThisFits ? "This section will be included at the end of exported files." : "Excluded from apply-ready resume by default."}
            </span>
          </span>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Export style
          <select
            className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            value={exportStyle}
            onChange={(event) => setExportStyle(event.target.value)}
          >
            <option>Professional</option>
            <option disabled>Modern (coming soon)</option>
            <option disabled>Compact (coming soon)</option>
          </select>
        </label>
      </div>

      <div className="mt-3 rounded-lg bg-brand-50/50 p-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-500">Accent color</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(exportColors).map(([label, value]) => (
            <button
              key={label}
              type="button"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold transition ${exportColor === label ? "bg-white text-ink shadow-sm ring-2 ring-brand-200" : "text-slate-600 hover:bg-white/70"}`}
              onClick={() => setExportColor(label)}
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: value }} />
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Applies to resume export accents only. OccuBoard stays on its current app theme.</p>
      </div>

      {showPreview && <ResumeExportPreview sections={parsedSections} accentColor={exportColors[exportColor]} />}

      {showHistory && visibleHistory.length > 0 && (
        <div className="mt-4 border-t border-brand-100/70 pt-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-500">Recent exports</p>
          <div className="mt-2 grid gap-2">
            {visibleHistory.slice(0, compact ? 2 : 4).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-ink">{item.fileName}</span>
                <span>{item.type} - {new Date(item.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ResumeExportPreview({ sections, accentColor = exportColors.Purple }) {
  const contactSection = sections.find((section) => section.title === "CONTACT");
  const documentSections = sections.filter((section) => section.title !== "CONTACT");
  return (
    <div className="mt-4 max-h-[720px] animate-[fadeIn_260ms_ease-out] overflow-x-auto overflow-y-auto rounded-lg bg-stone-100/80 p-2 sm:p-3">
      <article className="mx-auto min-h-[920px] w-full min-w-[min(640px,100%)] max-w-[760px] bg-white px-5 py-7 text-[13px] leading-7 text-slate-800 shadow-card sm:px-8 lg:px-12 lg:py-10">
        {contactSection && <ResumeContactHeader section={contactSection} />}
        {documentSections.map((section, index) => {
          return (
            <section key={`${section.title}-${index}`} className="mt-6 break-inside-avoid">
              <h4 className="border-b pb-1 text-sm font-bold uppercase tracking-[0.04em] text-ink" style={{ borderColor: accentColor }}>{section.title}</h4>
              <div className="mt-3">
                {section.lines.filter(Boolean).map((line, lineIndex) => {
                  if (/^[-*]\s+/.test(line)) {
                    return <p key={`${line}-${lineIndex}`} className="ml-5 list-item">{line.replace(/^[-*]\s+/, "")}</p>;
                  }
                  return <p key={`${line}-${lineIndex}`} className="mb-1">{line}</p>;
                })}
              </div>
            </section>
          );
        })}
      </article>
    </div>
  );
}

function ResumeContactHeader({ section }) {
  const [name, ...contact] = section.lines.filter(Boolean);
  if (!name && !contact.length) return null;
  return (
    <header className="mb-5 text-center">
      {name && <h3 className="text-2xl font-bold leading-tight text-ink">{name}</h3>}
      {contact.map((line, index) => (
        <p key={line} className={`${index === 0 ? "mt-1.5" : "mt-0.5"} text-[12px] leading-5 text-slate-600`}>
          {line}
        </p>
      ))}
    </header>
  );
}
