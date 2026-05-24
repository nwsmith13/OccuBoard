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
    type: { type: "string", enum: ["Recruiter Message"] },
    content: { type: "string" },
  },
};

export function getSchema(action) {
  if (action === "fit") return fitSchema;
  if (action === "resume") return resumeSchema;
  return messageSchema;
}

export function buildPrompt(action, profile, job, options = {}) {
  const intensity = options.tailoringIntensity || "Balanced";
  const manualIntensityOverride = options.manualIntensityOverride ? "Yes" : "No";
  const fitRecommendation = options.fitRecommendation || "Unknown";
  const fitSummary = options.fitSummary || "No fit analysis provided.";
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
- Keep it concise and directly usable.`;
  }

  return `${context}

Generate one concise recruiter outreach message.
Rules:
- Write from the user/candidate to a recruiter, hiring manager, or company contact.
- Use first person as the user/candidate.
- Never write from the recruiter, hiring manager, or company.
- Never start with "Hi [candidate name]" or "Hi Matthew".
- Never say "I'm recruiting for" or imply the sender is recruiting.
- Never say "I'm reaching out from [Company]".
- Never say "our role", "our team", or "we are hiring".
- Make it clear the user is reaching out about the role.
- Must use candidate voice, such as: "Hello - I'm ${profile?.full_name || "the candidate"}, and I am interested in the ${job?.job_title || "role"} role at ${job?.company_name || "the company"}."
- Use clear phrasing like "I am interested in..." when naming the role.
- Avoid clipped phrasing like "interested in..." without a subject.
- 4-8 sentences maximum.
- Human, professional, practical, not overly enthusiastic.
- Warm, direct, and human.
- Mention the role and company.
- Mention 1-2 matching strengths supported by the profile/resume.
- Do not use "I'd welcome a brief conversation."
- Do not use wording that sounds like the candidate is granting permission.
- End with one of these closing styles:
  - "Would you be open to a quick conversation this week?"
  - "Would you be open to connecting for 15-20 minutes this week?"
  - "Would it make sense to connect briefly this week?"
- Do not oversell or invent anything.`;
}
