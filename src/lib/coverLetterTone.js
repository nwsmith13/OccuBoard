export const COVER_LETTER_TONES = [
  {
    value: "professional",
    label: "Professional",
    description: "Polished business writing for corporate and traditional roles.",
  },
  {
    value: "startup",
    label: "Startup",
    description: "Direct, high-agency writing for founders, operators, and early-stage teams.",
  },
  {
    value: "conversational",
    label: "Conversational",
    description: "Warm, natural writing with a less formal structure.",
  },
];

export function normalizeCoverLetterTone(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return COVER_LETTER_TONES.some((tone) => tone.value === normalized) ? normalized : "professional";
}

export function getRecommendedCoverLetterTone(job = {}) {
  const title = String(job?.job_title || "").toLowerCase();
  const description = String(job?.job_description || "").toLowerCase();
  const combined = `${title}\n${description}`;
  const strongTitleSignal = /\b(founder'?s?\s+associate|founding\s+(?:team|operator|associate)|chief\s+of\s+staff|startup\s+operator|business\s+operator|generalist)\b/.test(title);
  const startupSignals = [
    /\bearly[-\s]?stage\b/,
    /\bseed[-\s]?(?:stage|funded)?\b/,
    /\bseries\s+[abc]\b/,
    /\bzero[-\s]?to[-\s]?one\b|\b0[-\s]?to[-\s]?1\b/,
    /\bhigh[-\s]?agency\b/,
    /\bwear\s+many\s+hats\b/,
    /\bbuild(?:ing)?\s+from\s+scratch\b/,
    /\bfounding\s+team\b/,
    /\bmove\s+fast\b/,
    /\bambiguity\b/,
  ].filter((pattern) => pattern.test(combined)).length;

  return strongTitleSignal || startupSignals >= 2 ? "startup" : "professional";
}
