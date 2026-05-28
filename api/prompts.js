import { buildEvidencePromptNotes } from "./analysisEvidence.js";

export const DEFAULT_MODEL = "gpt-5-mini";

export const GLOBAL_AI_RULES = `
You are OccuBoard's focused job search assistant.

Global rules:
- NEVER fabricate experience.
- NEVER invent employers.
- NEVER invent certifications, degrees, dates, tools, or skills unsupported by the user's profile or base resume.
- Tailor truthfully only.
- Prioritize ATS-friendly clarity.
- Keep outputs concise, practical, and actionable.
- Preserve the user's professional tone.
- Do not add auto-apply instructions.
- Return only JSON matching the requested schema.
`;

const targetRoleHints = [
  "SaaS Implementation Specialist",
  "Customer Success Manager",
  "Technical Support Engineer",
  "Solutions Consultant",
  "CRM / Workflow Automation roles",
];

const naturalnessPass = `
Naturalness / human tone pass:
- After drafting, briefly revise the output before returning JSON.
- Remove repeated phrasing and repeated role keywords.
- Avoid sounding like the job description was copied line by line.
- Use natural professional language that a real candidate would plausibly use.
- Keep only the strongest role-aligned terms instead of repeating every keyword.
- Simplify overly formal or inflated language.
- Preserve factual accuracy and do not add unsupported claims.
- Reduce repeated phrases such as "operational systems", "workflow consistency", "user adoption", "scalable systems", and "process improvement" when they appear too often.
`;

const roleLevelPositioning = `
Role-level positioning guardrail:
- If the role is coordinator, support, specialist, associate, administrator, analyst, or similar, do not over-position the candidate as a senior architect, executive strategist, or transformation leader.
- For coordinator/support/analyst roles, emphasize practical hands-on strengths: support coordination, onboarding, troubleshooting, documentation, follow-through, user enablement, and cross-functional communication.
- Technical and process strengths are useful, but phrase them as applied support and operational follow-through unless the role clearly asks for senior architecture or leadership.
- If the role is senior, architect, principal, director, lead, or explicitly strategic, stronger strategic positioning is acceptable when supported by the resume.
`;

export const fitSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "recommendation", "summary", "strengths", "gaps", "keywords", "transferableStrengths", "betterAlignedRoles"],
  properties: {
    score: { type: "integer" },
    recommendation: { type: "string", enum: ["Apply", "Maybe", "Skip"] },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
    transferableStrengths: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["skill", "whyItMatters"],
        properties: {
          skill: { type: "string" },
          whyItMatters: { type: "string" },
        },
      },
    },
    betterAlignedRoles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "reason"],
        properties: {
          role: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
};

export const resumeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "content", "whyThisFits"],
  properties: {
    title: { type: "string" },
    content: { type: "string" },
    whyThisFits: { type: "string" },
  },
};

export const messageSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "content"],
  properties: {
    type: { type: "string", enum: ["Recruiter Message", "Follow-up Message"] },
    content: { type: "string" },
  },
};

export const coverLetterSchema = {
  type: "object",
  additionalProperties: false,
  required: ["coverLetterText", "highlightsUsed", "toneNotes"],
  properties: {
    coverLetterText: { type: "string" },
    highlightsUsed: { type: "array", items: { type: "string" } },
    toneNotes: { type: "string" },
  },
};

export const interviewPrepSchema = {
  type: "object",
  additionalProperties: false,
  required: ["preparationLevel", "focusAreas", "questions", "talkingPoints", "starStories", "questionsToAsk", "thankYouMessage"],
  properties: {
    preparationLevel: { type: "string", enum: ["Not started", "In progress", "Ready"] },
    focusAreas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "whyItMatters", "emphasize"],
        properties: {
          title: { type: "string" },
          whyItMatters: { type: "string" },
          emphasize: { type: "string" },
        },
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "question", "guidance"],
        properties: {
          category: { type: "string", enum: ["Behavioral", "Technical", "Role-specific", "Company/team fit"] },
          question: { type: "string" },
          guidance: { type: "string" },
        },
      },
    },
    talkingPoints: { type: "array", items: { type: "string" } },
    starStories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "situation", "task", "action", "result"],
        properties: {
          title: { type: "string" },
          situation: { type: "string" },
          task: { type: "string" },
          action: { type: "string" },
          result: { type: "string" },
        },
      },
    },
    questionsToAsk: { type: "array", items: { type: "string" } },
    thankYouMessage: { type: "string" },
  },
};

export function getSchema(action) {
  if (action === "fit") return fitSchema;
  if (action === "resume") return resumeSchema;
  if (action === "coverLetter") return coverLetterSchema;
  if (action === "interviewPrep") return interviewPrepSchema;
  return messageSchema;
}

export function buildPrompt(action, profile, job, options = {}) {
  const intensity = options.tailoringIntensity || "Balanced";
  const manualIntensityOverride = options.manualIntensityOverride ? "Yes" : "No";
  const fitRecommendation = options.fitRecommendation || "Unknown";
  const fitSummary = options.fitSummary || "No fit analysis provided.";
  const evidencePromptNotes = buildEvidencePromptNotes(profile, job);
  const context = `
User profile:
- Name: ${profile?.full_name || "Not provided"}
- Location: ${profile?.location || "Not provided"}
- Target roles: ${profile?.target_roles || "Not provided"}
- LinkedIn: ${profile?.linkedin_url || "Not provided"}
- Portfolio: ${profile?.portfolio_url || "Not provided"}
- Base resume:
${profile?.base_resume_text || "Not provided"}

Current role priorities to consider when relevant: ${targetRoleHints.join(", ")}.

Job:
- Company: ${job?.company_name || "Not provided"}
- Title: ${job?.job_title || "Not provided"}
- Location: ${job?.location || "Not listed"}
- Remote type: ${job?.remote_type || "Not listed"}
- Description:
${job?.job_description || "No job description saved."}

Known fit context:
- Latest recommendation: ${fitRecommendation}
- Latest fit summary: ${fitSummary}
- Manual tailoring intensity override: ${manualIntensityOverride}
${evidencePromptNotes}
`;

  if (action === "fit") {
    return `${context}

Analyze fit between the user profile/base resume and the job.
Scoring guidance:
- 85-100: strong, direct match with clear evidence.
- 65-84: plausible match with some gaps.
- 40-64: maybe, but requires notable positioning.
- 0-39: weak or unsupported fit.

Return:
- score from 0 to 100
- recommendation as Apply, Maybe, or Skip
- one short summary written in a supportive, nuanced, career-guiding tone
- 3-5 strengths grounded in the resume/profile
- 2-4 gaps or risks
- 5-10 relevant keywords from the job/user overlap
- transferableStrengths: professional strengths the user still has even if this role is not a direct fit
- betterAlignedRoles: 3-5 more realistic role types based on actual background

Evidence confidence rules:
- Distinguish direct evidence, partial/adjacent evidence, and missing evidence.
- Do not use hard-negative wording like "no explicit mention" when partial evidence exists.
- If a job asks for ticketing, ITSM, service desk, Zendesk, ServiceNow, or ticket tracking and the resume includes Jira, treat it as partial/adjacent evidence unless service-desk queue ownership is also described.
- In that case, write a nuanced gap such as: "Limited direct ITSM/service-desk evidence. Jira experience is present, though support intake and ticket lifecycle workflows are not heavily emphasized."
- Surface useful adjacent evidence in strengths or supporting signals when present.
- Prefer nuanced interpretation over aggressive gap detection.

If recommendation is Skip:
- Be honest about hard blockers without being harsh.
- Do not imply the user belongs directly in that field if evidence is weak.
- Identify transferable strengths and adjacent, better-fit roles.
- Use language like: "This role has some overlapping operational strengths, but..." rather than "This role is a poor fit."`;
  }

  if (action === "resume") {
    return `${context}

Generate a tailored resume draft.
Tailoring intensity: ${intensity}
Latest fit recommendation: ${fitRecommendation}
Manual tailoring intensity override: ${manualIntensityOverride}

${roleLevelPositioning}

Required sections:
1. Contact/Header
2. Tailored Professional Summary
3. Optimized Core Skills
4. Professional Experience
5. Tools & Technologies if relevant and supported
6. Education if present in the base resume
7. Optional Why This Fits

Rules:
- Do not invent claims, tools, employers, dates, degrees, certifications, metrics, or responsibilities.
- Preserve chronology if chronology appears in the base resume.
- Preserve employer names and dates.
- Preserve important truthful credentials even if the job description does not mention them.
- If Education exists in the base resume, include an Education section near the bottom.
- Preserve actual degree, school, and education wording exactly when present.
- If Education is missing from the base resume, omit Education instead of fabricating it.
- For Matthew's resume, preserve: Bachelor of Science - Information Systems / Business Technology; Northwest Missouri State University.
- Conservative: minimal rewriting, preserve original structure heavily, emphasize only clear truthful alignment.
- Balanced: moderate optimization, reorder bullets and improve ATS alignment while preserving career identity.
- Aggressive: stronger reframing of transferable skills, still truthful and no fabricated claims.
- If the latest fit recommendation is Skip and manual tailoring intensity override is No, use Conservative behavior even if another intensity appears in context.
- When fit is weak, do not rewrite the summary to sound like a direct industry expert.
- Avoid repeated phrases like "ready to apply my skills to X field."
- Do not sound desperate or compensatory.
- Reorder emphasis and rephrase only when supported by the user's material.
- Integrate ATS keywords naturally when supported.
- Keep ATS alignment strong without one-to-one mirroring of the job description.
- Preserve believable candidate voice.
- Prefer one strong phrase over repeating the same idea across summary, skills, and bullets.
- Prioritize the user's real experience over keyword stuffing.
- For coordinator/support/analyst roles, keep the resume practical and hands-on; highlight documentation, training, user support, troubleshooting, onboarding, and follow-through when supported.
- Keep it concise and directly usable.

${naturalnessPass}`;
  }

  if (action === "followupMessage") {
    return `${context}

Generate one concise application follow-up message.
Rules:
- Write from the user/candidate to a recruiter, hiring manager, or company contact.
- Use first person as the user/candidate.
- Never write from the recruiter, hiring manager, company, or employer.
- Never start with "Hi [candidate name]" or "Hi Matthew".
- Never say "I'm recruiting for", "I'm reaching out from [Company]", "our role", "our team", or "we are hiring".
- Mention the ${job?.job_title || "role"} role at ${job?.company_name || "the company"}.
- Make it clear the user is following up on an application or prior outreach.
- Do not sound desperate, apologetic, or overly eager.
- Avoid the phrase "just checking in".
- Short, polite, specific, and practical.
- 3-5 sentences maximum.
- Mention 1 relevant strength only if it is supported by the profile/resume.
- Close with a low-pressure offer to provide more information.
- A strong style example:
"Hello - I wanted to follow up on my application for the ${job?.job_title || "role"} role at ${job?.company_name || "the company"}. I remain very interested in the opportunity and believe my background aligns well with the role. Please let me know if there is anything else I can provide."`;
  }

  if (action === "coverLetter") {
    return `${context}

Generate one optional tailored cover letter for this opportunity.

Additional context:
- Tailored resume if available:
${options.latestResume || "No tailored resume provided."}
- Contact if available: ${options.contactName || "No contact selected."}

${roleLevelPositioning}

Rules:
- Write from the applicant/candidate to the company or contact.
- Must sound like the applicant, not the company, recruiter, or employer.
- Be specific to the ${job?.job_title || "role"} role at ${job?.company_name || "the company"}.
- Keep it concise, human, and direct: 3-5 short paragraphs, under about 350 words.
- Keep the final letter between 250 and 350 words unless the user requested another length.
- Do not use "Dear Hiring Manager" if a contact or company is known.
- Avoid generic phrasing like "I am writing to express my interest."
- Avoid dramatic language, "perfect fit", and inflated claims.
- Do not repeat resume bullets verbatim.
- Do not invent experience, metrics, tools, certifications, dates, employers, or responsibilities.
- Use metrics only when a specific metric is present in the base resume/profile or tailored resume.
- Do not imply vague measurable claims such as "measurable efficiency gains" unless a real metric is provided.
- If a metric is available, use it specifically. If no metric is available, state the impact qualitatively without pretending it was measured.
- Ground every claim in the base resume/profile, fit context, job description, or tailored resume.
- Preferred structure:
  1. Opening: interest in the role/company.
  2. Relevant experience bridge.
  3. Specific value or differentiator.
  4. Brief closing CTA.

Return:
- coverLetterText: the complete cover letter text.
- highlightsUsed: 3-5 truthful strengths or themes used.
- toneNotes: one short note explaining the tone and positioning.

${naturalnessPass}`;
  }

  if (action === "interviewPrep") {
    return `${context}

Generate a calm, confidence-building interview prep workspace for this opportunity.

Rules:
- Keep it practical and not overwhelming.
- Do not invent experience, metrics, employers, tools, or accomplishments.
- Ground talking points and STAR stories in the user's base resume/profile.
- If evidence is limited, frame suggestions as transferable themes rather than direct claims.
- Write in a supportive, focused tone.
- Keep each item concise.

Return:
- preparationLevel: use "In progress" when prep content is generated.
- focusAreas: 5-7 likely interview themes with why they matter and what to emphasize.
- questions: 8-12 likely questions across Behavioral, Technical, Role-specific, and Company/team fit.
- talkingPoints: 5-7 strongest truthful points the user can lean on.
- starStories: 3-5 compact STAR examples based only on resume/profile evidence.
- questionsToAsk: 6-8 thoughtful questions the candidate can ask them.
- thankYouMessage: one short post-interview thank-you message from the candidate to the interviewer/company contact.`;
  }

  return `${context}

Generate one concise recruiter outreach message.
${roleLevelPositioning}

Rules:
- Write from the user/candidate to a recruiter, hiring manager, or company contact.
- Use first person as the user/candidate.
- Never write from the recruiter, hiring manager, or company.
- Never start with "Hi [candidate name]" or "Hi Matthew".
- Never say "I'm recruiting for" or imply the sender is recruiting.
- Never say "I'm reaching out from [Company]".
- Never say "our role", "our team", or "we are hiring".
- Make it clear the user is reaching out about the role.
- Start naturally with: "Hello — my name is ${profile?.full_name || "the candidate"}, and I am interested in the ${job?.job_title || "role"} role at ${job?.company_name || "the company"}."
- Must use candidate voice throughout.
- Prefer "my name is ${profile?.full_name || "the candidate"}" instead of "I'm ${profile?.full_name || "the candidate"}."
- Use clear phrasing like "I am interested in..." when naming the role.
- Avoid clipped phrasing like "interested in..." without a subject.
- Usually 80-120 words.
- 3-5 sentences maximum.
- Human, professional, practical, not overly enthusiastic.
- Warm, direct, and human.
- Mention the role and company.
- Mention 2-3 strongest aligned strengths supported by the profile/resume.
- If noting a gap, keep it brief, confident, and practical.
- Avoid dense lists.
- Avoid long comma-heavy sentences.
- Do not sound like a cover letter.
- Do not use "I'd welcome a brief conversation."
- Do not use wording that sounds like the candidate is granting permission.
- End with: "Would you be open to connecting for 15-20 minutes this week?"
- Do not oversell or invent anything.

${naturalnessPass}`;
}
