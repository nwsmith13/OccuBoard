const semanticToolGroups = {
  ticketing_systems: {
    label: "ticketing / ITSM systems",
    terms: [
      "Jira",
      "Jira Service Desk",
      "Jira Service Management",
      "Zendesk",
      "Freshdesk",
      "ServiceNow",
      "HubSpot Service Hub",
      "ticket queue",
      "support queue",
      "intake queue",
      "escalation workflow",
      "case management",
      "ITSM",
      "service desk",
      "ticket lifecycle",
    ],
    directContext: ["service desk", "ITSM", "ticket queue", "support queue", "intake queue", "ticket lifecycle", "case management"],
  },
  crm_systems: {
    label: "CRM systems",
    terms: ["Salesforce", "HubSpot", "Podio", "Zoho", "Dynamics", "Microsoft Dynamics"],
    directContext: ["CRM", "pipeline", "account management", "contact management"],
  },
  erp_systems: {
    label: "ERP systems",
    terms: ["Banner", "PeopleSoft", "NetSuite", "Sage Intacct", "SAP", "Oracle ERP", "ERP"],
    directContext: ["ERP", "finance system", "student information system", "integration"],
  },
  project_management: {
    label: "project management tools",
    terms: ["Jira", "Asana", "Monday", "Monday.com", "ClickUp", "Trello", "Smartsheet"],
    directContext: ["project tracking", "task tracking", "workflow coordination", "project coordination"],
  },
};

export function getEvidenceMatches({ resumeText = "", jobDescription = "" } = {}) {
  return Object.entries(semanticToolGroups)
    .map(([category, group]) => {
      const resumeTerms = getMatchedTerms(resumeText, group.terms);
      const jobTerms = getMatchedTerms(jobDescription, group.terms);
      const jobContext = getMatchedTerms(jobDescription, group.directContext);
      const resumeContext = getMatchedTerms(resumeText, group.directContext);
      const requestedTerms = uniqueTerms([...jobTerms, ...jobContext]);

      if (!requestedTerms.length && !jobMentionsCategory(jobDescription, category)) return null;

      const matchedTerms = uniqueTerms([...resumeTerms, ...resumeContext]);
      const missingTerms = requestedTerms.filter((term) => !termInList(term, matchedTerms));
      const confidence = getConfidence({ category, matchedTerms, missingTerms, resumeTerms, resumeContext, requestedTerms });

      return {
        category,
        label: group.label,
        confidence,
        matchedTerms,
        missingTerms,
        explanation: getExplanation(category, confidence, matchedTerms, missingTerms),
      };
    })
    .filter(Boolean);
}

export function buildEvidencePromptNotes(profile = {}, job = {}) {
  const evidence = getEvidenceMatches({
    resumeText: profile.base_resume_text,
    jobDescription: job.job_description,
  });
  if (!evidence.length) return "";

  const lines = evidence.map((item) => {
    const matched = item.matchedTerms.length ? item.matchedTerms.join(", ") : "none";
    const missing = item.missingTerms.length ? item.missingTerms.join(", ") : "none";
    return `- ${item.label}: ${item.confidence}; matched evidence: ${matched}; requested/missing detail: ${missing}; note: ${item.explanation}`;
  });

  return `
Evidence confidence pre-check:
${lines.join("\n")}

Use this pre-check to avoid false negatives:
- strong evidence: treat as a clear strength when relevant.
- partial evidence: do not say the skill/tool area is absent; describe the adjacent evidence and the specific missing depth.
- missing evidence: describe as a gap only when no direct or adjacent evidence is present.
`;
}

export function refineFitAnalysisEvidence(result = {}, profile = {}, job = {}) {
  const evidence = getEvidenceMatches({
    resumeText: profile.base_resume_text,
    jobDescription: job.job_description,
  });
  if (!evidence.length || !result) return result;

  const next = {
    ...result,
    strengths: Array.isArray(result.strengths) ? [...result.strengths] : [],
    gaps: Array.isArray(result.gaps) ? [...result.gaps] : [],
  };

  evidence.forEach((item) => {
    if (item.category === "ticketing_systems" && item.confidence === "partial") {
      next.gaps = replaceHardNegativeGap(
        next.gaps,
        /\b(no|not|without|lacks?|missing)\b.*\b(ticket|ticketing|itsm|service\s*desk|zendesk|servicenow)\b|\b(ticket|ticketing|itsm|service\s*desk|zendesk|servicenow)\b.*\b(no|not|without|lacks?|missing)\b/i,
        "Limited direct ITSM/service-desk evidence. Jira experience is present, though support intake and ticket lifecycle workflows are not heavily emphasized."
      );
      addUniqueSignal(next.strengths, "Jira and workflow coordination suggest transferable intake-tracking experience.");
    }

    if (item.category === "erp_systems" && ["strong", "partial"].includes(item.confidence)) {
      addUniqueSignal(next.strengths, "ERP integration work implies operational systems coordination familiarity.");
    }
  });

  return next;
}

function getConfidence({ category, matchedTerms, missingTerms, resumeTerms, resumeContext, requestedTerms }) {
  if (!matchedTerms.length) return "missing";
  const matchedRequested = requestedTerms.some((term) => termInList(term, matchedTerms));
  if (matchedRequested && (resumeTerms.length >= 2 || resumeContext.length)) return "strong";
  if (category === "ticketing_systems" && resumeTerms.some((term) => /^jira$/i.test(term)) && !resumeContext.length) return "partial";
  if (missingTerms.length) return "partial";
  return "strong";
}

function getExplanation(category, confidence, matchedTerms, missingTerms) {
  if (confidence === "strong") return `${matchedTerms.join(", ")} provides direct evidence for this requirement.`;
  if (confidence === "missing") return "No direct or adjacent evidence was found in the resume/profile.";
  if (category === "ticketing_systems" && matchedTerms.some((term) => /^jira$/i.test(term))) {
    return "Jira is present, but explicit service desk or ITSM workflow ownership is not strongly described.";
  }
  return `${matchedTerms.join(", ")} provides adjacent evidence, while ${missingTerms.join(", ") || "some requested depth"} is not strongly described.`;
}

function replaceHardNegativeGap(gaps, pattern, replacement) {
  let replaced = false;
  const next = gaps.map((gap) => {
    if (!replaced && pattern.test(gap)) {
      replaced = true;
      return replacement;
    }
    return gap;
  });
  if (!replaced && !next.some((gap) => /ITSM|service-desk|Jira/i.test(gap))) next.push(replacement);
  return next;
}

function addUniqueSignal(items, signal) {
  if (!items.some((item) => normalize(item).includes(normalize(signal).slice(0, 28)))) items.push(signal);
}

function getMatchedTerms(text = "", terms = []) {
  return uniqueTerms(terms.filter((term) => termMatches(text, term)));
}

function termMatches(text = "", term = "") {
  const normalizedText = normalize(text);
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedTerm).replace(/\\ /g, "\\s+")}([^a-z0-9]|$)`, "i").test(normalizedText);
}

function jobMentionsCategory(text = "", category = "") {
  const normalizedText = normalize(text);
  if (category === "ticketing_systems") return /\b(ticket|ticketing|itsm|service\s*desk|support\s*queue|intake\s*queue)\b/i.test(normalizedText);
  if (category === "crm_systems") return /\bcrm\b/i.test(normalizedText);
  if (category === "erp_systems") return /\berp\b/i.test(normalizedText);
  if (category === "project_management") return /\b(project|task|workflow)\s+(management|tracking|coordination)\b/i.test(normalizedText);
  return false;
}

function uniqueTerms(terms = []) {
  const seen = new Set();
  return terms.filter((term) => {
    const key = normalize(term);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function termInList(term, list) {
  const normalizedTerm = normalize(term);
  return list.some((item) => normalize(item) === normalizedTerm);
}

function normalize(value = "") {
  return String(value).toLowerCase().replace(/[^\w.+#-]+/g, " ").trim();
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
