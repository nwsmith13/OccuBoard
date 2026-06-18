import { seedActivityLogs, seedJobActivityLogs, seedJobScores, seedJobs, seedMessages, seedProfile, seedResumeVersions } from "../data/seedData.js";
import { deriveCompanyDomain } from "./companyIdentity.js";
import { hasValidInterviewPrep, normalizeInterviewPrepContent, normalizeInterviewPrepRecord } from "./interviewPrep.js";
import { getDisplayCompanyName, getDisplayJobTitle, getTailoredResumeTitle } from "./jobDisplay.js";
import { createEmptyProfile } from "./profile.js";
import { getSupabaseClient, hasSupabaseConfig } from "./supabase.js";

const keys = {
  profile: "occuboard:demo:profile",
  jobs: "occuboard.jobs",
  jobFollowUpOverrides: "occuboard.jobFollowUpOverrides",
  jobCalendarOverrides: "occuboard.jobCalendarOverrides",
  jobArchiveOverrides: "occuboard.jobArchiveOverrides",
  jobCoverLetterOverrides: "occuboard.jobCoverLetterOverrides",
  jobAiUsageOverrides: "occuboard.jobAiUsageOverrides",
  activityLogs: "occuboard.activityLogs",
  jobActivityLogs: "occuboard.jobActivityLogs",
  jobContacts: "occuboard.jobContacts",
  interviewPrep: "occuboard.interviewPrep",
  resumeVersions: "occuboard.resumeVersions",
  jobScores: "occuboard.jobScores",
  messages: "occuboard.messages",
  resumeUploads: "occuboard.resumeUploads",
  profileOptionalOverrides: "occuboard:profileOptionalOverrides",
};

const legacyGlobalProfileKeys = [
  "occuboard.profile",
  "occuboard:profile",
  "profile",
  "profileData",
  "occuboard.profileOptionalOverrides",
  "occuboard:profileOptionalOverrides",
];
const missingRemoteTables = new Set();

function readLocal(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      window.localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(stored);
    if (!isSameCollectionShape(parsed, fallback)) throw new Error("Saved workspace data has an unexpected shape.");
    return parsed;
  } catch {
    window.localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the current in-memory action moving even if browser storage is unavailable.
  }
  return value;
}

function isSameCollectionShape(value, fallback) {
  if (Array.isArray(fallback)) return Array.isArray(value);
  return value && typeof value === "object" && !Array.isArray(value);
}

function now() {
  return new Date().toISOString();
}

async function logActivity(user, type, description) {
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    await supabase.from("activity_logs").insert({ user_id: user.id, type, description });
    return;
  }
  const logs = readLocal(keys.activityLogs, seedActivityLogs);
  writeLocal(keys.activityLogs, [
    { id: crypto.randomUUID(), user_id: "local-demo-user", type, description, created_at: now() },
    ...logs,
  ]);
}

export async function logJobActivity(user, jobId, type, metadata = {}) {
  if (!jobId) return null;
  const payload = {
    user_id: user?.id ?? "local-demo-user",
    job_id: jobId,
    type,
    label: metadata.label ?? null,
    metadata,
    created_at: now(),
  };

  if (hasSupabaseConfig && user?.id && !shouldSkipRemoteTable("job_activity_logs")) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.from("job_activity_logs").insert(payload).select("*").single();
    if (error) {
      if (isMissingTableError(error) || isMissingColumnError(error)) {
        rememberMissingRemoteTable("job_activity_logs", error);
        return null;
      }
      throw error;
    }
    return data;
  }

  const saved = { ...payload, id: crypto.randomUUID() };
  writeLocal(keys.jobActivityLogs, [saved, ...readLocal(keys.jobActivityLogs, seedJobActivityLogs)]);
  return saved;
}

export async function fetchWorkspace(user) {
  if (hasSupabaseConfig && user?.id) {
    clearLegacyGlobalProfileStorage();
    const supabase = await getSupabaseClient();
    let [profileResult, jobsResult, logsResult, resumesResult] = await Promise.all([
      // The profiles table uses the auth user UUID as its primary key.
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("jobs").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
      supabase.from("activity_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
      shouldSkipRemoteTable("resume_versions") ? { data: [], error: null } : supabase.from("resume_versions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (jobsResult.error && isMissingColumnError(jobsResult.error)) {
      jobsResult = await supabase.from("jobs").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    }
    if (jobsResult.error && isMissingColumnError(jobsResult.error)) {
      jobsResult = await supabase.from("jobs").select("*").eq("user_id", user.id);
    }
    if (resumesResult.error && isMissingColumnError(resumesResult.error)) {
      resumesResult = await supabase.from("resume_versions").select("*").eq("user_id", user.id);
    }

    if (profileResult.error) throw profileResult.error;
    if (jobsResult.error) throw jobsResult.error;
    if (logsResult.error) throw logsResult.error;
    if (resumesResult.error && !isOptionalRemoteTableError(resumesResult.error)) throw resumesResult.error;

    let [scoresResult, messagesResult] = await Promise.all([
      shouldSkipRemoteTable("job_scores") ? { data: [], error: null } : supabase.from("job_scores").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("messages").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (scoresResult.error && isMissingColumnError(scoresResult.error)) {
      scoresResult = await supabase.from("job_scores").select("*").eq("user_id", user.id);
    }
    if (messagesResult.error && isMissingColumnError(messagesResult.error)) {
      messagesResult = await supabase.from("messages").select("*").eq("user_id", user.id);
    }
    const uploadsResult = shouldSkipRemoteTable("resume_uploads")
      ? { data: [], error: null }
      : await supabase.from("resume_uploads").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    let [jobActivityResult, jobContactsResult, interviewPrepResult] = await Promise.all([
      shouldSkipRemoteTable("job_activity_logs") ? { data: [], error: null } : supabase.from("job_activity_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      shouldSkipRemoteTable("job_contacts") ? { data: [], error: null } : supabase.from("job_contacts").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
      shouldSkipRemoteTable("interview_prep") ? { data: [], error: null } : supabase.from("interview_prep").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    ]);
    if (jobActivityResult.error && isMissingColumnError(jobActivityResult.error)) {
      jobActivityResult = await supabase.from("job_activity_logs").select("*").eq("user_id", user.id);
    }
    if (jobContactsResult.error && isMissingColumnError(jobContactsResult.error)) {
      jobContactsResult = await supabase.from("job_contacts").select("*").eq("user_id", user.id);
    }
    if (interviewPrepResult.error && isMissingColumnError(interviewPrepResult.error)) {
      interviewPrepResult = await supabase.from("interview_prep").select("*").eq("user_id", user.id);
    }

    [uploadsResult, jobActivityResult, jobContactsResult, interviewPrepResult].forEach((result, index) => {
      const table = ["resume_uploads", "job_activity_logs", "job_contacts", "interview_prep"][index];
      if (isOptionalRemoteTableError(result.error)) rememberMissingRemoteTable(table, result.error);
    });
    [
      [scoresResult, "job_scores"],
      [resumesResult, "resume_versions"],
    ].forEach(([result, table]) => {
      if (isOptionalRemoteTableError(result.error)) rememberMissingRemoteTable(table, result.error);
    });

    const jobScores = isOptionalRemoteTableError(scoresResult.error) ? [] : scoresResult.data ?? [];
    const messages = isOptionalRemoteTableError(messagesResult.error) ? [] : messagesResult.data ?? [];
    const resumeVersions = isOptionalRemoteTableError(resumesResult.error) ? [] : normalizeResumeVersions(resumesResult.data ?? []);
    const resumeUploads = isOptionalRemoteTableError(uploadsResult.error) ? [] : uploadsResult.data ?? [];
    const jobActivityLogs = isOptionalRemoteTableError(jobActivityResult.error) ? [] : jobActivityResult.data ?? [];
    const jobContacts = isOptionalRemoteTableError(jobContactsResult.error) ? readLocal(keys.jobContacts, []) : jobContactsResult.data ?? [];
    const interviewPrep = isOptionalRemoteTableError(interviewPrepResult.error) ? [] : (interviewPrepResult.data ?? []).map(normalizeInterviewPrepRecord).filter(hasValidInterviewPrep);
    if (scoresResult.error && !isOptionalRemoteTableError(scoresResult.error)) throw scoresResult.error;
    if (messagesResult.error && !isOptionalRemoteTableError(messagesResult.error)) throw messagesResult.error;
    if (uploadsResult.error && !isOptionalRemoteTableError(uploadsResult.error)) throw uploadsResult.error;
    if (jobActivityResult.error && !isOptionalRemoteTableError(jobActivityResult.error)) throw jobActivityResult.error;
    if (jobContactsResult.error && !isOptionalRemoteTableError(jobContactsResult.error)) throw jobContactsResult.error;
    if (interviewPrepResult.error && !isOptionalRemoteTableError(interviewPrepResult.error)) throw interviewPrepResult.error;

    let profile = profileResult.data?.id === user.id ? profileResult.data : null;
    if (!profile) {
      profile = createEmptyProfile(user);
      profile = await insertProfileWithFallback(user, profile);
    }
    profile = applyProfileOptionalOverrides(user, profile);

    return {
      profile,
      jobs: applyJobAiUsageOverrides(applyJobCoverLetterOverrides(applyJobArchiveOverrides(applyJobCalendarOverrides(applyJobFollowUpOverrides(jobsResult.data ?? []))))),
      activityLogs: logsResult.data ?? [],
      jobActivityLogs,
      jobContacts,
      interviewPrep,
      resumeVersions,
      jobScores,
      messages,
      resumeUploads,
    };
  }

  return {
    profile: readLocal(keys.profile, seedProfile),
    jobs: readLocal(keys.jobs, seedJobs),
    activityLogs: readLocal(keys.activityLogs, seedActivityLogs),
    jobActivityLogs: readLocal(keys.jobActivityLogs, seedJobActivityLogs),
    jobContacts: readLocal(keys.jobContacts, []),
    interviewPrep: readLocal(keys.interviewPrep, []).map(normalizeInterviewPrepRecord).filter(hasValidInterviewPrep),
    resumeVersions: normalizeResumeVersions(readLocal(keys.resumeVersions, seedResumeVersions)),
    jobScores: readLocal(keys.jobScores, seedJobScores),
    messages: readLocal(keys.messages, seedMessages),
    resumeUploads: readLocal(keys.resumeUploads, []),
  };
}

function isMissingTableError(error) {
  return error?.code === "PGRST205" || error?.code === "42P01" || error?.message?.includes("schema cache") || /does not exist/i.test(error?.message || "");
}

function isMissingColumnError(error) {
  return error?.code === "PGRST204" || error?.message?.includes("Could not find") || error?.message?.includes("schema cache");
}

function isOptionalRemoteTableError(error) {
  return isMissingTableError(error) || isMissingColumnError(error);
}

function shouldSkipRemoteTable(table) {
  return missingRemoteTables.has(table);
}

function rememberMissingRemoteTable(table, error) {
  if (!table || !(isMissingTableError(error) || isMissingColumnError(error))) return;
  missingRemoteTables.add(table);
}

function normalizeResumeVersions(items = []) {
  return items
    .map((item) => ({
      ...item,
      content: item.content || item.resume_text || item.generated_content || "",
    }))
    .filter((item) => item.id && item.job_id && String(item.content || "").trim());
}

export async function saveProfile(user, profile) {
  if (hasSupabaseConfig && user?.id) {
    clearLegacyGlobalProfileStorage();
    const supabase = await getSupabaseClient();
    const payload = {
      ...createEmptyProfile(user),
      ...profile,
      id: user.id,
      email: profile.email || user.email,
      updated_at: now(),
    };
    const { data, error } = await supabase.from("profiles").upsert(payload).select("*").single();
    if (error) {
      if (!isMissingColumnError(error)) throw error;
      rememberProfileOptionalOverrides(user, payload);
      const legacyPayload = getLegacyProfilePayload(payload);
      const retry = await supabase.from("profiles").upsert(legacyPayload).select("*").single();
      if (retry.error) throw retry.error;
      await logActivity(user, "Profile", "Updated profile and base resume details");
      return applyProfileOptionalOverrides(user, { ...retry.data, updated_at: payload.updated_at });
    }
    clearProfileOptionalOverrides(user);
    await logActivity(user, "Profile", "Updated profile and base resume details");
    return data;
  }
  const saved = writeLocal(keys.profile, { ...profile, id: "local-demo-user", updated_at: now() });
  await logActivity(user, "Profile", "Updated profile and base resume details");
  return saved;
}

async function insertProfileWithFallback(user, profile) {
  const supabase = await getSupabaseClient();
  const payload = { ...profile, id: user.id, email: profile.email || user.email };
  const { data, error } = await supabase.from("profiles").insert(payload).select("*").single();
  if (!error) return data;

  const legacyPayload = getLegacyProfilePayload(payload);
  const retry = await supabase.from("profiles").upsert(legacyPayload).select("*").single();
  if (retry.error) {
    const existing = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (existing.error || !existing.data) throw retry.error;
    return { ...profile, ...existing.data };
  }
  return { ...profile, ...retry.data };
}

function getLegacyProfilePayload(profile) {
  return {
    id: profile.id,
    full_name: profile.full_name ?? "",
    email: profile.email,
    target_roles: profile.target_roles ?? "",
    base_resume_text: profile.base_resume_text ?? "",
    created_at: profile.created_at,
  };
}

function rememberProfileOptionalOverrides(user, profile = {}) {
  if (!user?.id) return;
  writeLocal(getUserScopedKey(keys.profileOptionalOverrides, user.id), {
    location: profile.location ?? "",
    phone: profile.phone ?? "",
    linkedin_url: profile.linkedin_url ?? "",
    portfolio_url: profile.portfolio_url ?? "",
  });
}

function applyProfileOptionalOverrides(user, profile = {}) {
  if (!user?.id || profile.id !== user.id) return createEmptyProfile(user);
  const overrides = readLocal(getUserScopedKey(keys.profileOptionalOverrides, user.id), {});
  return {
    ...profile,
    location: profile.location || overrides.location || "",
    phone: profile.phone || overrides.phone || "",
    linkedin_url: profile.linkedin_url || overrides.linkedin_url || "",
    portfolio_url: profile.portfolio_url || overrides.portfolio_url || "",
  };
}

function clearProfileOptionalOverrides(user) {
  if (!user?.id) return;
  try {
    window.localStorage.removeItem(getUserScopedKey(keys.profileOptionalOverrides, user.id));
  } catch {
    // Supabase contains the optional fields, so the fallback can be discarded.
  }
}

function getUserScopedKey(baseKey, userId) {
  return `${baseKey}:${userId}`;
}

function clearLegacyGlobalProfileStorage() {
  try {
    legacyGlobalProfileKeys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Stale browser data cleanup is best-effort.
  }
}

export async function createJob(user, job) {
  const payload = normalizeJob(user, job);
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.from("jobs").insert(payload).select("*").single();
    if (error) {
      if (!isMissingColumnError(error)) throw error;
      const legacyPayload = getLegacyJobPayload(payload);
      const retry = await supabase.from("jobs").insert(legacyPayload).select("*").single();
      if (retry.error) throw retry.error;
      const enriched = { ...retry.data, company_domain: payload.company_domain, company_logo_url: payload.company_logo_url };
      await logActivity(user, "Job", `Saved ${getDisplayJobTitle(enriched)} at ${getDisplayCompanyName(enriched)}`);
      await logJobActivity(user, enriched.id, "job_created", { title: getDisplayJobTitle(enriched), company: getDisplayCompanyName(enriched) });
      return enriched;
    }
    await logActivity(user, "Job", `Saved ${getDisplayJobTitle(data)} at ${getDisplayCompanyName(data)}`);
    await logJobActivity(user, data.id, "job_created", { title: getDisplayJobTitle(data), company: getDisplayCompanyName(data) });
    return data;
  }
  const saved = { ...payload, id: crypto.randomUUID() };
  writeLocal(keys.jobs, [saved, ...readLocal(keys.jobs, seedJobs)]);
  await logActivity(user, "Job", `Saved ${getDisplayJobTitle(saved)} at ${getDisplayCompanyName(saved)}`);
  await logJobActivity(user, saved.id, "job_created", { title: getDisplayJobTitle(saved), company: getDisplayCompanyName(saved) });
  return saved;
}

export async function updateJob(user, id, patch) {
  const payload = cleanJobPayload({ ...patch, updated_at: now() });
  const previous = await getExistingJob(user, id);
  if (payload.status === "Applied" && !payload.applied_date) {
    payload.applied_date = new Date().toISOString().slice(0, 10);
  }
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.from("jobs").update(payload).eq("id", id).eq("user_id", user.id).select("*").single();
    if (error) {
      if (!isMissingColumnError(error)) throw error;
      const legacyPayload = getLegacyJobPayload(payload);
      const retry = await supabase.from("jobs").update(legacyPayload).eq("id", id).eq("user_id", user.id).select("*").single();
      if (retry.error) throw retry.error;
      const enriched = { ...retry.data, ...Object.fromEntries(Object.entries(payload).filter(([key]) => key.startsWith("followup_") || key.startsWith("company_") || key.startsWith("interview_") || key.startsWith("archived_") || key.startsWith("cover_letter_") || key === "ai_usage_counted_at" || key === "interviewer_contact_id" || key === "calendar_event_added_at")) };
      if (hasFollowUpPatch(payload)) rememberJobFollowUpOverride(id, payload);
      if (hasCalendarPatch(payload)) rememberJobCalendarOverride(id, payload);
      if (hasArchivePatch(payload)) rememberJobArchiveOverride(id, payload);
      if (hasCoverLetterPatch(payload)) rememberJobCoverLetterOverride(id, payload);
      if (hasAiUsagePatch(payload)) rememberJobAiUsageOverride(id, payload);
      await logActivity(user, "Job", `Updated ${getDisplayJobTitle(enriched)} at ${getDisplayCompanyName(enriched)}`);
      await logJobUpdateActivity(user, previous, enriched, payload);
      return enriched;
    }
    if (hasFollowUpPatch(payload)) clearJobFollowUpOverride(id);
    if (hasCalendarPatch(payload)) clearJobCalendarOverride(id);
    if (hasArchivePatch(payload)) clearJobArchiveOverride(id);
    if (hasCoverLetterPatch(payload)) clearJobCoverLetterOverride(id);
    if (hasAiUsagePatch(payload)) clearJobAiUsageOverride(id);
    await logActivity(user, "Job", `Updated ${getDisplayJobTitle(data)} at ${getDisplayCompanyName(data)}`);
    await logJobUpdateActivity(user, previous, data, payload);
    return data;
  }
  const jobs = readLocal(keys.jobs, seedJobs);
  const next = jobs.map((job) => (job.id === id ? { ...job, ...payload } : job));
  writeLocal(keys.jobs, next);
  const saved = next.find((job) => job.id === id);
  await logActivity(user, "Job", `Updated ${getDisplayJobTitle(saved)} at ${getDisplayCompanyName(saved)}`);
  await logJobUpdateActivity(user, previous, saved, payload);
  return saved;
}

export async function deleteJob(user, id) {
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from("jobs").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    await logActivity(user, "Job", "Deleted a saved job");
    return id;
  }
  writeLocal(keys.jobs, readLocal(keys.jobs, seedJobs).filter((job) => job.id !== id));
  writeLocal(keys.jobScores, readLocal(keys.jobScores, seedJobScores).filter((item) => item.job_id !== id));
  writeLocal(keys.resumeVersions, readLocal(keys.resumeVersions, seedResumeVersions).filter((item) => item.job_id !== id));
  writeLocal(keys.messages, readLocal(keys.messages, seedMessages).filter((item) => item.job_id !== id));
  writeLocal(keys.jobActivityLogs, readLocal(keys.jobActivityLogs, seedJobActivityLogs).filter((item) => item.job_id !== id));
  writeLocal(keys.jobContacts, readLocal(keys.jobContacts, []).filter((item) => item.job_id !== id));
  writeLocal(keys.interviewPrep, readLocal(keys.interviewPrep, []).filter((item) => item.job_id !== id));
  clearLocalJobOverrides(id);
  await logActivity(user, "Job", "Deleted a saved job");
  return id;
}

function clearLocalJobOverrides(jobId) {
  [
    keys.jobFollowUpOverrides,
    keys.jobCalendarOverrides,
    keys.jobArchiveOverrides,
    keys.jobCoverLetterOverrides,
    keys.jobAiUsageOverrides,
  ].forEach((key) => {
    const values = readLocal(key, {});
    if (!values || typeof values !== "object" || Array.isArray(values) || !(jobId in values)) return;
    const next = { ...values };
    delete next[jobId];
    writeLocal(key, next);
  });
}

export async function saveJobScore(user, job, score) {
  const payload = {
    user_id: user?.id ?? "local-demo-user",
    job_id: job.id,
    score: score.score,
    strengths: score.strengths ?? [],
    gaps: score.gaps ?? [],
    gap_assessments: score.gapAssessments ?? score.gap_assessments ?? [],
    mitigation_suggestions: score.mitigationSuggestions ?? score.mitigation_suggestions ?? [],
    keywords: score.keywords ?? [],
    transferable_strengths: score.transferableStrengths ?? score.transferable_strengths ?? [],
    better_aligned_roles: score.betterAlignedRoles ?? score.better_aligned_roles ?? [],
    recommendation: score.recommendation,
    summary: score.summary,
    tailoring_intensity: score.tailoringIntensity ?? score.tailoring_intensity ?? null,
    created_at: now(),
  };
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.from("job_scores").insert(payload).select("*").single();
    if (error) {
      if (!isMissingColumnError(error)) throw error;
      const legacyPayload = { ...payload };
      delete legacyPayload.transferable_strengths;
      delete legacyPayload.better_aligned_roles;
      delete legacyPayload.tailoring_intensity;
      delete legacyPayload.gap_assessments;
      delete legacyPayload.mitigation_suggestions;
      const retry = await supabase.from("job_scores").insert(legacyPayload).select("*").single();
      if (retry.error) throw retry.error;
    await logActivity(user, "AI", `Analyzed fit for ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
    await logJobActivity(user, job.id, "analysis_generated", { score: payload.score, recommendation: payload.recommendation });
    return {
        ...retry.data,
        transferable_strengths: payload.transferable_strengths,
        better_aligned_roles: payload.better_aligned_roles,
        tailoring_intensity: payload.tailoring_intensity,
        gap_assessments: payload.gap_assessments,
        mitigation_suggestions: payload.mitigation_suggestions,
      };
    }
    await logActivity(user, "AI", `Analyzed fit for ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
    await logJobActivity(user, job.id, "analysis_generated", { score: payload.score, recommendation: payload.recommendation });
    return data;
  }
  const saved = { ...payload, id: crypto.randomUUID() };
  writeLocal(keys.jobScores, [saved, ...readLocal(keys.jobScores, seedJobScores)]);
  await logActivity(user, "AI", `Analyzed fit for ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
  await logJobActivity(user, job.id, "analysis_generated", { score: payload.score, recommendation: payload.recommendation });
  return saved;
}

export async function saveResumeVersion(user, job, draft, metadata = {}) {
  const payload = {
    user_id: user?.id ?? "local-demo-user",
    job_id: job.id,
    title: getTailoredResumeTitle(job),
    content: `${draft.content}\n\nWhy this fits:\n${draft.whyThisFits ?? ""}`.trim(),
    tailoring_intensity: metadata.tailoringIntensity ?? null,
    recommendation: metadata.recommendation ?? null,
    applied_mitigations: metadata.appliedMitigations ?? metadata.applied_mitigations ?? [],
    created_at: now(),
  };
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.from("resume_versions").insert(payload).select("*").single();
    if (error) {
      if (!isMissingColumnError(error)) throw error;
      const legacyPayload = { ...payload };
      delete legacyPayload.tailoring_intensity;
      delete legacyPayload.recommendation;
      delete legacyPayload.applied_mitigations;
      const retry = await supabase.from("resume_versions").insert(legacyPayload).select("*").single();
      if (retry.error) throw retry.error;
      await logActivity(user, "AI", `Generated tailored resume for ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
      await logJobActivity(user, job.id, "resume_generated", { title: payload.title, resumeId: retry.data.id });
      return {
        ...retry.data,
        tailoring_intensity: payload.tailoring_intensity,
        recommendation: payload.recommendation,
        applied_mitigations: payload.applied_mitigations,
      };
    }
    await logActivity(user, "AI", `Generated tailored resume for ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
    await logJobActivity(user, job.id, "resume_generated", { title: payload.title, resumeId: data.id });
    return data;
  }
  const saved = { ...payload, id: crypto.randomUUID() };
  writeLocal(keys.resumeVersions, [saved, ...readLocal(keys.resumeVersions, seedResumeVersions)]);
  await logActivity(user, "AI", `Generated tailored resume for ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
  await logJobActivity(user, job.id, "resume_generated", { title: payload.title, resumeId: saved.id });
  return saved;
}

export async function updateResumeVersion(user, id, patch) {
  const payload = { ...patch, updated_at: now() };
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.from("resume_versions").update(payload).eq("id", id).eq("user_id", user.id).select("*").single();
    if (error) throw error;
    await logActivity(user, "Resume", `Edited ${data.title}`);
    return data;
  }
  const versions = readLocal(keys.resumeVersions, seedResumeVersions);
  const next = versions.map((version) => (version.id === id ? { ...version, ...payload } : version));
  writeLocal(keys.resumeVersions, next);
  const saved = next.find((version) => version.id === id);
  await logActivity(user, "Resume", `Edited ${saved.title}`);
  return saved;
}

export async function saveMessage(user, job, message) {
  const messageType = message.type === "LinkedIn intro" ? "Recruiter Message" : message.type ?? "Recruiter Message";
  const payload = {
    user_id: user?.id ?? "local-demo-user",
    job_id: job.id,
    contact_id: message.contact_id ?? message.contactId ?? null,
    type: messageType,
    content: message.content ?? message.coverLetterText,
    applied_mitigations: message.appliedMitigations ?? message.applied_mitigations ?? [],
    tone_mode: message.toneMode ?? message.tone_mode ?? null,
    tone_notes: message.toneNotes ?? message.tone_notes ?? null,
    created_at: now(),
  };
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.from("messages").insert(payload).select("*").single();
    if (error) {
      if (!isMissingColumnError(error)) throw error;
      const legacyPayload = { ...payload };
      delete legacyPayload.contact_id;
      delete legacyPayload.applied_mitigations;
      delete legacyPayload.tone_mode;
      delete legacyPayload.tone_notes;
      const retry = await supabase.from("messages").insert(legacyPayload).select("*").single();
      if (retry.error) throw retry.error;
      await logActivity(user, "AI", getMessageActivityDescription(payload.type, job));
      await logJobActivity(user, job.id, getMessageActivityType(payload.type), { type: payload.type, contactId: payload.contact_id, contactName: message.contactName });
      return {
        ...retry.data,
        contact_id: payload.contact_id,
        applied_mitigations: payload.applied_mitigations,
        tone_mode: payload.tone_mode,
        tone_notes: payload.tone_notes,
      };
    }
    await logActivity(user, "AI", getMessageActivityDescription(payload.type, job));
    await logJobActivity(user, job.id, getMessageActivityType(payload.type), { type: payload.type, contactId: payload.contact_id, contactName: message.contactName });
    return data;
  }
  const saved = { ...payload, id: crypto.randomUUID() };
  writeLocal(keys.messages, [saved, ...readLocal(keys.messages, seedMessages)]);
  await logActivity(user, "AI", getMessageActivityDescription(payload.type, job));
  await logJobActivity(user, job.id, getMessageActivityType(payload.type), { type: payload.type, contactId: payload.contact_id, contactName: message.contactName });
  return saved;
}

function getMessageActivityType(type) {
  if (type === "Follow-up Message") return "followup_message_generated";
  if (type === "Cover Letter") return "cover_letter_generated";
  return "message_generated";
}

function getMessageActivityDescription(type, job) {
  if (type === "Follow-up Message") return `Generated follow-up message for ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`;
  if (type === "Cover Letter") return `Generated cover letter for ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`;
  return `Generated recruiter message for ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`;
}

export async function updateMessage(user, message, patch = {}) {
  if (!message?.id) return null;
  const payload = {
    ...patch,
    content: patch.content ?? message.content,
  };
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.from("messages").update(payload).eq("id", message.id).eq("user_id", user.id).select("*").single();
    if (error) {
      if (!isMissingColumnError(error)) throw error;
      const legacyPayload = { content: payload.content };
      const retry = await supabase.from("messages").update(legacyPayload).eq("id", message.id).eq("user_id", user.id).select("*").single();
      if (retry.error) throw retry.error;
      return { ...message, ...retry.data, ...legacyPayload };
    }
    return data;
  }
  const items = readLocal(keys.messages, seedMessages);
  const saved = { ...message, ...payload, updated_at: now() };
  writeLocal(keys.messages, [saved, ...items.filter((item) => item.id !== message.id)]);
  return saved;
}

export async function saveJobContact(user, job, contact, options = {}) {
  const payload = normalizeContactPayload(user, job, contact);
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const query = payload.id
      ? supabase.from("job_contacts").update({ ...payload, updated_at: now() }).eq("id", payload.id).eq("user_id", user.id)
      : supabase.from("job_contacts").insert(payload);
    const { data, error } = await query.select("*").single();
    if (error) {
      if (isMissingTableError(error) || isMissingColumnError(error)) return saveLocalJobContact(user, job, contact);
      throw error;
    }
    if (!options.skipActivity) await logJobActivity(user, job.id, payload.id ? "contact_edited" : "contact_added", { contactName: data.name, company: data.company });
    return data;
  }
  return saveLocalJobContact(user, job, contact, options);
}

export async function deleteJobContact(user, contact) {
  if (!contact?.id) return null;
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from("job_contacts").delete().eq("id", contact.id).eq("user_id", user.id);
    if (error) {
      if (isMissingTableError(error)) {
        writeLocal(keys.jobContacts, readLocal(keys.jobContacts, []).filter((item) => item.id !== contact.id));
        await logJobActivity(user, contact.job_id, "contact_deleted", { contactName: contact.name, company: contact.company });
        return contact.id;
      }
      throw error;
    }
    await logJobActivity(user, contact.job_id, "contact_deleted", { contactName: contact.name, company: contact.company });
    return contact.id;
  }
  writeLocal(keys.jobContacts, readLocal(keys.jobContacts, []).filter((item) => item.id !== contact.id));
  await logJobActivity(user, contact.job_id, "contact_deleted", { contactName: contact.name, company: contact.company });
  return contact.id;
}

export async function markJobContacted(user, contact) {
  const saved = await saveJobContact(user, { id: contact.job_id, company_name: contact.company }, { ...contact, last_contacted_at: now() }, { skipActivity: true });
  await logJobActivity(user, contact.job_id, "contact_contacted", { contactName: contact.name, company: contact.company });
  return saved;
}

export async function saveInterviewPrep(user, job, prep) {
  const content = normalizeInterviewPrepContent(prep.content ?? prep);
  const payload = {
    id: prep.id,
    user_id: user?.id ?? "local-demo-user",
    job_id: job.id,
    content,
    practiced_questions: prep.practiced_questions ?? [],
    answer_notes: prep.answer_notes ?? {},
    created_at: prep.created_at || now(),
    updated_at: now(),
  };
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const query = payload.id
      ? supabase.from("interview_prep").update(payload).eq("id", payload.id).eq("user_id", user.id)
      : supabase.from("interview_prep").insert(payload);
    const { data, error } = await query.select("*").single();
    if (error) {
      if (isMissingTableError(error) || isMissingColumnError(error)) {
        throw new Error("Interview Prep could not be saved because the interview_prep table is not available in Supabase. Apply supabase/interview_prep_migration.sql and try again.");
      }
      throw error;
    }
    if (!prep.skipActivity) await logJobActivity(user, job.id, "interview_prep_generated", { title: getDisplayJobTitle(job), company: getDisplayCompanyName(job) });
    return normalizeInterviewPrepRecord(data);
  }
  return saveLocalInterviewPrep(user, job, prep);
}

export async function saveResumeUpload(user, file, extractedText) {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${user?.id ?? "local-demo-user"}/originals/${timestamp}-${safeName}`;
  const payload = {
    user_id: user?.id ?? "local-demo-user",
    file_name: file.name,
    file_type: file.type || file.name.split(".").pop() || "unknown",
    file_size: file.size,
    storage_path: storagePath,
    extracted_text: extractedText,
    created_at: now(),
  };

  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const upload = await supabase.storage.from("resumes").upload(storagePath, file, { upsert: false });
    const storageUnavailable = Boolean(upload.error);
    const finalPayload = storageUnavailable ? { ...payload, storage_path: null } : payload;
    const { data, error } = await supabase.from("resume_uploads").insert(finalPayload).select("*").single();
    if (error) {
      if (!isMissingTableError(error)) throw error;
      return saveLocalResumeUpload(user, { ...finalPayload, storage_note: "Original file was not stored because the resume upload table is not available yet." });
    }
    await logActivity(user, "Resume", `Imported resume from ${file.name}`);
    return {
      ...data,
      storage_note: storageUnavailable ? "Original file was not stored because Supabase Storage is unavailable or the resumes bucket is missing." : "",
    };
  }

  return saveLocalResumeUpload(user, { ...payload, storage_path: null, storage_note: "Original file was not stored in local demo mode." });
}

function saveLocalResumeUpload(user, upload) {
  const saved = { ...upload, id: crypto.randomUUID(), user_id: user?.id ?? "local-demo-user" };
  writeLocal(keys.resumeUploads, [saved, ...readLocal(keys.resumeUploads, [])]);
  return saved;
}

async function saveLocalJobContact(user, job, contact, options = {}) {
  const payload = normalizeContactPayload(user, job, contact);
  const contacts = readLocal(keys.jobContacts, []);
  const saved = payload.id
    ? { ...contacts.find((item) => item.id === payload.id), ...payload, updated_at: now() }
    : { ...payload, id: crypto.randomUUID() };
  writeLocal(keys.jobContacts, [saved, ...contacts.filter((item) => item.id !== saved.id)]);
  if (!options.skipActivity) await logJobActivity(user, saved.job_id, payload.id ? "contact_edited" : "contact_added", { contactName: saved.name, company: saved.company });
  return saved;
}

async function saveLocalInterviewPrep(user, job, prep) {
  const items = readLocal(keys.interviewPrep, []);
  const content = normalizeInterviewPrepContent(prep.content ?? prep);
  const saved = {
    id: prep.id || crypto.randomUUID(),
    user_id: user?.id ?? "local-demo-user",
    job_id: job.id,
    content,
    practiced_questions: prep.practiced_questions ?? [],
    answer_notes: prep.answer_notes ?? {},
    created_at: prep.created_at || now(),
    updated_at: now(),
  };
  writeLocal(keys.interviewPrep, [saved, ...items.filter((item) => item.id !== saved.id && item.job_id !== job.id)]);
  if (!prep.skipActivity) await logJobActivity(user, job.id, "interview_prep_generated", { title: getDisplayJobTitle(job), company: getDisplayCompanyName(job) });
  return normalizeInterviewPrepRecord(saved);
}

function normalizeContactPayload(user, job, contact = {}) {
  const timestamp = now();
  return {
    ...(contact.id ? { id: contact.id } : {}),
    user_id: user?.id ?? "local-demo-user",
    job_id: contact.job_id || job?.id,
    name: String(contact.name || "").trim(),
    title: String(contact.title || "").trim(),
    company: String(contact.company || job?.company_name || "").trim(),
    email: String(contact.email || "").trim(),
    phone: String(contact.phone || "").trim(),
    linkedin_url: String(contact.linkedin_url || contact.linkedinUrl || "").trim(),
    source: contact.source || "recruiter",
    last_contacted_at: contact.last_contacted_at || contact.lastContactedAt || null,
    next_follow_up_date: contact.next_follow_up_date || contact.nextFollowUpDate || null,
    notes: String(contact.notes || "").trim(),
    created_at: contact.created_at || timestamp,
    updated_at: timestamp,
  };
}

async function getExistingJob(user, id) {
  if (hasSupabaseConfig && user?.id) {
    try {
      const supabase = await getSupabaseClient();
      const { data } = await supabase.from("jobs").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
      return data ?? null;
    } catch {
      return null;
    }
  }
  return readLocal(keys.jobs, seedJobs).find((job) => job.id === id) ?? null;
}

async function logJobUpdateActivity(user, previous, next, payload) {
  if (!next?.id) return;
  if ("status" in payload && previous?.status !== next.status) {
    await logJobActivity(user, next.id, "stage_changed", { from: previous?.status || "Saved", to: next.status });
    if (next.status === "Applied") await logJobActivity(user, next.id, "application_marked", { stage: "Applied" });
    if (next.status === "Interview") await logJobActivity(user, next.id, "application_marked", { stage: "Interview" });
    if (next.status === "Closed") await logJobActivity(user, next.id, "application_marked", { stage: "Closed" });
    return;
  }
  if ("followup_completed_at" in payload && payload.followup_completed_at) {
    await logJobActivity(user, next.id, "followup_completed", { completedAt: payload.followup_completed_at });
    return;
  }
  if ("followup_snoozed_until" in payload && payload.followup_snoozed_until) {
    await logJobActivity(user, next.id, "followup_snoozed", { until: payload.followup_snoozed_until });
    return;
  }
  if ("followup_date" in payload || "followup_note" in payload) {
    await logJobActivity(user, next.id, "followup_saved", { date: next.followup_date, note: next.followup_note });
    return;
  }
  if ("interview_date" in payload || "interview_time" in payload || "interview_location" in payload || "interview_type" in payload || "interviewer_contact_id" in payload) {
    await logJobActivity(user, next.id, "interview_details_saved", { date: next.interview_date, time: next.interview_time, type: next.interview_type });
    return;
  }
  if ("archived_at" in payload) {
    await logJobActivity(user, next.id, payload.archived_at ? "job_archived" : "job_restored", { reason: next.archived_reason || "", archivedAt: next.archived_at });
    return;
  }
  if ("cover_letter_status" in payload) {
    await logJobActivity(user, next.id, payload.cover_letter_status === "skipped" ? "cover_letter_skipped" : "cover_letter_status_updated", {
      detail: payload.cover_letter_status === "skipped" ? "Cover letter skipped." : "Cover letter status updated.",
      status: next.cover_letter_status || "",
    });
    return;
  }
  await logJobActivity(user, next.id, "job_edited", { title: getDisplayJobTitle(next), company: getDisplayCompanyName(next) });
}

function normalizeJob(user, job) {
  const createdAt = now();
  const companyDomain = deriveCompanyDomain(job);
  return cleanJobPayload({
    user_id: user?.id ?? "local-demo-user",
    company_name: getDisplayCompanyName(job),
    job_title: getDisplayJobTitle(job),
    company_domain: companyDomain,
    company_logo_url: companyDomain ? `https://logo.clearbit.com/${companyDomain}` : "",
    location: job.location,
    remote_type: job.remote_type,
    salary_range: job.salary_range,
    source_url: job.source_url,
    application_url: job.application_url || null,
    job_description: job.job_description,
    priority: job.priority,
    status: job.status,
    date_saved: job.date_saved || new Date().toISOString().slice(0, 10),
    applied_date: job.applied_date || null,
    followup_date: job.followup_date || null,
    followup_status: job.followup_status || "none",
    followup_completed_at: job.followup_completed_at || null,
    followup_snoozed_until: job.followup_snoozed_until || null,
    followup_note: job.followup_note || "",
    interview_date: job.interview_date || null,
    interview_time: job.interview_time || "09:00",
    interview_duration: job.interview_duration || 30,
    interview_location: job.interview_location || "",
    interview_type: job.interview_type || "Video",
    interviewer_contact_id: job.interviewer_contact_id || null,
    calendar_event_added_at: job.calendar_event_added_at || null,
    followup_calendar_added_at: job.followup_calendar_added_at || null,
    archived_at: job.archived_at || null,
    archived_reason: job.archived_reason || "",
    archived_by_user: Boolean(job.archived_by_user),
    cover_letter_status: job.cover_letter_status || null,
    cover_letter_skipped_at: job.cover_letter_skipped_at || null,
    ai_usage_counted_at: job.ai_usage_counted_at || job.aiUsageCountedAt || null,
    notes: job.notes,
    created_at: createdAt,
    updated_at: createdAt,
  });
}

function cleanJobPayload(job) {
  const normalizedJob = normalizeFollowUpPayload(job);
  const allowed = [
    "user_id",
    "company_name",
    "job_title",
    "company_domain",
    "company_logo_url",
    "location",
    "remote_type",
    "salary_range",
    "source_url",
    "application_url",
    "job_description",
    "priority",
    "status",
    "date_saved",
    "applied_date",
    "followup_date",
    "followup_status",
    "followup_completed_at",
    "followup_snoozed_until",
    "followup_note",
    "interview_date",
    "interview_time",
    "interview_duration",
    "interview_location",
    "interview_type",
    "interviewer_contact_id",
    "calendar_event_added_at",
    "followup_calendar_added_at",
    "archived_at",
    "archived_reason",
    "archived_by_user",
    "cover_letter_status",
    "cover_letter_skipped_at",
    "ai_usage_counted_at",
    "notes",
    "created_at",
    "updated_at",
  ];
  const payload = Object.fromEntries(allowed.filter((key) => key in normalizedJob).map((key) => [key, normalizedJob[key]]));
  const cleaned = { ...payload };
  if ("applied_date" in payload) cleaned.applied_date = payload.applied_date || null;
  if ("followup_date" in payload) cleaned.followup_date = payload.followup_date || null;
  if ("followup_status" in payload) cleaned.followup_status = payload.followup_status || "none";
  if ("followup_completed_at" in payload) cleaned.followup_completed_at = payload.followup_completed_at || null;
  if ("followup_snoozed_until" in payload) cleaned.followup_snoozed_until = payload.followup_snoozed_until || null;
  if ("followup_note" in payload) cleaned.followup_note = payload.followup_note || "";
  if ("interview_date" in payload) cleaned.interview_date = payload.interview_date || null;
  if ("interview_time" in payload) cleaned.interview_time = payload.interview_time || "09:00";
  if ("interview_duration" in payload) cleaned.interview_duration = Number(payload.interview_duration || 30);
  if ("interview_location" in payload) cleaned.interview_location = payload.interview_location || "";
  if ("interview_type" in payload) cleaned.interview_type = payload.interview_type || "Video";
  if ("interviewer_contact_id" in payload) cleaned.interviewer_contact_id = payload.interviewer_contact_id || null;
  if ("calendar_event_added_at" in payload) cleaned.calendar_event_added_at = payload.calendar_event_added_at || null;
  if ("followup_calendar_added_at" in payload) cleaned.followup_calendar_added_at = payload.followup_calendar_added_at || null;
  if ("archived_at" in payload) cleaned.archived_at = payload.archived_at || null;
  if ("archived_reason" in payload) cleaned.archived_reason = payload.archived_reason || "";
  if ("archived_by_user" in payload) cleaned.archived_by_user = Boolean(payload.archived_by_user);
  if ("cover_letter_status" in payload) cleaned.cover_letter_status = payload.cover_letter_status || null;
  if ("cover_letter_skipped_at" in payload) cleaned.cover_letter_skipped_at = payload.cover_letter_skipped_at || null;
  if ("ai_usage_counted_at" in payload) cleaned.ai_usage_counted_at = payload.ai_usage_counted_at || null;
  if ("date_saved" in payload) cleaned.date_saved = payload.date_saved || new Date().toISOString().slice(0, 10);
  if ("company_name" in payload) cleaned.company_name = getDisplayCompanyName(payload);
  if ("job_title" in payload) cleaned.job_title = getDisplayJobTitle(payload);
  if ("status" in payload) cleaned.status = normalizeApplicationStage(payload.status);
  return cleaned;
}

function hasFollowUpPatch(payload = {}) {
  return Object.keys(payload).some((key) => key.startsWith("followup_"));
}

function hasCalendarPatch(payload = {}) {
  return Object.keys(payload).some((key) => key.startsWith("interview_") || key === "interviewer_contact_id" || key === "calendar_event_added_at" || key === "followup_calendar_added_at");
}

function hasArchivePatch(payload = {}) {
  return Object.keys(payload).some((key) => key.startsWith("archived_"));
}

function hasCoverLetterPatch(payload = {}) {
  return Object.keys(payload).some((key) => key.startsWith("cover_letter_"));
}

function hasAiUsagePatch(payload = {}) {
  return "ai_usage_counted_at" in payload;
}

function getFollowUpPatch(payload = {}) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => key.startsWith("followup_") || key === "updated_at"));
}

function getCalendarPatch(payload = {}) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => key.startsWith("interview_") || key === "interviewer_contact_id" || key === "calendar_event_added_at" || key === "followup_calendar_added_at" || key === "updated_at"));
}

function getArchivePatch(payload = {}) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => key.startsWith("archived_") || key === "updated_at"));
}

function getCoverLetterPatch(payload = {}) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => key.startsWith("cover_letter_") || key === "updated_at"));
}

function getAiUsagePatch(payload = {}) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => key === "ai_usage_counted_at" || key === "updated_at"));
}

function rememberJobFollowUpOverride(jobId, payload = {}) {
  const overrides = readLocal(keys.jobFollowUpOverrides, {});
  writeLocal(keys.jobFollowUpOverrides, {
    ...overrides,
    [jobId]: {
      ...(overrides[jobId] || {}),
      ...getFollowUpPatch(payload),
      updated_at: payload.updated_at || now(),
    },
  });
}

function clearJobFollowUpOverride(jobId) {
  const overrides = readLocal(keys.jobFollowUpOverrides, {});
  if (!overrides[jobId]) return;
  const next = { ...overrides };
  delete next[jobId];
  writeLocal(keys.jobFollowUpOverrides, next);
}

function rememberJobCalendarOverride(jobId, payload = {}) {
  const overrides = readLocal(keys.jobCalendarOverrides, {});
  writeLocal(keys.jobCalendarOverrides, {
    ...overrides,
    [jobId]: {
      ...(overrides[jobId] || {}),
      ...getCalendarPatch(payload),
      updated_at: payload.updated_at || now(),
    },
  });
}

function clearJobCalendarOverride(jobId) {
  const overrides = readLocal(keys.jobCalendarOverrides, {});
  if (!overrides[jobId]) return;
  const next = { ...overrides };
  delete next[jobId];
  writeLocal(keys.jobCalendarOverrides, next);
}

function rememberJobArchiveOverride(jobId, payload = {}) {
  const overrides = readLocal(keys.jobArchiveOverrides, {});
  writeLocal(keys.jobArchiveOverrides, {
    ...overrides,
    [jobId]: {
      ...(overrides[jobId] || {}),
      ...getArchivePatch(payload),
      updated_at: payload.updated_at || now(),
    },
  });
}

function clearJobArchiveOverride(jobId) {
  const overrides = readLocal(keys.jobArchiveOverrides, {});
  if (!overrides[jobId]) return;
  const next = { ...overrides };
  delete next[jobId];
  writeLocal(keys.jobArchiveOverrides, next);
}

function rememberJobCoverLetterOverride(jobId, payload = {}) {
  const overrides = readLocal(keys.jobCoverLetterOverrides, {});
  writeLocal(keys.jobCoverLetterOverrides, {
    ...overrides,
    [jobId]: {
      ...(overrides[jobId] || {}),
      ...getCoverLetterPatch(payload),
      updated_at: payload.updated_at || now(),
    },
  });
}

function clearJobCoverLetterOverride(jobId) {
  const overrides = readLocal(keys.jobCoverLetterOverrides, {});
  if (!overrides[jobId]) return;
  const next = { ...overrides };
  delete next[jobId];
  writeLocal(keys.jobCoverLetterOverrides, next);
}

function rememberJobAiUsageOverride(jobId, payload = {}) {
  const overrides = readLocal(keys.jobAiUsageOverrides, {});
  writeLocal(keys.jobAiUsageOverrides, {
    ...overrides,
    [jobId]: {
      ...(overrides[jobId] || {}),
      ...getAiUsagePatch(payload),
      updated_at: payload.updated_at || now(),
    },
  });
}

function clearJobAiUsageOverride(jobId) {
  const overrides = readLocal(keys.jobAiUsageOverrides, {});
  if (!overrides[jobId]) return;
  const next = { ...overrides };
  delete next[jobId];
  writeLocal(keys.jobAiUsageOverrides, next);
}

function applyJobFollowUpOverrides(jobs = []) {
  const overrides = readLocal(keys.jobFollowUpOverrides, {});
  if (!overrides || !Object.keys(overrides).length) return jobs;
  return jobs.map((job) => {
    const override = overrides[job.id];
    if (!override) return job;
    const jobUpdatedAt = new Date(job.updated_at || job.created_at || 0);
    const overrideUpdatedAt = new Date(override.updated_at || 0);
    if (jobUpdatedAt > overrideUpdatedAt && getServerHasFollowUpState(job, override)) {
      clearJobFollowUpOverride(job.id);
      return job;
    }
    return { ...job, ...override };
  });
}

function applyJobCalendarOverrides(jobs = []) {
  const overrides = readLocal(keys.jobCalendarOverrides, {});
  if (!overrides || !Object.keys(overrides).length) return jobs;
  return jobs.map((job) => {
    const override = overrides[job.id];
    if (!override) return job;
    const jobUpdatedAt = new Date(job.updated_at || job.created_at || 0);
    const overrideUpdatedAt = new Date(override.updated_at || 0);
    if (jobUpdatedAt > overrideUpdatedAt && getServerHasCalendarState(job, override)) {
      clearJobCalendarOverride(job.id);
      return job;
    }
    return { ...job, ...override };
  });
}

function applyJobArchiveOverrides(jobs = []) {
  const overrides = readLocal(keys.jobArchiveOverrides, {});
  if (!overrides || !Object.keys(overrides).length) return jobs;
  return jobs.map((job) => {
    const override = overrides[job.id];
    if (!override) return job;
    const jobUpdatedAt = new Date(job.updated_at || job.created_at || 0);
    const overrideUpdatedAt = new Date(override.updated_at || 0);
    if (jobUpdatedAt > overrideUpdatedAt && getServerHasArchiveState(job, override)) {
      clearJobArchiveOverride(job.id);
      return job;
    }
    return { ...job, ...override };
  });
}

function applyJobCoverLetterOverrides(jobs = []) {
  const overrides = readLocal(keys.jobCoverLetterOverrides, {});
  if (!overrides || !Object.keys(overrides).length) return jobs;
  return jobs.map((job) => {
    const override = overrides[job.id];
    if (!override) return job;
    const jobUpdatedAt = new Date(job.updated_at || job.created_at || 0);
    const overrideUpdatedAt = new Date(override.updated_at || 0);
    if (jobUpdatedAt > overrideUpdatedAt && getServerHasCoverLetterState(job, override)) {
      clearJobCoverLetterOverride(job.id);
      return job;
    }
    return { ...job, ...override };
  });
}

function applyJobAiUsageOverrides(jobs = []) {
  const overrides = readLocal(keys.jobAiUsageOverrides, {});
  if (!overrides || !Object.keys(overrides).length) return jobs;
  return jobs.map((job) => {
    const override = overrides[job.id];
    if (!override) return job;
    const jobUpdatedAt = new Date(job.updated_at || job.created_at || 0);
    const overrideUpdatedAt = new Date(override.updated_at || 0);
    if (jobUpdatedAt > overrideUpdatedAt && getServerHasAiUsageState(job, override)) {
      clearJobAiUsageOverride(job.id);
      return job;
    }
    return { ...job, ...override };
  });
}

function getServerHasFollowUpState(job = {}, override = {}) {
  return ["followup_date", "followup_status", "followup_completed_at", "followup_snoozed_until", "followup_note"].every((key) => {
    if (!(key in override)) return true;
    return normalizeComparable(job[key]) === normalizeComparable(override[key]);
  });
}

function getServerHasCalendarState(job = {}, override = {}) {
  return ["interview_date", "interview_time", "interview_duration", "interview_location", "interview_type", "interviewer_contact_id", "calendar_event_added_at", "followup_calendar_added_at"].every((key) => {
    if (!(key in override)) return true;
    return normalizeComparable(job[key]) === normalizeComparable(override[key]);
  });
}

function getServerHasArchiveState(job = {}, override = {}) {
  return ["archived_at", "archived_reason", "archived_by_user"].every((key) => {
    if (!(key in override)) return true;
    return normalizeComparable(job[key]) === normalizeComparable(override[key]);
  });
}

function getServerHasCoverLetterState(job = {}, override = {}) {
  return ["cover_letter_status", "cover_letter_skipped_at"].every((key) => {
    if (!(key in override)) return true;
    return normalizeComparable(job[key]) === normalizeComparable(override[key]);
  });
}

function getServerHasAiUsageState(job = {}, override = {}) {
  if (!("ai_usage_counted_at" in override)) return true;
  return normalizeComparable(job.ai_usage_counted_at) === normalizeComparable(override.ai_usage_counted_at);
}

function normalizeComparable(value) {
  return value || null;
}

function normalizeFollowUpPayload(job) {
  const normalized = { ...job };
  if ("followUpDate" in normalized && !("followup_date" in normalized)) normalized.followup_date = normalized.followUpDate;
  if ("followUpStatus" in normalized && !("followup_status" in normalized)) normalized.followup_status = normalized.followUpStatus;
  if ("followUpCompletedAt" in normalized && !("followup_completed_at" in normalized)) normalized.followup_completed_at = normalized.followUpCompletedAt;
  if ("followUpSnoozedUntil" in normalized && !("followup_snoozed_until" in normalized)) normalized.followup_snoozed_until = normalized.followUpSnoozedUntil;
  if ("followUpNote" in normalized && !("followup_note" in normalized)) normalized.followup_note = normalized.followUpNote;
  if ("interviewDate" in normalized && !("interview_date" in normalized)) normalized.interview_date = normalized.interviewDate;
  if ("interviewTime" in normalized && !("interview_time" in normalized)) normalized.interview_time = normalized.interviewTime;
  if ("interviewDuration" in normalized && !("interview_duration" in normalized)) normalized.interview_duration = normalized.interviewDuration;
  if ("interviewLocation" in normalized && !("interview_location" in normalized)) normalized.interview_location = normalized.interviewLocation;
  if ("interviewType" in normalized && !("interview_type" in normalized)) normalized.interview_type = normalized.interviewType;
  if ("interviewerContactId" in normalized && !("interviewer_contact_id" in normalized)) normalized.interviewer_contact_id = normalized.interviewerContactId;
  if ("archivedAt" in normalized && !("archived_at" in normalized)) normalized.archived_at = normalized.archivedAt;
  if ("archivedReason" in normalized && !("archived_reason" in normalized)) normalized.archived_reason = normalized.archivedReason;
  if ("archivedByUser" in normalized && !("archived_by_user" in normalized)) normalized.archived_by_user = normalized.archivedByUser;
  if ("coverLetterStatus" in normalized && !("cover_letter_status" in normalized)) normalized.cover_letter_status = normalized.coverLetterStatus;
  if ("coverLetterSkippedAt" in normalized && !("cover_letter_skipped_at" in normalized)) normalized.cover_letter_skipped_at = normalized.coverLetterSkippedAt;
  if ("aiUsageCountedAt" in normalized && !("ai_usage_counted_at" in normalized)) normalized.ai_usage_counted_at = normalized.aiUsageCountedAt;
  return normalized;
}

function getLegacyJobPayload(payload) {
  const legacyPayload = { ...payload };
  delete legacyPayload.company_domain;
  delete legacyPayload.company_logo_url;
  delete legacyPayload.application_url;
  delete legacyPayload.followup_status;
  delete legacyPayload.followup_completed_at;
  delete legacyPayload.followup_snoozed_until;
  delete legacyPayload.followup_note;
  delete legacyPayload.interview_date;
  delete legacyPayload.interview_time;
  delete legacyPayload.interview_duration;
  delete legacyPayload.interview_location;
  delete legacyPayload.interview_type;
  delete legacyPayload.interviewer_contact_id;
  delete legacyPayload.calendar_event_added_at;
  delete legacyPayload.followup_calendar_added_at;
  delete legacyPayload.archived_at;
  delete legacyPayload.archived_reason;
  delete legacyPayload.archived_by_user;
  delete legacyPayload.cover_letter_status;
  delete legacyPayload.cover_letter_skipped_at;
  delete legacyPayload.ai_usage_counted_at;
  return legacyPayload;
}

function normalizeApplicationStage(status) {
  if (status === "Tailoring") return "Saved";
  if (status === "Recruiter Screen") return "Recruiter Contacted";
  if (status === "Interviewing") return "Interview";
  if (status === "Final Round") return "Final Interview";
  const supported = ["Saved", "Applied", "Recruiter Contacted", "Phone Screen", "Interview", "Final Interview", "Offer", "Rejected", "Closed"];
  return supported.includes(status) ? status : "Saved";
}
