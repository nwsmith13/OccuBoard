import { buildMitigationPlan } from "./mitigationPlan.js";

const CATEGORY_DEFINITIONS = {
  intake_escalation: {
    label: "Operational Support Alignment",
    patterns: [/\bintake\b/i, /\bescalation/i, /\bissue tracking\b/i, /\bticket/i, /\bworkflow follow-through\b/i],
    sourceCategories: ["itsm_ticketing"],
    whyItHelps: "Improves alignment with support intake, escalation handling, and workflow coordination responsibilities.",
    impactLevel: "high",
  },
  uat_rollout: {
    label: "Rollout Validation Framing",
    patterns: [/\buat\b/i, /\bvalidation\b/i, /\bgo-live\b/i, /\bgo live\b/i, /\brollout/i, /\bacceptance\b/i, /\breadiness\b/i],
    sourceCategories: ["uat_validation"],
    whyItHelps: "Better reflects rollout validation and implementation-readiness responsibilities commonly expected in operational systems roles.",
    impactLevel: "high",
  },
  onboarding_support: {
    label: "Onboarding Support",
    patterns: [/\bonboarding\b/i, /\buser support\b/i, /\bcustomer support\b/i, /\badoption\b/i, /\benablement\b/i],
    sourceCategories: ["documentation_training"],
    whyItHelps: "Connects existing onboarding and support experience to the role's practical user-facing expectations.",
    impactLevel: "medium",
  },
  systems_adaptability: {
    label: "Systems Adaptability",
    patterns: [/\berp\b/i, /\bcrm\b/i, /\bworkflow tools?\b/i, /\boperational systems?\b/i, /\bplatform/i, /\bramp/i],
    sourceCategories: ["platform_familiarity"],
    whyItHelps: "Shows transferable experience across operational systems without overstating direct product expertise.",
    impactLevel: "medium",
  },
  operational_support: {
    label: "Hands-on Operations",
    patterns: [/\bhands-on\b/i, /\boperational\b/i, /\bcoordination\b/i, /\bfollow-through\b/i, /\btroubleshooting\b/i],
    sourceCategories: ["seniority_framing", "general_positioning"],
    whyItHelps: "Keeps positioning practical and execution-oriented for operational hiring expectations.",
    impactLevel: "medium",
  },
  documentation_enablement: {
    label: "Documentation Enablement",
    patterns: [/\bdocumentation\b/i, /\btraining\b/i, /\bguide\b/i, /\bquick-reference\b/i, /\benablement\b/i],
    sourceCategories: ["documentation_training"],
    whyItHelps: "Highlights user enablement and documentation work that can reduce ramp time and improve adoption.",
    impactLevel: "medium",
  },
  cross_functional_coordination: {
    label: "Cross-functional Coordination",
    patterns: [/\bcross-functional\b/i, /\bstakeholder/i, /\bclient/i, /\bcollaborat/i, /\bcommunication\b/i],
    sourceCategories: ["general_positioning"],
    whyItHelps: "Reinforces coordination across customers, technical teams, and implementation stakeholders.",
    impactLevel: "medium",
  },
  seniority_softening: {
    label: "Hands-on Role Framing",
    patterns: [/\bhands-on\b/i, /\bexecution-focused\b/i, /\bpractical\b/i, /\bsupport coordination\b/i],
    sourceCategories: ["seniority_framing"],
    whyItHelps: "Keeps positioning hands-on and execution-oriented for coordinator-level hiring expectations.",
    impactLevel: "low",
  },
};

const MODE_LIMITS = {
  resume: 4,
  coverLetter: 3,
  message: 2,
};

export function buildRewriteInsights({
  originalText = "",
  generatedText = "",
  mitigationPlan,
  analysis = {},
  gaps = [],
  strengths = [],
  keywords = [],
  materialType = "resume",
} = {}) {
  const plan = mitigationPlan?.items?.length ? mitigationPlan : buildMitigationPlan({ ...analysis, gaps });
  const generated = normalizeText(generatedText);
  if (!generated || !plan.items?.length) return { sections: [] };

  const contextText = normalizeText([
    generatedText,
    plan.items.map((item) => `${item.category} ${item.gapText} ${item.strategy}`).join(" "),
    normalizeArray(gaps).join(" "),
    normalizeArray(strengths).join(" "),
    normalizeArray(keywords).join(" "),
  ].join(" "));

  const sections = Object.entries(CATEGORY_DEFINITIONS)
    .map(([category, definition]) => {
      const mitigationSource = findMitigationSource(plan, definition.sourceCategories);
      const after = findSentence(generatedText, definition.patterns);
      if (!after || !mitigationSource) return null;
      const wasAlreadyEmphasized = definition.patterns.some((pattern) => pattern.test(originalText));
      const hasContext = definition.patterns.some((pattern) => pattern.test(contextText));
      if (!hasContext || (wasAlreadyEmphasized && !isMeaningfullyExpanded(originalText, generatedText, definition.patterns))) return null;
      return {
        id: `${category}-${mitigationSource.id}`,
        category,
        title: definition.label,
        whyItHelps: definition.whyItHelps,
        confidence: getConfidence(mitigationSource, wasAlreadyEmphasized),
        before: findSentence(originalText, getBeforePatterns(category)) || "Not emphasized in the base resume wording.",
        after,
        mitigationSource: mitigationSource.appliedLabel,
        impactLevel: definition.impactLevel,
      };
    })
    .filter(Boolean)
    .sort((a, b) => impactRank(b.impactLevel) - impactRank(a.impactLevel) || confidenceRank(b.confidence) - confidenceRank(a.confidence))
    .slice(0, MODE_LIMITS[materialType] || 3);

  return { sections };
}

export function buildGapRecovery({ mitigationPlan, rewriteSections = [], generatedText = "" } = {}) {
  if (!mitigationPlan?.items?.length) return [];
  const generated = normalizeText(generatedText);
  return mitigationPlan.items.map((item) => {
    const related = rewriteSections.filter((section) => section.mitigationSource === item.appliedLabel);
    const hasDirectContent = categoryTerms(item.category).some((term) => generated.includes(term));
    const score = getRecoveryScore({ item, relatedSections: related, hasDirectContent, coverageCount: hasDirectContent ? 1 : 0 });
    return {
      gapId: item.id,
      label: item.appliedLabel,
      score,
      recovery: getRecoveryLabel(score),
    };
  });
}

export function buildMaterialRecoveryScores({ mitigationPlan, materials = {}, rewriteSections = [] } = {}) {
  if (!mitigationPlan?.items?.length) return [];
  return mitigationPlan.items.map((item) => {
    const coverage = {
      resume: materialHasMitigation(materials.resume, item) || materialContainsTerms(materials.resume, item.category),
      coverLetter: materialHasMitigation(materials.coverLetter, item) || materialContainsTerms(materials.coverLetter, item.category),
      recruiterMessage: materialHasMitigation(materials.message, item) || materialContainsTerms(materials.message, item.category),
    };
    const coverageCount = Object.values(coverage).filter(Boolean).length;
    const related = rewriteSections.filter((section) => section.mitigationSource === item.appliedLabel);
    const hasDirectContent = Object.values(materials).some((material) => materialContainsTerms(material, item.category));
    const score = getRecoveryScore({ item, relatedSections: related, hasDirectContent, coverageCount });
    return {
      gapId: item.id,
      label: item.appliedLabel,
      category: item.category,
      confidence: getRecoveryConfidence(item, score),
      coverage,
      score,
      recovery: getRecoveryLabel(score),
    };
  });
}

export function estimateOptimizedFit({ baselineScore = 0, recoveryScores = [], rewriteSections = [], keywords = [], generatedText = "" } = {}) {
  const baseline = Number(baselineScore) || 0;
  if (!baseline || !recoveryScores.length) return null;
  const recoveryLift = Math.min(6, Math.round(recoveryScores.reduce((sum, item) => sum + item.score, 0) / 2));
  const rewriteLift = Math.min(3, rewriteSections.filter((item) => item.impactLevel === "high").length + Math.floor(rewriteSections.length / 2));
  const keywordLift = Math.min(2, countKeywordHits(keywords, generatedText));
  const delta = Math.max(1, Math.min(10, recoveryLift + rewriteLift + keywordLift));
  return {
    initial: baseline,
    optimized: Math.min(99, baseline + delta),
    delta,
  };
}

function findMitigationSource(plan, sourceCategories = []) {
  return plan.items.find((item) => sourceCategories.includes(item.category));
}

function getConfidence(source, wasAlreadyEmphasized) {
  if (source.severity === "critical" || source.severity === "moderate") return wasAlreadyEmphasized ? "moderate" : "strong";
  if (source.confidence === "missing") return "partial";
  return "moderate";
}

function getRecoveryScore({ item, relatedSections = [], hasDirectContent = false, coverageCount = 0 }) {
  let score = 0;
  if (coverageCount > 0) score += Math.min(2, coverageCount);
  if (hasDirectContent) score += 1;
  if (relatedSections.some((section) => section.confidence === "strong")) score += 1;
  if (item.confidence === "strong" && score > 0) score += 1;
  if (item.severity === "minor" && score > 3) score = 3;
  return Math.max(0, Math.min(4, score));
}

function getRecoveryLabel(score) {
  return ["Unaddressed", "Partial recovery", "Moderate recovery", "Strong recovery", "Fully addressed"][score] || "Unaddressed";
}

function getRecoveryConfidence(item, score) {
  if (score >= 3 && item.confidence !== "missing") return "High confidence";
  if (score >= 2) return "Moderate confidence";
  return "Low confidence";
}

function materialHasMitigation(material, item) {
  const mitigations = normalizeArray(material?.appliedMitigations ?? material?.applied_mitigations);
  return mitigations.some((entry) => entry?.gapId === item.id || entry?.appliedLabel === item.appliedLabel || entry?.applied_label === item.appliedLabel);
}

function materialContainsTerms(material, category) {
  const text = normalizeText(material?.content || material?.coverLetterText || "");
  return Boolean(text) && categoryTerms(category).some((term) => text.includes(term));
}

function countKeywordHits(keywords = [], generatedText = "") {
  const generated = normalizeText(generatedText);
  return normalizeArray(keywords).filter((keyword) => {
    const value = normalizeText(keyword);
    return value && generated.includes(value);
  }).length;
}

function getBeforePatterns(category) {
  if (category === "uat_rollout") return [/\bimplementation\b/i, /\blaunch\b/i, /\bonboarding\b/i];
  if (category === "intake_escalation") return [/\bjira\b/i, /\bworkflow\b/i, /\bsupport\b/i, /\bissue\b/i];
  if (category === "systems_adaptability") return [/\berp\b/i, /\bcrm\b/i, /\bpodio\b/i, /\bjira\b/i, /\basana\b/i, /\bpeopleSoft\b/i, /\bbanner\b/i];
  if (category === "documentation_enablement") return [/\bdocumentation\b/i, /\btraining\b/i, /\bguide\b/i];
  return CATEGORY_DEFINITIONS[category]?.patterns || [];
}

function findSentence(text = "", patterns = []) {
  const sentences = splitSentences(text);
  return sentences.find((sentence) => patterns.some((pattern) => pattern.test(sentence))) || "";
}

function splitSentences(text = "") {
  return String(text)
    .replace(/\n+/g, ". ")
    .split(/(?<=[.!?])\s+|(?:\s+-\s+)/)
    .map((item) => item.trim())
    .filter((item) => item.length > 18)
    .slice(0, 80);
}

function isMeaningfullyExpanded(originalText, generatedText, patterns) {
  const originalMatches = patterns.filter((pattern) => pattern.test(originalText)).length;
  const generatedMatches = patterns.filter((pattern) => pattern.test(generatedText)).length;
  return generatedMatches > originalMatches;
}

function categoryTerms(category) {
  return {
    uat_validation: ["validation", "rollout", "go live", "go-live", "readiness"],
    itsm_ticketing: ["intake", "escalation", "ticket", "issue tracking"],
    platform_familiarity: ["erp", "crm", "workflow", "platform", "systems"],
    seniority_framing: ["hands-on", "practical", "execution"],
    documentation_training: ["documentation", "training", "enablement", "guide"],
    general_positioning: ["coordination", "support", "workflow"],
  }[category] || [];
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function normalizeText(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9+/#.-]+/g, " ").trim();
}

function impactRank(value) {
  return { high: 3, medium: 2, low: 1 }[value] || 0;
}

function confidenceRank(value) {
  return { strong: 3, moderate: 2, partial: 1 }[value] || 0;
}
