import { getDisplayCompanyName, getDisplayJobTitle } from "./jobDisplay.js";

const defaultFollowUpTime = "09:00";
const defaultInterviewTime = "09:00";

export function buildFollowUpCalendarEvent(job = {}, options = {}) {
  const date = options.date || job.followup_date;
  const time = options.time || defaultFollowUpTime;
  const start = buildLocalDate(date, time);
  const durationMinutes = Number(options.durationMinutes || 15);
  const contacts = options.contacts || [];
  const contact = options.contact || contacts[0];
  const latestMessage = options.latestFollowUpMessage?.content || options.latestFollowUpMessage || "";
  const title = `Follow up: ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`;
  const description = [
    `Job title: ${getDisplayJobTitle(job)}`,
    `Company: ${getDisplayCompanyName(job)}`,
    `Stage: ${job.status || "Saved"}`,
    contact?.name ? `Contact: ${contact.name}${contact.email ? ` (${contact.email})` : ""}` : "",
    job.source_url ? `Source: ${job.source_url}` : "",
    options.note ? `Note: ${options.note}` : "",
    latestMessage ? `Latest follow-up message:\n${latestMessage}` : "",
    "Created from OccuBoard",
  ].filter(Boolean).join("\n");

  return createCalendarEvent({
    title,
    description,
    location: "",
    start,
    end: addMinutes(start, durationMinutes),
    fileName: `follow-up-${getDisplayJobTitle(job)}-at-${getDisplayCompanyName(job)}.ics`,
  });
}

export function buildInterviewCalendarEvent(job = {}, details = {}) {
  const date = details.interview_date || details.interviewDate || job.interview_date;
  const time = details.interview_time || details.interviewTime || job.interview_time || defaultInterviewTime;
  const durationMinutes = Number(details.interview_duration || details.interviewDuration || job.interview_duration || 30);
  const start = buildLocalDate(date, time);
  const contacts = details.contacts || [];
  const contactId = details.interviewer_contact_id || details.interviewerContactId || job.interviewer_contact_id;
  const contact = details.contact || contacts.find((item) => item.id === contactId) || contacts[0];
  const interviewType = details.interview_type || details.interviewType || job.interview_type || "Video";
  const location = details.interview_location || details.interviewLocation || job.interview_location || "";
  const title = `Interview: ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`;
  const description = [
    `Job title: ${getDisplayJobTitle(job)}`,
    `Company: ${getDisplayCompanyName(job)}`,
    contact?.name ? `Interviewer/contact: ${contact.name}${contact.email ? ` (${contact.email})` : ""}` : "",
    `Interview type: ${interviewType}`,
    details.notes ? `Notes: ${details.notes}` : "",
    job.source_url ? `Source: ${job.source_url}` : "",
    "Review Interview Prep before this meeting.",
    "Created from OccuBoard",
  ].filter(Boolean).join("\n");

  return createCalendarEvent({
    title,
    description,
    location,
    start,
    end: addMinutes(start, durationMinutes),
    fileName: `interview-${getDisplayJobTitle(job)}-at-${getDisplayCompanyName(job)}.ics`,
  });
}

export function downloadIcsEvent(event) {
  if (!event?.start || Number.isNaN(event.start.getTime())) return false;
  const content = buildIcs(event);
  const blob = new window.Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = event.fileName || "occuboard-event.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return true;
}

export function buildGoogleCalendarUrl(event) {
  if (!event?.start || Number.isNaN(event.start.getTime())) return "";
  const params = toQueryString({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toCalendarDate(event.start)}/${toCalendarDate(event.end)}`,
    details: event.description || "",
    location: event.location || "",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function buildOutlookCalendarUrl(event) {
  if (!event?.start || Number.isNaN(event.start.getTime())) return "";
  const params = toQueryString({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: event.start.toISOString(),
    enddt: event.end.toISOString(),
    body: event.description || "",
    location: event.location || "",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

function toQueryString(params) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function createCalendarEvent(event) {
  return {
    ...event,
    fileName: safeFilename(event.fileName || `${event.title}.ics`),
    uid: `${safeFilename(event.title)}-${event.start?.getTime() || Date.now()}@occuboard`,
  };
}

function buildLocalDate(date, time) {
  if (!date) return null;
  const [hours = "09", minutes = "00"] = String(time || "09:00").split(":");
  const value = new Date(`${date}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function addMinutes(date, minutes) {
  if (!date) return null;
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function buildIcs(event) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OccuBoard//Calendar Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(event.uid)}`,
    `DTSTAMP:${toCalendarDate(new Date())}`,
    `DTSTART:${toCalendarDate(event.start)}`,
    `DTEND:${toCalendarDate(event.end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description || "")}`,
    `LOCATION:${escapeIcs(event.location || "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

function toCalendarDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let remaining = line;
  while (remaining.length > 75) {
    parts.push(remaining.slice(0, 75));
    remaining = ` ${remaining.slice(75)}`;
  }
  parts.push(remaining);
  return parts.join("\r\n");
}

function safeFilename(value = "") {
  const base = String(value)
    .replace(/\.ics$/i, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return `${base || "occuboard-event"}.ics`;
}
