import { buildMitigationPlan } from "./mitigationPlan.js";
import { buildMaterialRecoveryScores, estimateOptimizedFit } from "./rewriteInsights.js";
import { assessRewriteRestraint } from "./rewriteRestraint.js";

export function calculateApplicationReadiness({
  score,
  profile,
  resume,
  coverLetter,
  recruiterMessage,
  rewriteSections = [],
} = {}) {
  const mitigationPlan = buildMitigationPlan(score);
  const materials = { resume, coverLetter, message: recruiterMessage };
  const recoveryScores = buildMaterialRecoveryScores({ mitigationPlan, materials, rewriteSections });
  const generatedText = [resume?.content, coverLetter?.content, recruiterMessage?.content].filter(Boolean).join("\n");
  const restraint = assessRewriteRestraint(profile?.base_resume_text || "", resume?.content || generatedText);
  const optimizedFit = estimateOptimizedFit({ baselineScore: score?.score, recoveryScores, rewriteSections, keywords: score?.keywords, generatedText });
  const baseFit = Number(score?.score) || 0;
  const recoveryAverage = recoveryScores.length ? recoveryScores.reduce((sum, item) => sum + item.score, 0) / recoveryScores.length : 0;
  const keywordCoverage = getKeywordCoverage(score?.keywords, generatedText);
  const readability = getReadabilityMetrics(resume?.content || generatedText);
  const severePenalty = getSeverityPenalty(mitigationPlan.items);
  const materialBonus = [resume, coverLetter, recruiterMessage].filter(Boolean).length * 3;

  const rawReadiness = Math.round(
    baseFit * 0.46 +
    recoveryAverage * 9 +
    keywordCoverage * 12 +
    readability.score * 0.16 +
    Math.min(8, materialBonus) +
    Math.min(8, restraint.preservationScore * 0.08) -
    severePenalty,
  );
  const readinessFloor = getFitBasedReadinessFloor(baseFit, materialBonus);
  const readiness = clamp(Math.max(rawReadiness, readinessFloor), 42, 96);

  const strongestSignal = getStrongestSignal({ score, profile, generatedText });
  const biggestConsideration = getBiggestConsideration(mitigationPlan.items);

  return {
    readiness,
    tier: getReadinessTier(readiness),
    strongestSignal,
    biggestConsideration,
    recruiterSkimReadability: getRecruiterSkimReadability(readability.score),
    interviewLikelihood: getInterviewLikelihood({ readiness, fitScore: optimizedFit?.optimized || baseFit, recoveryAverage }),
    optimizedFit,
    recoveryHighlights: recoveryScores.filter((item) => item.score >= 2).slice(0, 3).map((item) => item.label),
    metrics: {
      recoveryAverage,
      keywordCoverage,
      readabilityScore: readability.score,
      preservationScore: restraint.preservationScore,
    },
  };
}

export function getReadinessTier(readiness = 0) {
  if (readiness >= 88) return "Ready to apply";
  if (readiness >= 78) return "Recruiter-ready";
  if (readiness >= 66) return "Strong operational alignment";
  if (readiness >= 54) return "Operationally competitive";
  return "Emerging alignment";
}

export function getInterviewLikelihood({ readiness = 0, fitScore = 0, recoveryAverage = 0 } = {}) {
  const value = readiness * 0.55 + fitScore * 0.35 + recoveryAverage * 5;
  if (value >= 86) return "Strong interview outlook";
  if (value >= 76) return "Above-average outlook";
  if (value >= 64) return "Competitive outlook";
  if (value >= 50) return "Possible interview path";
  return "Limited interview outlook";
}

function getRecruiterSkimReadability(score) {
  if (score >= 86) return "Excellent";
  if (score >= 72) return "Strong";
  if (score >= 55) return "Fair";
  return "Weak";
}

function getFitBasedReadinessFloor(fitScore, materialBonus) {
  const score = Number(fitScore) || 0;
  const materialsGenerated = materialBonus > 0;
  if (score >= 88) return materialsGenerated ? 82 : 72;
  if (score >= 78) return materialsGenerated ? 72 : 64;
  if (score >= 68) return materialsGenerated ? 62 : 54;
  return 42;
}

function getReadabilityMetrics(text = "") {
  const lines = String(text).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const bulletLines = lines.filter((line) => /^[-•*]/.test(line) || /:/.test(line));
  const averageLineLength = lines.length ? lines.reduce((sum, line) => sum + line.length, 0) / lines.length : 120;
  const sectionSignals = ["summary", "skills", "experience", "education", "tools"].filter((term) => new RegExp(term, "i").test(text)).length;
  const conciseScore = averageLineLength < 110 ? 28 : averageLineLength < 150 ? 20 : 12;
  const bulletScore = Math.min(28, bulletLines.length * 3);
  const sectionScore = Math.min(24, sectionSignals * 5);
  const scanScore = lines.length > 8 ? 20 : 12;
  return { score: clamp(conciseScore + bulletScore + sectionScore + scanScore, 20, 96) };
}

function getKeywordCoverage(keywords = [], text = "") {
  const normalized = normalizeText(text);
  const items = Array.isArray(keywords) ? keywords : [];
  if (!items.length || !normalized) return 0;
  const hits = items.filter((keyword) => {
    const value = normalizeText(keyword);
    return value && normalized.includes(value);
  }).length;
  return hits / Math.max(1, items.length);
}

function getSeverityPenalty(items = []) {
  return items.reduce((sum, item) => {
    if (item.severity === "critical") return sum + 9;
    if (item.severity === "moderate") return sum + 4;
    return sum;
  }, 0);
}

function getStrongestSignal({ score, profile, generatedText = "" } = {}) {
  const combined = normalizeText(`${generatedText} ${(score?.strengths || []).join(" ")} ${profile?.base_resume_text || ""}`);
  const signals = [
    ["ERP integration experience", ["erp", "integration", "banner", "peoplesoft", "sap", "oracle"]],
    ["SaaS implementation depth", ["saas", "implementation", "rollout", "go live", "configuration"]],
    ["onboarding ownership", ["onboarding", "training", "enablement", "adoption"]],
    ["documentation/training experience", ["documentation", "guide", "training", "quick reference"]],
    ["cross-functional coordination", ["stakeholder", "cross functional", "client", "collaboration"]],
  ];
  return signals.find(([, terms]) => terms.some((term) => combined.includes(term)))?.[0] || score?.strengths?.[0] || "transferable operational experience";
}

function getBiggestConsideration(items = []) {
  const sorted = [...items].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const item = sorted[0];
  if (!item) return "no major unresolved consideration";
  if (item.category === "platform_familiarity") return "vendor-specific platform familiarity";
  if (item.category === "uat_validation") return "direct UAT ownership";
  if (item.category === "seniority_framing") return "seniority framing";
  if (item.category === "itsm_ticketing") return "direct intake or service-desk ownership";
  return item.gapText || item.appliedLabel;
}

function severityRank(value) {
  return { critical: 0, moderate: 1, minor: 2, informational: 3 }[value] ?? 4;
}

function normalizeText(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9+/#.-]+/g, " ").trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
