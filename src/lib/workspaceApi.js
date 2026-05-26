import { seedActivityLogs, seedJobActivityLogs, seedJobScores, seedJobs, seedMessages, seedProfile, seedResumeVersions } from "../data/seedData.js";
import { deriveCompanyDomain } from "./companyIdentity.js";
import { getDisplayCompanyName, getDisplayJobTitle, getTailoredResumeTitle } from "./jobDisplay.js";
import { createEmptyProfile } from "./profile.js";
import { getSupabaseClient, hasSupabaseConfig } from "./supabase.js";

const keys = {
  profile: "occuboard.profile",
  jobs: "occuboard.jobs",
  activityLogs: "occuboard.activityLogs",
  jobActivityLogs: "occuboard.jobActivityLogs",
  resumeVersions: "occuboard.resumeVersions",
  jobScores: "occuboard.jobScores",
  messages: "occuboard.messages",
  resumeUploads: "occuboard.resumeUploads",
};

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

  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.from("job_activity_logs").insert(payload).select("*").single();
    if (error) {
      if (isMissingTableError(error) || isMissingColumnError(error)) return null;
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
    const supabase = await getSupabaseClient();
    const [profileResult, jobsResult, logsResult, resumesResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("jobs").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
      supabase.from("activity_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
      supabase.from("resume_versions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (jobsResult.error) throw jobsResult.error;
    if (logsResult.error) throw logsResult.error;
    if (resumesResult.error) throw resumesResult.error;

    const [scoresResult, messagesResult] = await Promise.all([
      supabase.from("job_scores").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("messages").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    const uploadsResult = await supabase.from("resume_uploads").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const jobActivityResult = await supabase.from("job_activity_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

    const jobScores = isMissingTableError(scoresResult.error) ? [] : scoresResult.data ?? [];
    const messages = isMissingTableError(messagesResult.error) ? [] : messagesResult.data ?? [];
    const resumeUploads = isMissingTableError(uploadsResult.error) ? [] : uploadsResult.data ?? [];
    const jobActivityLogs = isMissingTableError(jobActivityResult.error) ? [] : jobActivityResult.data ?? [];
    if (scoresResult.error && !isMissingTableError(scoresResult.error)) throw scoresResult.error;
    if (messagesResult.error && !isMissingTableError(messagesResult.error)) throw messagesResult.error;
    if (uploadsResult.error && !isMissingTableError(uploadsResult.error)) throw uploadsResult.error;
    if (jobActivityResult.error && !isMissingTableError(jobActivityResult.error)) throw jobActivityResult.error;

    let profile = profileResult.data;
    if (!profile) {
      profile = createEmptyProfile(user);
      profile = await insertProfileWithFallback(user, profile);
    }

    return {
      profile,
      jobs: jobsResult.data ?? [],
      activityLogs: logsResult.data ?? [],
      jobActivityLogs,
      resumeVersions: resumesResult.data ?? [],
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
    resumeVersions: readLocal(keys.resumeVersions, seedResumeVersions),
    jobScores: readLocal(keys.jobScores, seedJobScores),
    messages: readLocal(keys.messages, seedMessages),
    resumeUploads: readLocal(keys.resumeUploads, []),
  };
}

function isMissingTableError(error) {
  return error?.code === "PGRST205" || error?.message?.includes("schema cache");
}

function isMissingColumnError(error) {
  return error?.code === "PGRST204" || error?.message?.includes("Could not find") || error?.message?.includes("schema cache");
}

export async function saveProfile(user, profile) {
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const payload = { ...profile, id: user.id, email: profile.email || user.email, updated_at: now() };
    const { data, error } = await supabase.from("profiles").upsert(payload).select("*").single();
    if (error) {
      if (!isMissingColumnError(error)) throw error;
      const legacyPayload = getLegacyProfilePayload(payload);
      const retry = await supabase.from("profiles").upsert(legacyPayload).select("*").single();
      if (retry.error) throw retry.error;
      await logActivity(user, "Profile", "Updated profile and base resume details");
      return { ...retry.data, updated_at: payload.updated_at };
    }
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
      const enriched = { ...retry.data, ...Object.fromEntries(Object.entries(payload).filter(([key]) => key.startsWith("followup_") || key.startsWith("company_"))) };
      await logActivity(user, "Job", `Updated ${getDisplayJobTitle(enriched)} at ${getDisplayCompanyName(enriched)}`);
      await logJobUpdateActivity(user, previous, enriched, payload);
      return enriched;
    }
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
  await logActivity(user, "Job", "Deleted a saved job");
  return id;
}

export async function saveJobScore(user, job, score) {
  const payload = {
    user_id: user?.id ?? "local-demo-user",
    job_id: job.id,
    score: score.score,
    strengths: score.strengths ?? [],
    gaps: score.gaps ?? [],
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
      const retry = await supabase.from("job_scores").insert(legacyPayload).select("*").single();
      if (retry.error) throw retry.error;
    await logActivity(user, "AI", `Analyzed fit for ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
    await logJobActivity(user, job.id, "analysis_generated", { score: payload.score, recommendation: payload.recommendation });
    return {
        ...retry.data,
        transferable_strengths: payload.transferable_strengths,
        better_aligned_roles: payload.better_aligned_roles,
        tailoring_intensity: payload.tailoring_intensity,
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
      const retry = await supabase.from("resume_versions").insert(legacyPayload).select("*").single();
      if (retry.error) throw retry.error;
      await logActivity(user, "AI", `Generated tailored resume for ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
      await logJobActivity(user, job.id, "resume_generated", { title: payload.title, resumeId: retry.data.id });
      return {
        ...retry.data,
        tailoring_intensity: payload.tailoring_intensity,
        recommendation: payload.recommendation,
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
  const payload = {
    user_id: user?.id ?? "local-demo-user",
    job_id: job.id,
    type: message.type === "LinkedIn intro" ? "Recruiter Message" : message.type ?? "Recruiter Message",
    content: message.content,
    created_at: now(),
  };
  if (hasSupabaseConfig && user?.id) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.from("messages").insert(payload).select("*").single();
    if (error) throw error;
    await logActivity(user, "AI", `Generated recruiter message for ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
    await logJobActivity(user, job.id, payload.type === "Follow-up Message" ? "followup_message_generated" : "message_generated", { type: payload.type });
    return data;
  }
  const saved = { ...payload, id: crypto.randomUUID() };
  writeLocal(keys.messages, [saved, ...readLocal(keys.messages, seedMessages)]);
  await logActivity(user, "AI", `Generated recruiter message for ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
  await logJobActivity(user, job.id, payload.type === "Follow-up Message" ? "followup_message_generated" : "message_generated", { type: payload.type });
  return saved;
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
  if ("date_saved" in payload) cleaned.date_saved = payload.date_saved || new Date().toISOString().slice(0, 10);
  if ("company_name" in payload) cleaned.company_name = getDisplayCompanyName(payload);
  if ("job_title" in payload) cleaned.job_title = getDisplayJobTitle(payload);
  if ("status" in payload) cleaned.status = normalizeApplicationStage(payload.status);
  return cleaned;
}

function normalizeFollowUpPayload(job) {
  const normalized = { ...job };
  if ("followUpDate" in normalized && !("followup_date" in normalized)) normalized.followup_date = normalized.followUpDate;
  if ("followUpStatus" in normalized && !("followup_status" in normalized)) normalized.followup_status = normalized.followUpStatus;
  if ("followUpCompletedAt" in normalized && !("followup_completed_at" in normalized)) normalized.followup_completed_at = normalized.followUpCompletedAt;
  if ("followUpSnoozedUntil" in normalized && !("followup_snoozed_until" in normalized)) normalized.followup_snoozed_until = normalized.followUpSnoozedUntil;
  if ("followUpNote" in normalized && !("followup_note" in normalized)) normalized.followup_note = normalized.followUpNote;
  return normalized;
}

function getLegacyJobPayload(payload) {
  const legacyPayload = { ...payload };
  delete legacyPayload.company_domain;
  delete legacyPayload.company_logo_url;
  delete legacyPayload.followup_status;
  delete legacyPayload.followup_completed_at;
  delete legacyPayload.followup_snoozed_until;
  delete legacyPayload.followup_note;
  return legacyPayload;
}

function normalizeApplicationStage(status) {
  if (status === "Tailoring") return "Saved";
  if (["Offer", "Rejected", "Closed"].includes(status)) return "Closed";
  return status || "Saved";
}
