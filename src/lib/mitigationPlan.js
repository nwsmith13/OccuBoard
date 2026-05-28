const CATEGORY_CONFIG = {
  uat_validation: {
    strategy: "Use implementation evidence to frame rollout validation, go-live readiness, workflow testing, and client acceptance.",
    suggestedPlacement: ["Resume", "Cover letter", "Interview"],
    resumeInstruction: "Add rollout validation, go-live readiness, workflow testing, or client acceptance language where supported by implementation experience.",
    coverLetterInstruction: "Briefly connect implementation delivery experience to rollout validation and readiness when it strengthens the application.",
    recruiterMessageInstruction: "Mention rollout validation or go-live support only if it is supported by implementation experience; keep it brief.",
    appliedLabel: "Added rollout validation framing",
  },
  itsm_ticketing: {
    strategy: "Position adjacent workflow coordination as intake, escalation, issue tracking, and follow-through experience without claiming formal ITSM ownership.",
    suggestedPlacement: ["Resume", "Recruiter message", "Interview"],
    resumeInstruction: "Strengthen intake, escalation, issue tracking, and workflow coordination language using Jira/project workflow experience already present.",
    coverLetterInstruction: "Use one concise line about workflow coordination or escalation support if it helps address service-desk adjacency.",
    recruiterMessageInstruction: "Mention Jira/workflow coordination as transferable intake-tracking experience without claiming formal ITSM ownership.",
    appliedLabel: "Strengthened intake/escalation positioning",
  },
  platform_familiarity: {
    strategy: "Use adjacent ERP, CRM, and workflow-tool evidence to show quick platform adoption without claiming unlisted systems.",
    suggestedPlacement: ["Resume", "Recruiter message", "Cover letter", "Interview"],
    resumeInstruction: "Position adjacent ERP, CRM, and workflow-tool experience as evidence of quick platform adoption.",
    coverLetterInstruction: "If useful, mention similar ERP, CRM, or workflow systems and the ability to ramp quickly on new operational platforms.",
    recruiterMessageInstruction: "Mention similar operational systems or workflow tools briefly without sounding apologetic.",
    appliedLabel: "Positioned adjacent systems experience",
  },
  seniority_framing: {
    strategy: "Keep the application voice hands-on, practical, and execution-focused for roles that may sit below the candidate's seniority.",
    suggestedPlacement: ["Recruiter message", "Interview"],
    resumeInstruction: "Keep summary and bullets practical and hands-on; avoid over-positioning as a strategic executive.",
    coverLetterInstruction: "Emphasize hands-on follow-through, support coordination, and practical ownership instead of executive-level framing.",
    recruiterMessageInstruction: "Keep tone hands-on and execution-focused; avoid over-positioning as strategic executive.",
    appliedLabel: "Kept framing hands-on and practical",
  },
  documentation_training: {
    strategy: "Use documentation, onboarding, training, and enablement evidence to strengthen user support positioning.",
    suggestedPlacement: ["Resume", "Cover letter", "Interview"],
    resumeInstruction: "Highlight onboarding documentation, quick-reference guides, user training, and enablement support where present.",
    coverLetterInstruction: "Connect documentation and training experience to user enablement and adoption.",
    recruiterMessageInstruction: "Mention documentation or onboarding support only if it is one of the strongest role-aligned points.",
    appliedLabel: "Strengthened documentation/training positioning",
  },
  general_positioning: {
    strategy: "Use adjacent, truthful experience to clarify the strongest transferable positioning for this role.",
    suggestedPlacement: ["Resume", "Recruiter message", "Cover letter", "Interview"],
    resumeInstruction: "Clarify transferable experience naturally where it is supported by the resume.",
    coverLetterInstruction: "Briefly connect transferable experience to the role without becoming defensive.",
    recruiterMessageInstruction: "Mention only the strongest transferable point if it helps the outreach message.",
    appliedLabel: "Clarified transferable experience",
  },
};

export function buildMitigationPlan(score = {}) {
  const assessments = normalizeAssessments(score);
  const items = assessments
    .map((assessment, index) => {
      const gapText = getGapText(assessment);
      if (!gapText) return null;
      const suggestions = getMitigationItems(assessment, score);
      const category = getMitigationCategory(gapText, suggestions);
      const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general_positioning;
      return {
        id: `${category}-${index}-${slug(gapText).slice(0, 28)}`,
        gapText,
        severity: normalizeSeverity(assessment.severity),
        confidence: normalizeConfidence(assessment.confidence),
        category,
        strategy: config.strategy,
        suggestedPlacement: config.suggestedPlacement,
        resumeInstruction: config.resumeInstruction,
        coverLetterInstruction: config.coverLetterInstruction,
        recruiterMessageInstruction: config.recruiterMessageInstruction,
        appliedLabel: config.appliedLabel,
      };
    })
    .filter(Boolean)
    .filter((item) => item.severity !== "informational" || item.category === "seniority_framing");

  return {
    summary: buildPlanSummary(items),
    items: dedupePlanItems(items),
  };
}

export function getAppliedMitigations(plan, placement) {
  const placementText = String(placement || "").toLowerCase();
  if (!plan?.items?.length || !placementText) return [];
  return plan.items
    .filter((item) => item.suggestedPlacement.some((value) => value.toLowerCase() === placementText))
    .map((item) => ({
      gapId: item.id,
      appliedLabel: item.appliedLabel,
      placement,
      createdAt: new Date().toISOString(),
    }));
}

export function getAppliedMitigationLabels(value) {
  return normalizeArray(value?.appliedMitigations ?? value?.applied_mitigations)
    .map((item) => (typeof item === "string" ? item : item?.appliedLabel || item?.applied_label || item?.label || ""))
    .map((item) => String(item).trim())
    .filter(Boolean);
}

export function formatMitigationPlanForPrompt(plan = {}) {
  if (!plan?.items?.length) return "";
  const lines = plan.items.map((item) => [
    `- Gap: ${item.gapText}`,
    `  Severity/confidence: ${item.severity} / ${item.confidence}`,
    `  Strategy: ${item.strategy}`,
    `  Resume instruction: ${item.resumeInstruction}`,
    `  Cover letter instruction: ${item.coverLetterInstruction}`,
    `  Recruiter message instruction: ${item.recruiterMessageInstruction}`,
  ].join("\n"));
  return `Mitigation strategy from fit analysis:\n${plan.summary}\n${lines.join("\n")}`;
}

function normalizeAssessments(score = {}) {
  const direct = normalizeArray(score.gapAssessments ?? score.gap_assessments);
  if (direct.length) return direct;
  return normalizeArray(score.gaps).map((gap) => ({
    gap: getGapText(gap),
    severity: gap?.severity || inferSeverity(getGapText(gap)),
    confidence: gap?.confidence || "partial",
    mitigationSuggestions: findMitigationForGap(getGapText(gap), score),
  }));
}

function getMitigationItems(assessment = {}, score = {}) {
  const direct = normalizeSuggestionItems(assessment.mitigationSuggestions ?? assessment.mitigation_suggestions ?? assessment.suggestions ?? assessment.mitigation);
  if (direct.length) return direct;
  const fromScore = findMitigationForGap(getGapText(assessment), score);
  if (fromScore.length) return fromScore;
  return getFallbackSuggestions(getGapText(assessment));
}

function findMitigationForGap(gap, score = {}) {
  const normalizedGap = normalizeText(gap);
  const items = normalizeArray(score.mitigationSuggestions ?? score.mitigation_suggestions);
  const match = items.find((item) => {
    const itemGap = normalizeText(item?.gap || item?.text || "");
    return itemGap && (itemGap === normalizedGap || itemGap.includes(normalizedGap.slice(0, 40)) || normalizedGap.includes(itemGap.slice(0, 40)));
  });
  return normalizeSuggestionItems(match?.mitigationSuggestions ?? match?.mitigation_suggestions ?? match?.suggestions ?? match?.mitigation);
}

function getMitigationCategory(gapText = "", suggestions = []) {
  const text = normalizeText(`${gapText} ${suggestions.join(" ")}`);
  if (/\b(uat|user acceptance testing|testing|validation|rollout validation|qa|quality assurance|go live testing|go live|acceptance criteria|release validation|implementation validation|process validation)\b/.test(text)) return "uat_validation";
  if (/\b(itsm|ticket|ticketing|service desk|zendesk|servicenow|intake|support queue|escalation)\b/.test(text)) return "itsm_ticketing";
  if (/\b(buildops|sage intacct|smartsheet|platform|tool|erp|crm|system|software)\b/.test(text)) return "platform_familiarity";
  if (/\b(seniority|junior|senior|startup|enterprise|framing|context|overqualified|hands on|execution focused)\b/.test(text)) return "seniority_framing";
  if (/\b(documentation|training|onboarding|enablement|guide|quick reference|user support)\b/.test(text)) return "documentation_training";
  return "general_positioning";
}

function getFallbackSuggestions(gapText = "") {
  const category = getMitigationCategory(gapText);
  return {
    uat_validation: ["Mention testing, validation, or rollout support from implementation projects."],
    itsm_ticketing: ["Position Jira workflow coordination as intake-tracking experience."],
    platform_familiarity: ["Reference similar ERP, CRM, or workflow tools already used."],
    seniority_framing: ["Position yourself as hands-on and execution-focused."],
    documentation_training: ["Highlight onboarding documentation and quick-reference guide creation."],
    general_positioning: [],
  }[category] || [];
}

function dedupePlanItems(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.category}-${item.appliedLabel}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildPlanSummary(items = []) {
  if (!items.length) return "";
  const labels = items.map((item) => item.appliedLabel.toLowerCase());
  return `Use the analysis to ${labels.slice(0, 4).join(", ")}.`;
}

function getGapText(gap) {
  if (typeof gap === "string") return gap;
  return gap?.gap || gap?.text || "";
}

function normalizeSuggestionItems(value) {
  return normalizeArray(value)
    .map((item) => (typeof item === "string" ? item : item?.suggestion || item?.text || item?.label || item?.content || ""))
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function normalizeSeverity(value) {
  return ["critical", "moderate", "minor", "informational"].includes(value) ? value : "moderate";
}

function normalizeConfidence(value) {
  return ["strong", "partial", "missing"].includes(value) ? value : "partial";
}

function inferSeverity(gap = "") {
  if (/\b(certification|required license|no relevant experience|no customer-facing|no onboarding)\b/i.test(gap)) return "critical";
  if (/\b(ITSM|service\s*desk|ownership|industry-specific|workflow experience)\b/i.test(gap)) return "moderate";
  if (/\b(BuildOps|Sage\s*Intacct|Smartsheet|UAT|platform|tool)\b/i.test(gap)) return "minor";
  if (/\b(junior|senior|startup|enterprise|environment|pace)\b/i.test(gap)) return "informational";
  return "moderate";
}

function normalizeText(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slug(value = "") {
  return normalizeText(value).replace(/\s+/g, "-");
}
