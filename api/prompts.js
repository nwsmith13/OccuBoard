import { buildEvidencePromptNotes } from "./analysisEvidence.js";
import { normalizeCoverLetterTone } from "../src/lib/coverLetterTone.js";

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

export const MITIGATION_STRATEGY_RULES = `
Mitigation strategy rules:
- Use mitigation suggestions from the fit analysis as positioning guidance.
- Never fabricate direct experience.
- Do not claim tools, platforms, certifications, or responsibilities the user has not used.
- Use adjacent experience only when supported by the resume/profile or generated fit analysis.
- Avoid keyword stuffing and avoid sounding defensive.
- Prefer natural, evidence-based phrasing over one-to-one mirroring of the job description.
- For platform-specific gaps, emphasize adaptability and similar tools without claiming the missing platform.
- For wording gaps, add supported phrasing naturally where it belongs.
- For seniority/framing gaps, keep tone hands-on, practical, and execution-focused.
`;

export const RECRUITER_MESSAGE_STRATEGY_RULES = `
Recruiter message strategy:
- First identify the role/company communication style before drafting.
- Startup, founder, founding-team, chief-of-staff, and operator roles should sound direct, human, curious, and high-agency. Use plain language, explain what specifically makes the work interesting, and favor builder/operator framing over corporate application language.
- Traditional corporate roles should sound polished and professional while remaining conversational.
- Sales roles should emphasize one or two supported customer, territory, relationship, pipeline, or revenue-adjacent strengths without forcing unsupported metrics.
- Technical implementation roles should emphasize supported delivery, systems, customer-facing problem solving, adoption, or cross-functional execution.
- For a true stretch role with a material domain gap, acknowledge the single most important gap briefly and confidently. A useful pattern is: "I don't bring direct [domain] experience yet, but I do bring..." Do not use this pattern for minor tool, wording, or platform-familiarity gaps.
- Never turn the message into a list of deficiencies. One honest bridge is enough.
- Include: who the candidate is professionally, why this specific role or company caught their attention, one or two supported transferable strengths, an optional material-gap bridge, and a low-pressure next step.
- Avoid cover-letter structure, generic claims such as "I believe my skills align," inflated confidence, buzzword stacks, and lengthy explanations.
- Do not force the candidate's name into the opening when a more natural professional introduction is stronger.
- Vary the opening and closing so messages do not feel templated.
`;

export const COVER_LETTER_TONE_RULES = {
  professional: `
Cover letter tone: Professional
- Use polished, concise business writing suitable for corporate, enterprise, and traditional employers.
- Keep a clear opening, evidence-based middle, and professional close.
- Sound confident and specific without becoming stiff, ceremonial, or inflated.
- Keep the final letter between 250 and 350 words.
`,
  startup: `
Cover letter tone: Startup
- Write with a founder-to-founder or operator-to-operator feel: direct, curious, high-agency, and grounded.
- Explain what specifically caught the candidate's attention about the company, problem, or role.
- Use plain language and contractions where natural.
- Favor concrete builder/operator experience over polished career-coach phrasing.
- If the fit analysis identifies a material domain gap, acknowledge it once in plain language and bridge immediately to supported transferable experience.
- Allow a slightly less symmetrical structure so the letter feels personally written rather than templated.
- Keep the final letter between 180 and 280 words.
- Avoid "I am excited to apply", "I believe my background aligns", "I bring practical strengths", and generic cover-letter transitions.
`,
  conversational: `
Cover letter tone: Conversational
- Write warmly and naturally, as a thoughtful applicant communicating with a real person.
- Use contractions where appropriate and vary sentence length.
- Keep the structure clear but not mechanically perfect; a short standalone sentence is acceptable when it improves rhythm.
- Explain interest in the work with specific, plain language.
- Keep confidence measured and evidence-based.
- Keep the final letter between 220 and 320 words.
- Avoid "I am excited to apply", "I believe my background aligns", "I bring practical strengths", and generic career-coach language.
`,
};

export const fitSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "recommendation", "summary", "strengths", "gaps", "gapAssessments", "mitigationSuggestions", "keywords", "transferableStrengths", "betterAlignedRoles"],
  properties: {
    score: { type: "integer" },
    recommendation: { type: "string", enum: ["Apply", "Maybe", "Skip"] },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    gapAssessments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["gap", "severity", "confidence", "mitigationSuggestions"],
        properties: {
          gap: { type: "string" },
          severity: { type: "string", enum: ["critical", "moderate", "minor", "informational"] },
          confidence: { type: "string", enum: ["strong", "partial", "missing"] },
          mitigationSuggestions: { type: "array", items: { type: "string" } },
        },
      },
    },
    mitigationSuggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["gap", "suggestions"],
        properties: {
          gap: { type: "string" },
          suggestions: { type: "array", items: { type: "string" } },
        },
      },
    },
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
  const mitigationPromptContext = formatMitigationPromptContext(options.mitigationPlan);
  const recruiterMessageStyle = getRecruiterMessageStyle(job, options);
  const coverLetterTone = normalizeCoverLetterTone(options.coverLetterTone);
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
${mitigationPromptContext}
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
- gapAssessments: one object per gap with gap, severity, confidence, and mitigationSuggestions
- mitigationSuggestions: one entry per meaningful gap, with 1-3 practical suggestions for addressing or positioning that gap
- 5-10 relevant keywords from the job/user overlap
- transferableStrengths: professional strengths the user still has even if this role is not a direct fit
- betterAlignedRoles: 3-5 more realistic role types based on actual background

Gap severity rules:
- Assign severity for each gap: critical, moderate, minor, or informational.
- critical = likely blocker, such as no required certification, no relevant experience category, or no customer-facing background for a customer-facing role.
- moderate = meaningful but addressable, such as missing direct ITSM ownership or missing industry-specific workflow experience.
- minor = adjacent gap or platform familiarity, such as BuildOps not listed, Smartsheet not listed, or no explicit UAT wording.
- informational = soft observations only, such as the role being more junior than the candidate's background or startup vs enterprise environment mismatch.
- Platform-specific tools alone should rarely be critical if adjacent operational/tooling experience exists.
- Missing BuildOps with strong ERP/CRM/workflow experience should usually be minor.
- Missing customer onboarding experience for an onboarding-heavy role may be critical or moderate depending on adjacent customer-facing evidence.
- Use confidence with severity: partial evidence + platform mismatch usually minor; missing evidence + adjacent workflow experience usually moderate; missing evidence + no adjacent signals can be critical.
- Scores should reflect severity intelligently: do not heavily reduce fit for missing vendor-specific platforms when adjacent operational tooling exists.

Mitigation suggestion rules:
- For each identified gap, provide 1-3 short practical mitigation suggestions.
- Suggestions should be resume, interview, or application focused.
- Leverage transferable experience already present in the resume/profile.
- Never invent experience.
- Avoid generic advice like "learn the platform", "gain more experience", or "take a course".
- Suggestions should help the candidate position adjacent experience more effectively.
- Good examples: "Position Jira and workflow coordination as operational intake-tracking experience.", "Highlight onboarding documentation and quick-reference guide creation.", "Emphasize cross-functional coordination during ERP integrations."

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

${MITIGATION_STRATEGY_RULES}

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
- Preserve the candidate's actual degree, school, and education wording exactly when present in the base resume.
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
- Never address the message to the candidate; address the recruiter, hiring manager, or company contact instead.
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

${MITIGATION_STRATEGY_RULES}

${COVER_LETTER_TONE_RULES[coverLetterTone]}

Rules:
- Write from the applicant/candidate to the company or contact.
- Must sound like the applicant, not the company, recruiter, or employer.
- Be specific to the ${job?.job_title || "role"} role at ${job?.company_name || "the company"}.
- Keep it concise, human, and direct in 3-5 short paragraphs.
- Do not use "Dear Hiring Manager" if a contact or company is known.
- Avoid generic phrasing like "I am writing to express my interest."
- Avoid dramatic language, "perfect fit", and inflated claims.
- Do not repeat resume bullets verbatim.
- Do not invent experience, metrics, tools, certifications, dates, employers, or responsibilities.
- Use metrics only when a specific metric is present in the base resume/profile or tailored resume.
- Do not imply vague measurable claims such as "measurable efficiency gains" unless a real metric is provided.
- If a metric is available, use it specifically. If no metric is available, state the impact qualitatively without pretending it was measured.
- Ground every claim in the base resume/profile, fit context, job description, or tailored resume.
- Content priorities, not a rigid template:
  1. A specific reason the role, company, or problem is interesting.
  2. A relevant experience bridge.
  3. A specific value or differentiator.
  4. A brief closing CTA.

Return:
- coverLetterText: the complete cover letter text.
- highlightsUsed: 3-5 truthful strengths or themes used.
- toneNotes: one short note confirming the ${coverLetterTone} tone and positioning choices.

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

${MITIGATION_STRATEGY_RULES}

${RECRUITER_MESSAGE_STRATEGY_RULES}

Role-aware direction for this message:
- Communication style: ${recruiterMessageStyle.label}
- Tone guidance: ${recruiterMessageStyle.guidance}
- Material-gap guidance: ${recruiterMessageStyle.materialGapGuidance}

Rules:
- Write from the user/candidate to a recruiter, hiring manager, or company contact.
- Use first person as the user/candidate.
- Never write from the recruiter, hiring manager, or company.
- Never address the message to the candidate; address the recruiter, hiring manager, or company contact instead.
- Never say "I'm recruiting for" or imply the sender is recruiting.
- Never say "I'm reaching out from [Company]".
- Never say "our role", "our team", or "we are hiring".
- Make it clear the user is reaching out about the role.
- Must use candidate voice throughout.
- Open with a natural professional introduction or a specific reason the opportunity caught the candidate's attention.
- Usually 85-130 words.
- 4-6 concise sentences maximum.
- Human, practical, specific, and appropriately confident.
- Mention the role and company.
- Mention only 1-2 strongest aligned or transferable strengths supported by the profile/resume.
- If there is a material gap, acknowledge at most one and immediately bridge to supported transferable experience.
- If there is no material gap, do not invent or manufacture one.
- Avoid dense lists.
- Avoid long comma-heavy sentences.
- Do not sound like a cover letter.
- Do not use "I believe my skills align", "I am writing to express my interest", or similar generic application language.
- Do not use "I'd welcome a brief conversation."
- Do not use wording that sounds like the candidate is granting permission.
- End with a soft, natural CTA such as asking whether the contact would be open to connecting or whether a short conversation would be useful.
- Do not oversell or invent anything.

${naturalnessPass}`;
}

export function getRecruiterMessageStyle(job = {}, options = {}) {
  const title = String(job?.job_title || "").toLowerCase();
  const description = String(job?.job_description || "").toLowerCase();
  const combined = `${title}\n${description}`;
  const strongStartupTitle = /\b(founder'?s?\s+associate|founding\s+(?:team|operator|associate)|chief\s+of\s+staff|startup\s+operator|business\s+operator)\b/.test(title);
  const startupSignals = [
    /\bearly[-\s]?stage\b/,
    /\bseed[-\s]?(?:stage|funded)?\b/,
    /\bseries\s+[abc]\b/,
    /\bzero[-\s]?to[-\s]?one\b|\b0[-\s]?to[-\s]?1\b/,
    /\bhigh[-\s]?agency\b/,
    /\bwear\s+many\s+hats\b/,
    /\bbuild(?:ing)?\s+from\s+scratch\b/,
    /\bfast[-\s]?moving\s+startup\b/,
    /\bfounding\s+team\b/,
    /\bambiguity\b/,
  ].filter((pattern) => pattern.test(combined)).length;
  const startupOperator = strongStartupTitle || startupSignals >= 2;
  const salesRole = /\b(account\s+executive|sales|business\s+development|territory\s+manager|sales\s+development|revenue)\b/.test(title);
  const technicalImplementationRole = /\b(implementation|solutions?\s+(?:consultant|engineer|architect)|technical\s+(?:consultant|account\s+manager|project\s+manager)|integration)\b/.test(title);
  const materialGap = hasMaterialRecruiterGap(options);
  const key = startupOperator
    ? "startup_operator"
    : salesRole
      ? "sales"
      : technicalImplementationRole
        ? "technical_implementation"
        : "professional";
  const style = {
    startup_operator: {
      label: "Startup / founder / operator",
      guidance: "Write peer-to-peer: direct, conversational, specific, and builder-minded. Explain why the problem, company, or operating environment is compelling; avoid formal application phrasing.",
    },
    sales: {
      label: "Sales / revenue",
      guidance: "Use confident, concise relationship-building language. Ground the message in supported customer, territory, pipeline, discovery, or commercial strengths and avoid unsupported revenue claims.",
    },
    technical_implementation: {
      label: "Technical implementation",
      guidance: "Use a practical customer-and-delivery tone. Emphasize supported implementation, integrations, systems problem solving, adoption, and cross-functional execution without overloading the message with technical terms.",
    },
    professional: {
      label: "Polished professional",
      guidance: "Use a polished professional tone that still sounds like a real person. Lead with specific interest and evidence rather than ceremony or generic enthusiasm.",
    },
  }[key];

  return {
    key,
    label: style.label,
    guidance: style.guidance,
    materialGapGuidance: materialGap
      ? "A meaningful gap may exist. Acknowledge only the most material domain gap if it would matter to the reader, then bridge immediately to concrete transferable evidence."
      : "Do not introduce a gap disclaimer unless the supplied fit context clearly identifies a material concern.",
  };
}

function hasMaterialRecruiterGap(options = {}) {
  if (["Maybe", "Skip"].includes(options.fitRecommendation)) return true;
  return (options.mitigationPlan?.items || []).some((item) => {
    const severity = String(item?.severity || "").toLowerCase();
    const confidence = String(item?.confidence || "").toLowerCase();
    return severity === "critical" || (severity === "moderate" && confidence === "missing");
  });
}

function formatMitigationPromptContext(plan = {}) {
  if (!plan?.items?.length) return "";
  const rows = plan.items.map((item) => [
    `- Gap: ${item.gapText}`,
    `  Severity/confidence: ${item.severity || "moderate"} / ${item.confidence || "partial"}`,
    `  Strategy: ${item.strategy}`,
    `  Resume instruction: ${item.resumeInstruction}`,
    `  Cover letter instruction: ${item.coverLetterInstruction}`,
    `  Recruiter message instruction: ${item.recruiterMessageInstruction}`,
  ].join("\n"));
  return `
Mitigation strategy from fit analysis:
${plan.summary || "Use the gap analysis to strengthen truthful positioning."}
${rows.join("\n")}
`;
}
