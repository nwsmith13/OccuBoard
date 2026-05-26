import OpenAI from "openai";
import { DEFAULT_MODEL, GLOBAL_AI_RULES, buildPrompt, getSchema } from "./prompts.js";

const supportedActions = ["fit", "resume", "message", "followupMessage", "coverLetter", "interviewPrep"];

export default async function handler(req, res) {
  setJson(res);

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

  const { action, profile, job, options } = body ?? {};
  const validationError = validateRequest(action, profile, job);
  if (validationError) {
    return send(res, 400, { error: validationError });
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

    const result = parseStructuredOutput(response);
    validateGeneratedResult(action, result, profile, job);
    return send(res, 200, { result });
  } catch (error) {
    return send(res, getStatus(error), { error: getFriendlyError(error), code: error.code });
  }
}

function validateRequest(action, profile, job) {
  if (!supportedActions.includes(action)) return "Unsupported AI action.";
  if (!profile?.target_roles?.trim()) return "Add target roles to your profile before using AI tools.";
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
      const error = new Error("The generated follow-up message used the wrong voice or tone. Please regenerate.");
      error.status = 422;
      error.code = "message_voice_validation_failed";
      throw error;
    }
    return;
  }

  const hasCandidateInterest = /\bi\s+am\s+interested\s+in\b/i.test(content);
  const hasNameIntroduction = /\bmy\s+name\s+is\b/i.test(content);
  if (hasBadVoice || !hasCandidateInterest || !hasNameIntroduction) {
    const error = new Error("The generated message used recruiter voice instead of candidate voice. Please regenerate.");
    error.status = 422;
    error.code = "message_voice_validation_failed";
    throw error;
  }
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
