const STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "your",
  "their",
  "have",
  "has",
  "was",
  "were",
  "are",
  "but",
  "not",
  "role",
  "job",
]);

export function assessRewriteRestraint(originalText = "", generatedText = "") {
  const originalTerms = getSignificantTerms(originalText);
  const generated = normalizeText(generatedText);
  if (!originalTerms.length || !generated) {
    return {
      preservedStrengths: [],
      rewrittenAreas: [],
      preservationScore: 0,
    };
  }

  const preservedStrengths = originalTerms.filter((term) => generated.includes(term)).slice(0, 8);
  const rewrittenAreas = getRewriteAreas(generatedText);
  const preservationScore = Math.min(94, Math.max(62, Math.round((preservedStrengths.length / Math.min(originalTerms.length, 18)) * 100)));

  return {
    preservedStrengths,
    rewrittenAreas,
    preservationScore,
  };
}

function getRewriteAreas(text = "") {
  const normalized = normalizeText(text);
  return [
    normalized.includes("validation") || normalized.includes("rollout") ? "rollout validation" : "",
    normalized.includes("escalation") || normalized.includes("intake") ? "intake/escalation" : "",
    normalized.includes("documentation") || normalized.includes("training") ? "documentation/training" : "",
    normalized.includes("workflow") || normalized.includes("systems") ? "systems/workflow framing" : "",
  ].filter(Boolean);
}

function getSignificantTerms(text = "") {
  const counts = new Map();
  normalizeText(text)
    .split(/\s+/)
    .filter((term) => term.length > 4 && !STOP_WORDS.has(term))
    .forEach((term) => counts.set(term, (counts.get(term) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term)
    .slice(0, 24);
}

function normalizeText(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9+/#.-]+/g, " ").trim();
}
