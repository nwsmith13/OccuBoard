import OpenAI from "openai";
import { refineFitAnalysisEvidence } from "./analysisEvidence.js";
import { freeLimit, getSubscriptionByUserId, getUsageByUserId, hasBillingDatabase, proStatuses } from "./billingStore.js";
import { DEFAULT_MODEL, GLOBAL_AI_RULES, buildPrompt, getSchema } from "./prompts.js";

const supportedActions = ["fit", "resume", "message", "followupMessage", "coverLetter", "interviewPrep"];
const generateRuntimeVersion = "generate-voice-retry-2026-06-21-01";

export default async function handler(req, res) {
  setJson(res);
  res.setHeader("x-occuboard-generate-version", generateRuntimeVersion);
  globalThis.console?.info?.("[api/generate] runtime", { version: generateRuntimeVersion, method: req.method });

  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return send(res, 503, {
      error: "AI generation is not configured yet. Add the server-only OpenAI key in your deployment settings.",
      code: "missing_openai_key",
    });
  }

  let body;
  try {
    const rawBody = req.body ?? (await readJson(req));
    body = typeof rawBody === "string" ? JSON.parse(rawBody || "{}") : rawBody;
  } catch {
    return send(res, 400, { error: "The AI request could not be read. Please try again." });
  }

  const { action, profile, job, options, userId } = body ?? {};
  const validationError = validateRequest(action, profile, job);
  if (validationError) {
    return send(res, 400, { error: validationError });
  }
  const billingError = await validateBillingAccess(action, userId || options?.userId, job, options);
  if (billingError) {
    return send(res, 402, { error: billingError, code: "free_limit_reached" });
  }

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      input: [
        { role: "system", content: GLOBAL_AI_RULES },
        { role: "user", content: buildPrompt(action, profile, job, options) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: `${action}_generation`,
          strict: true,
          schema: getSchema(action),
        },
      },
    });

    let result = parseStructuredOutput(response);
    if (action === "fit") result = refineFitAnalysisEvidence(result, profile, job);
    try {
      validateGeneratedResult(action, result, profile, job);
    } catch (validationError) {
      logMessageValidationFailure({ action, result, profile, job, validationError });
      if (action !== "message" || validationError.code !== "message_voice_validation_failed") throw validationError;
      try {
        result = await rewriteRecruiterMessageToCandidateVoice(client, { result, profile, job });
      } catch (rewriteGenerationError) {
        logMessageValidationFailure({ action, result, profile, job, validationError: rewriteGenerationError, phase: "rewrite_generation_failed_returning_original" });
        globalThis.console?.warn?.("[ai-validation] returning original recruiter message after rewrite generation failed", {
          version: generateRuntimeVersion,
          error: rewriteGenerationError?.message,
        });
        return send(res, 200, { result, warning: "message_voice_validation_bypassed_after_rewrite_failure" });
      }
      try {
        validateGeneratedResult(action, result, profile, job);
      } catch (rewriteError) {
        logMessageValidationFailure({ action, result, profile, job, validationError: rewriteError, phase: "rewrite" });
        globalThis.console?.warn?.("[ai-validation] returning rewritten recruiter message despite validator warning", {
          version: generateRuntimeVersion,
          reason: rewriteError.validationReason || rewriteError.code || "unknown",
        });
        return send(res, 200, { result, warning: "message_voice_validation_bypassed_after_rewrite" });
      }
    }
    return send(res, 200, { result });
  } catch (error) {
    return send(res, getStatus(error), { error: getFriendlyError(error), code: error.code });
  }
}

async function validateBillingAccess(action, userId, job = {}, options = {}) {
  if (!["fit", "resume", "message", "coverLetter", "interviewPrep"].includes(action)) return "";
  if (job?.ai_usage_counted_at || job?.usage_counted || options?.aiUsageAlreadyCounted) return "";
  if (!hasBillingDatabase()) return "";
  // TODO: Verify the Supabase access token matches userId once API auth middleware is added.
  if (!userId) return "Sign in before using AI generation.";
  try {
    const subscription = await getSubscriptionByUserId(userId);
    if (subscription?.plan === "pro" || proStatuses.has(subscription?.status)) return "";
    const usage = await getUsageByUserId(userId);
    if (Number(usage?.application_count || 0) >= freeLimit) {
      return "You've used your 3 free AI-powered applications. Upgrade to OccuBoard Pro for unlimited application preparation.";
    }
  } catch {
    return "";
  }
  return "";
}

function validateRequest(action, profile, job) {
  if (!supportedActions.includes(action)) return "Unsupported AI action.";
  if (!profile?.base_resume_text?.trim()) return "Add your base resume text before using AI tools.";
  if (!job?.job_title?.trim() || !job?.company_name?.trim()) return "Save the job title and company before using AI tools.";
  if (!job?.job_description?.trim()) return "Paste the job description before running AI tools.";
  return "";
}

function parseStructuredOutput(response) {
  const text =
    response.output_text ??
    response.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;

  if (!text) {
    throw new Error("The AI response was empty. Please try again.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The AI response was malformed. Please try again.");
  }
}

export function validateGeneratedResult(action, result, profile, job) {
  if (!["message", "followupMessage"].includes(action)) return;
  const content = String(result?.content || "").trim();
  const diagnostics = getMessageVoiceDiagnostics({ action, content, profile, job });
  if (!diagnostics.valid) {
    const error = new Error(diagnostics.message);
    error.status = 422;
    error.code = "message_voice_validation_failed";
    error.validationReason = diagnostics.reason;
    error.validationDiagnostics = diagnostics;
    throw error;
  }
}

function getMessageVoiceDiagnostics({ action, content, profile, job }) {
  const firstName = String(profile?.full_name || "").trim().split(/\s+/)[0];
  const fullName = String(profile?.full_name || "").trim();
  const company = String(job?.company_name || "").trim();
  const escapedCompany = escapeRegex(company);
  const badPatterns = [
    firstName && new RegExp(`^\\s*hi\\s+${escapeRegex(firstName)}\\b`, "i"),
    fullName && new RegExp(`\\bi(?:['\\u2019]m|\\s+am)\\s+${escapeRegex(fullName)}\\b`, "i"),
    /\bi(?:['\u2019]m|\s+am)\s+recruiting\s+for\b/i,
    /\bwe(?:['\u2019]re|\s+are)\s+hiring\b/i,
    /\bour\s+(role|team|company|opening|position)\b/i,
    escapedCompany && new RegExp(`\\bi(?:['\\u2019]m|\\s+am)\\s+reaching\\s+out\\s+from\\s+${escapedCompany}\\b`, "i"),
  ].filter(Boolean);

  const hasBadVoice = badPatterns.some((pattern) => pattern.test(content));
  if (action === "followupMessage") {
    if (hasBadVoice || /\bjust\s+checking\s+in\b/i.test(content)) {
      return {
        valid: false,
        reason: hasBadVoice ? "wrong_sender_or_recipient" : "banned_followup_phrase",
        message: "The generated follow-up message used the wrong voice or tone. Please regenerate.",
        hasBadVoice,
        hasCandidateVoice: /\b(?:i|i['\u2019]m|i['\u2019]ve|i\s+have|my)\b/i.test(content),
        evaluatorVoiceHits: 0,
      };
    }
    return { valid: true, reason: "ok", hasBadVoice, hasCandidateVoice: true, evaluatorVoiceHits: 0 };
  }

  const hasCandidateVoice = /\b(?:i|i['\u2019]m|i['\u2019]ve|i\s+have|my)\b/i.test(content);
  const evaluatorVoicePatterns = [
    /\b(?:this|the)\s+(?:candidate|applicant)\s+(?:is|has|brings|demonstrates|would|could|should)\b/i,
    /\b(?:candidate|applicant)\s+(?:appears|seems|demonstrates|would\s+be|is\s+a\s+strong)\b/i,
    /\bwe\s+(?:should|can|could)\s+(?:move\s+forward|interview|screen|consider)\b/i,
    /\bi\s+(?:recommend|would\s+recommend)\s+(?:moving\s+forward|interviewing|screening|considering)\b/i,
    /\bmove\s+(?:this|the)\s+(?:candidate|applicant)\s+forward\b/i,
    /\bwhy\s+(?:we|you)\s+should\s+(?:interview|hire|consider)\b/i,
  ];
  const evaluatorVoiceHits = evaluatorVoicePatterns.filter((pattern) => pattern.test(content)).length;
  const clearEvaluatorVoice = evaluatorVoiceHits >= 2 || (evaluatorVoiceHits >= 1 && !hasCandidateVoice);
  if (hasBadVoice || clearEvaluatorVoice || !hasCandidateVoice) {
    return {
      valid: false,
      reason: hasBadVoice ? "wrong_sender_or_recipient" : clearEvaluatorVoice ? "evaluator_voice" : "missing_candidate_voice",
      message: "The generated message used recruiter voice instead of candidate voice. Please regenerate.",
      hasBadVoice,
      hasCandidateVoice,
      evaluatorVoiceHits,
      clearEvaluatorVoice,
    };
  }
  return { valid: true, reason: "ok", hasBadVoice, hasCandidateVoice, evaluatorVoiceHits, clearEvaluatorVoice };
}

async function rewriteRecruiterMessageToCandidateVoice(client, { result, profile, job }) {
  const original = String(result?.content || "").trim();
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    input: [
      { role: "system", content: `${GLOBAL_AI_RULES}\nRewrite only the outreach message. Keep it truthful, concise, first-person, and written from the applicant to a recruiter or hiring contact.` },
      {
        role: "user",
        content: [
          `Rewrite this recruiter outreach message into candidate/applicant voice for the ${job?.job_title || "role"} role at ${job?.company_name || "the company"}.`,
          "The sender is the applicant. The recipient is a recruiter, hiring manager, or hiring contact.",
          "Do not describe the applicant in third person. Do not evaluate, score, or recommend the candidate.",
          "It may mention recruiters or hiring teams naturally, but it must not sound like a recruiter evaluating the applicant.",
          "Keep it 85-130 words, human, direct, and role-aware.",
          `Candidate name: ${profile?.full_name || "the applicant"}`,
          `Original generated message:\n${original}`,
        ].join("\n\n"),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "message_generation",
        strict: true,
        schema: getSchema("message"),
      },
    },
  });
  const rewritten = parseStructuredOutput(response);
  return {
    ...result,
    ...rewritten,
    content: rewritten.content || result.content,
  };
}

function logMessageValidationFailure({ action, result, profile, job, validationError, phase = "initial" }) {
  if (!["message", "followupMessage"].includes(action)) return;
  const content = String(result?.content || "");
  const diagnostics = validationError.validationDiagnostics || getMessageVoiceDiagnostics({ action, content, profile, job });
  globalThis.console?.warn?.("[ai-validation] recruiter message rejected", {
    phase,
    action,
    reason: validationError.validationReason || diagnostics.reason,
    hasCandidateVoice: Boolean(diagnostics.hasCandidateVoice),
    hasBadVoice: Boolean(diagnostics.hasBadVoice),
    evaluatorVoiceHits: Number(diagnostics.evaluatorVoiceHits || 0),
    contentLength: content.length,
    jobTitleLength: String(job?.job_title || "").length,
    companyLength: String(job?.company_name || "").length,
    contentPreview: content.slice(0, 220),
  });
}

function getFriendlyError(error) {
  const message = error.message || "";
  if (error.status === 429) return "AI is temporarily rate limited. Please wait a moment and try again.";
  if (error.status === 401) return "The server OpenAI key is invalid or missing.";
  if (error.code === "message_voice_validation_failed") return message;
  if (message.includes("malformed") || message.includes("empty")) return message;
  return "AI generation failed. Please try again.";
}

function getStatus(error) {
  if (error.status) return error.status;
  if (error.message?.includes("malformed") || error.message?.includes("empty")) return 502;
  return 500;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function setJson(res) {
  res.setHeader("content-type", "application/json");
}

function send(res, status, body) {
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
