export function normalizeInterviewPrepContent(rawContent = {}) {
  const content = parseJsonObject(rawContent);
  const nested = parseJsonObject(content.content);
  const source = hasInterviewPrepContentSignals(nested) ? nested : content;
  return {
    ...source,
    preparationLevel: source.preparationLevel || (hasInterviewPrepContentSignals(source) ? "Ready" : "Not started"),
    focusAreas: normalizeArray(source.focusAreas),
    questions: normalizeArray(source.questions || source.likelyQuestions),
    talkingPoints: normalizeArray(source.talkingPoints),
    starStories: normalizeArray(source.starStories || source.stories),
    questionsToAsk: normalizeArray(source.questionsToAsk),
    thankYouMessage: typeof source.thankYouMessage === "string" ? source.thankYouMessage : "",
  };
}

export function normalizeInterviewPrepRecord(record) {
  if (!record) return null;
  return {
    ...record,
    content: normalizeInterviewPrepContent(record.content),
    practiced_questions: normalizeArray(record.practiced_questions),
    answer_notes: parseJsonObject(record.answer_notes),
  };
}

export function hasValidInterviewPrep(record) {
  if (!record) return false;
  return hasValidInterviewPrepContent(normalizeInterviewPrepContent(record.content));
}

export function hasValidInterviewPrepContent(content = {}) {
  const normalized = normalizeInterviewPrepContent(content);
  return hasInterviewPrepContentSignals(normalized);
}

function hasInterviewPrepContentSignals(content = {}) {
  return Boolean(
    (Array.isArray(content.questions) && content.questions.length) ||
    (Array.isArray(content.talkingPoints) && content.talkingPoints.length) ||
    (Array.isArray(content.starStories) && content.starStories.length) ||
    (Array.isArray(content.focusAreas) && content.focusAreas.length) ||
    (Array.isArray(content.questionsToAsk) && content.questionsToAsk.length) ||
    String(content.thankYouMessage || "").trim(),
  );
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value : {};
}
