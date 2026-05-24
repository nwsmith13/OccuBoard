import { formatDate, todayIso } from "./date.js";

export const followUpStatuses = {
  none: "none",
  scheduled: "scheduled",
  due: "due",
  overdue: "overdue",
  completed: "completed",
  snoozed: "snoozed",
};

export function getFollowUpDate(job = {}) {
  return job.followup_date || job.followUpDate || "";
}

export function getFollowUpCompletedAt(job = {}) {
  return job.followup_completed_at || job.followUpCompletedAt || "";
}

export function getFollowUpSnoozedUntil(job = {}) {
  return job.followup_snoozed_until || job.followUpSnoozedUntil || "";
}

export function getFollowUpNote(job = {}) {
  return job.followup_note || job.followUpNote || "";
}

export function getFollowUpStatus(job = {}) {
  const completedAt = getFollowUpCompletedAt(job);
  if (completedAt) return followUpStatuses.completed;

  const snoozedUntil = getFollowUpSnoozedUntil(job);
  if (snoozedUntil && snoozedUntil > todayIso()) return followUpStatuses.snoozed;

  const followUpDate = getFollowUpDate(job);
  if (!followUpDate) return followUpStatuses.none;
  if (followUpDate === todayIso()) return followUpStatuses.due;
  if (followUpDate < todayIso()) return followUpStatuses.overdue;
  return followUpStatuses.scheduled;
}

export function getFollowUpLabel(job = {}) {
  const status = getFollowUpStatus(job);
  const date = getFollowUpDate(job);
  const snoozedUntil = getFollowUpSnoozedUntil(job);

  if (status === followUpStatuses.due) return "Follow up today";
  if (status === followUpStatuses.overdue) return "Overdue";
  if (status === followUpStatuses.scheduled) return `Follow up ${formatDate(date)}`;
  if (status === followUpStatuses.snoozed) return `Snoozed until ${formatDate(snoozedUntil)}`;
  if (status === followUpStatuses.completed) return "Completed";
  return "";
}

export function getFollowUpTone(status) {
  return {
    overdue: "bg-rose-50 text-rose-700 ring-rose-100",
    due: "bg-amber-50 text-amber-800 ring-amber-100",
    scheduled: "bg-brand-50 text-brand-800 ring-brand-100",
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    snoozed: "bg-slate-100 text-slate-600 ring-slate-200",
  }[status] ?? "bg-slate-50 text-slate-500 ring-slate-100";
}

export function getStageNextStep(job = {}, aiStatus = {}) {
  const stage = normalizeStage(job.status);
  const followStatus = getFollowUpStatus(job);
  const followDate = getFollowUpDate(job);

  if (stage === "Saved") {
    if (aiStatus.resumeDrafted && aiStatus.messageDrafted) return "Review and apply";
    if (!aiStatus.resumeDrafted) return "Generate resume";
    if (!aiStatus.messageDrafted) return "Generate message";
    return "Review and apply";
  }

  if (stage === "Applied") {
    if (followStatus === "overdue") return "Follow up overdue";
    if (followStatus === "due") return "Follow up today";
    if (followStatus === "scheduled") return `Follow up on ${formatDate(followDate)}`;
    if (followStatus === "snoozed") return getFollowUpLabel(job);
    if (followStatus === "completed") return "Waiting for response";
    return "Waiting for response";
  }

  if (stage === "Interview") {
    if (followStatus === "overdue" || followStatus === "due") return "Send thank-you / follow up";
    if (followStatus === "scheduled") return `Follow up on ${formatDate(followDate)}`;
    return "Prepare for interview";
  }

  if (stage === "Closed") return "Outcome recorded";
  return "";
}

export function normalizeStage(status) {
  if (status === "Tailoring") return "Saved";
  if (["Offer", "Rejected", "Closed"].includes(status)) return "Closed";
  return status || "Saved";
}

export function addDaysIso(days) {
  const date = new Date(`${todayIso()}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
