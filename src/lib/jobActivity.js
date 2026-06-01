import { formatDate } from "./date.js";

export function formatActivityLabel(event = {}) {
  const metadata = parseMetadata(event.metadata);
  const fallback = event.label || "Activity recorded";
  return {
    job_created: "Job created",
    analysis_generated: "Analysis generated",
    resume_generated: "Resume generated",
    resume_generated_with_mitigation: "Resume generated with mitigation strategy",
    resume_strengthened_from_analysis: "Resume strengthened from analysis",
    resume_exported_pdf: "Resume exported PDF",
    resume_exported_docx: "Resume exported DOCX",
    message_generated: "Message generated",
    message_generated_with_mitigation: "Recruiter message generated with mitigation strategy",
    message_strengthened_from_analysis: "Recruiter message strengthened from analysis",
    message_regenerated: "Recruiter message regenerated",
    message_edited: "Recruiter message edited",
    message_copied: "Recruiter message copied",
    cover_letter_generated: "Cover letter generated",
    cover_letter_generated_with_mitigation: "Cover letter generated with mitigation strategy",
    cover_letter_strengthened_from_analysis: "Cover letter strengthened from analysis",
    cover_letter_regenerated: "Cover letter regenerated",
    cover_letter_edited: "Cover letter edited",
    cover_letter_copied: "Cover letter copied",
    cover_letter_skipped: "Cover letter skipped",
    cover_letter_status_updated: "Cover letter status updated",
    cover_letter_exported_pdf: "Cover letter exported PDF",
    cover_letter_exported_docx: "Cover letter exported DOCX",
    followup_message_generated: "Follow-up message generated",
    followup_message_copied: "Follow-up message copied",
    followup_calendar_exported: "Follow-up calendar exported",
    followup_saved: "Follow-up saved",
    followup_completed: "Follow-up completed",
    followup_snoozed: "Follow-up snoozed",
    stage_changed: metadata.to ? `Moved to ${metadata.to}` : "Stage changed",
    application_marked: metadata.stage ? `Marked ${metadata.stage}` : "Application updated",
    job_edited: "Job edited",
    job_deleted: "Job deleted",
    contact_added: "Contact added",
    contact_edited: "Contact edited",
    contact_deleted: "Contact deleted",
    contact_contacted: "Contact marked contacted",
    job_archived: "Opportunity archived",
    job_restored: "Opportunity restored",
    interview_prep_generated: "Interview prep generated",
    interview_details_saved: "Interview details saved",
    interview_calendar_exported: "Interview calendar exported",
    interview_thank_you_generated: "Thank-you message generated",
    interview_completed: "Interview completed",
    resume_imported: "Resume imported",
  }[event.type] ?? fallback;
}

export function formatActivityDetails(event = {}) {
  const metadata = parseMetadata(event.metadata);
  if (event.type?.includes("_with_mitigation") || event.type?.includes("_strengthened_from_analysis")) return normalizeAppliedLabels(metadata.appliedLabels).join(" - ") || metadata.detail || "";
  if (event.type === "analysis_generated") return [metadata.score && `${metadata.score}% fit`, metadata.recommendation].filter(Boolean).join(" - ");
  if (event.type === "resume_generated") return metadata.title || "";
  if (event.type === "stage_changed") return [metadata.from && `From ${metadata.from}`, metadata.to && `to ${metadata.to}`].filter(Boolean).join(" ");
  if (event.type === "followup_saved") return metadata.date ? `Next follow-up ${formatDate(metadata.date)}` : "";
  if (event.type === "followup_snoozed") return metadata.until ? `Until ${formatDate(metadata.until)}` : "";
  if (event.type === "followup_completed") return metadata.completedAt ? `Completed ${formatDate(String(metadata.completedAt).slice(0, 10))}` : "";
  if ((event.type === "message_generated" || event.type === "followup_message_generated") && metadata.contactName) return `For ${metadata.contactName}`;
  if (event.type === "message_regenerated" || event.type === "message_edited" || event.type === "message_copied") return metadata.detail || "";
  if (event.type?.startsWith("cover_letter")) return metadata.fileType ? `${metadata.fileType} download` : metadata.detail || metadata.type || "";
  if (event.type === "followup_message_copied") return metadata.detail || "Ready to send outside OccuBoard";
  if (event.type === "followup_calendar_exported") return [metadata.fileType, metadata.date ? formatDate(metadata.date) : ""].filter(Boolean).join(" - ");
  if (event.type === "interview_details_saved") return [metadata.date ? formatDate(metadata.date) : "", metadata.time, metadata.type].filter(Boolean).join(" - ");
  if (event.type === "interview_calendar_exported") return [metadata.fileType, metadata.date ? formatDate(metadata.date) : ""].filter(Boolean).join(" - ");
  if (event.type === "resume_exported_pdf" || event.type === "resume_exported_docx") return metadata.fileType ? `${metadata.fileType} download` : "";
  if (event.type?.startsWith("contact_")) return [metadata.contactName, metadata.company].filter(Boolean).join(" at ");
  if (event.type === "job_archived") return metadata.reason || "Hidden from active pipeline";
  if (event.type === "job_restored") return "Returned to active pipeline";
  return metadata.detail || metadata.title || metadata.company || "";
}

function normalizeAppliedLabels(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

export function formatRelativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const units = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["week", 1000 * 60 * 60 * 24 * 7],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ];
  const [unit, ms] = units.find(([, unitMs]) => absMs >= unitMs) ?? ["minute", 1000 * 60];
  const valueCount = Math.round(diffMs / ms);
  if (absMs < 60_000) return "Just now";
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(valueCount, unit);
}

export function getActivityColor(type = "") {
  if (type.includes("followup")) return "bg-amber-50 text-amber-700 ring-amber-100";
  if (type.includes("cover_letter")) return "bg-brand-50 text-brand-800 ring-brand-100";
  if (type.includes("resume")) return "bg-brand-50 text-brand-800 ring-brand-100";
  if (type.includes("message")) return "bg-cyan-50 text-cyan-700 ring-cyan-100";
  if (type.includes("stage") || type.includes("application")) return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (type.includes("archived") || type.includes("restored")) return "bg-slate-50 text-slate-600 ring-slate-100";
  if (type.includes("contact")) return "bg-cyan-50 text-cyan-700 ring-cyan-100";
  if (type.includes("interview")) return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (type.includes("analysis")) return "bg-purple-50 text-purple-700 ring-purple-100";
  return "bg-slate-50 text-slate-600 ring-slate-100";
}

export function getActivityIcon(type = "") {
  if (type.includes("followup_snoozed")) return "clock";
  if (type.includes("followup_completed")) return "check-circle";
  if (type.includes("followup")) return "bell";
  if (type.includes("cover_letter_exported")) return "download";
  if (type.includes("cover_letter")) return "file-text";
  if (type.includes("resume_exported")) return "download";
  if (type.includes("resume")) return "file-text";
  if (type.includes("message")) return "message-circle";
  if (type.includes("stage") || type.includes("application")) return "arrow-right-circle";
  if (type.includes("archived") || type.includes("restored")) return "archive";
  if (type.includes("contact")) return "user";
  if (type.includes("interview")) return "sparkles";
  if (type.includes("analysis")) return "sparkles";
  if (type.includes("import")) return "upload";
  return "circle";
}

export function getActivityGroup(value) {
  if (!value) return "Earlier";
  const date = new Date(value);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - 7);
  if (date >= startToday) return "Today";
  if (date >= startYesterday) return "Yesterday";
  if (date >= startWeek) return "This week";
  return "Earlier";
}

export function parseMetadata(metadata) {
  if (!metadata) return {};
  if (typeof metadata === "object") return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}
