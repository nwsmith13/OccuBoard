const sectionHeaders = [
  "PROFESSIONAL SUMMARY",
  "SUMMARY",
  "CORE SKILLS",
  "SKILLS",
  "PROFESSIONAL EXPERIENCE",
  "EXPERIENCE",
  "WORK EXPERIENCE",
  "TOOLS & TECHNOLOGIES",
  "TECHNOLOGIES",
  "EDUCATION",
  "CERTIFICATIONS",
  "PROJECTS",
];

const knownEmployerNames = [
  "ARSO Solutions Lab",
  "TouchNet Information Systems",
  "Sock101",
];

const roleTitleWords = [
  "Founder",
  "Owner",
  "Consultant",
  "Manager",
  "Engineer",
  "Specialist",
  "Coordinator",
  "Analyst",
  "Representative",
  "Director",
  "Lead",
  "Administrator",
  "Associate",
];

const toolLabels = [
  "CRM Systems",
  "Systems & Data",
  "Project Tools",
  "Microsoft Office / Google Workspace",
];

export function normalizeResumeText(text = "") {
  return finalSpacingCleanup(
    formatEducation(
      formatToolSections(
        normalizeBullets(
          separateEmployers(
            cleanupOrphanLines(
              joinSplitRoleDateLines(
                joinWrappedLines(
                  addSectionSpacing(
                    repairSplitSectionHeaders(
                      normalizeWhitespace(text),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

export function getResumeSectionBlocks(text = "") {
  const normalized = normalizeResumeText(text);
  const blocks = [];
  let current = { title: "HEADER", content: [] };

  normalized.split("\n").forEach((line) => {
    if (isSectionHeader(line)) {
      if (current.content.length) blocks.push({ ...current, content: current.content.join("\n").trim() });
      current = { title: line.trim().toUpperCase(), content: [] };
      return;
    }
    current.content.push(line);
  });

  if (current.content.length) blocks.push({ ...current, content: current.content.join("\n").trim() });
  return blocks.filter((block) => block.content);
}

function normalizeWhitespace(text = "") {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2022\u25cf\u25aa\u25e6]/g, "\n- ")
    .replace(/â€¢|â—|â–ª|â—¦|Ã¢â‚¬Â¢|Ã¢â€”Â|Ã¢â€“Âª|Ã¢â€”Â¦/g, "\n- ")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

function repairSplitSectionHeaders(text) {
  const repairs = [
    ["PROFESSIONAL", "SUMMARY", "PROFESSIONAL SUMMARY"],
    ["CORE", "SKILLS", "CORE SKILLS"],
    ["PROFESSIONAL", "EXPERIENCE", "PROFESSIONAL EXPERIENCE"],
    ["WORK", "EXPERIENCE", "WORK EXPERIENCE"],
    ["TOOLS\\s*&", "TECHNOLOGIES", "TOOLS & TECHNOLOGIES"],
    ["TOOLS", "&\\s*TECHNOLOGIES", "TOOLS & TECHNOLOGIES"],
  ];

  return repairs.reduce((current, [first, second, replacement]) => {
    const pattern = new RegExp(`\\b${first}\\s*(?:\\n|\\s)+\\s*${second}\\b`, "gi");
    return current.replace(pattern, replacement);
  }, text);
}

function addSectionSpacing(text) {
  let normalized = text;
  const multiWordHeaders = sectionHeaders.filter((header) => header.includes(" "));
  const singleWordHeaders = sectionHeaders.filter((header) => !header.includes(" "));

  multiWordHeaders.forEach((header) => {
    const pattern = new RegExp(`\\b${escapeRegex(header).replace(/\\ /g, "\\s+")}\\b\\s*:?`, "gi");
    normalized = normalized.replace(pattern, `\n\n${header}\n`);
  });

  singleWordHeaders.forEach((header) => {
    const standalonePattern = new RegExp(`(^|\\n)\\s*${header}\\s*:?\\s*(?=\\n|$)`, "gi");
    normalized = normalized.replace(standalonePattern, `\n\n${header}\n`);
  });

  ["EDUCATION", "CERTIFICATIONS", "PROJECTS"].forEach((header) => {
    const inlinePattern = new RegExp(`\\b${header}\\b\\s*:?`, "g");
    normalized = normalized.replace(inlinePattern, `\n\n${header}\n`);
  });

  return normalized;
}

function joinWrappedLines(text) {
  const lines = text.split("\n").map((line) => line.trim());
  const output = [];

  lines.forEach((line) => {
    if (!line) {
      if (output[output.length - 1] !== "") output.push("");
      return;
    }

    const previous = output[output.length - 1];
    if (previous && shouldJoin(previous, line)) {
      output[output.length - 1] = `${previous} ${line}`.replace(/\s+/g, " ");
      return;
    }

    output.push(line);
  });

  return output.join("\n");
}

function shouldJoin(previous, next) {
  if (!previous || !next) return false;
  if (isSectionHeader(previous) || isSectionHeader(next)) return false;
  if (isDateLine(previous) || isDateLine(next)) return false;
  if (looksLikeEmployerLine(previous) || looksLikeEmployerLine(next)) return false;
  if (/^[A-Z0-9&/.-]{2,8}$/.test(previous)) return false;
  if (next.startsWith("- ")) return false;
  if (previous.startsWith("- ")) return !/[.!?:;]$/.test(previous) && !looksLikeEmployerLine(next);
  if (/[.!?:;]$/.test(previous)) return false;
  if (/^[a-z(]/.test(next)) return true;
  if (previous.length < 34 && /^[a-zA-Z]/.test(next) && !/^[A-Z][A-Z\s&/.-]+$/.test(next)) return true;
  return false;
}

function joinSplitRoleDateLines(text) {
  const lines = text.split("\n");
  const output = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    const previous = output[output.length - 1];

    if (previous && startsWithDurationPipe(trimmed) && looksLikeRoleTitleLine(previous)) {
      output[output.length - 1] = `${previous.replace(/\s+\|?\s*$/, "")} ${trimmed}`.replace(/\s+/g, " ");
      return;
    }

    output.push(line);
  });

  return output.join("\n");
}

function cleanupOrphanLines(text) {
  const lines = text.split("\n");
  const output = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const nextIndex = findNextNonEmptyIndex(lines, index + 1);
    const next = nextIndex >= 0 ? lines[nextIndex].trim() : "";
    const previous = output[output.length - 1];

    if (!line) {
      if (output[output.length - 1] !== "") output.push("");
      continue;
    }

    if (previous && shouldMergeOrphan(previous, line, next)) {
      output[output.length - 1] = `${previous} ${line}`.replace(/\s+/g, " ");

      if (next && shouldAbsorbOrphanContinuation(line, next)) {
        output[output.length - 1] = `${output[output.length - 1]} ${next}`.replace(/\s+/g, " ");
        index = nextIndex;
      }
      continue;
    }

    output.push(line);
  }

  return output.join("\n");
}

function separateEmployers(text) {
  const companyPattern = knownEmployerNames.map(escapeRegex).join("|");
  const rolePattern = roleTitleWords.join("|");
  const durationOrDate = `(?:\\d{4}|Present|Current|\\d+\\s*(?:Years?|Months?))`;
  const genericRoleLine = `(?:[A-Z][A-Za-z/&.,-]+[ \\t]+){0,5}(?:${rolePattern})(?:[ \\t]+/[ \\t]+[A-Z][A-Za-z/&.,-]+(?:[ \\t]+[A-Z][A-Za-z/&.,-]+){0,4})?[ \\t]+\\|[ \\t]+.*?${durationOrDate}`;
  const inlineSeparated = text
    .replace(
      new RegExp(`([a-z0-9),.])[ \\t]+(${companyPattern})[ \\t]+`, "g"),
      "$1\n\n$2\n",
    )
    .replace(
      new RegExp(`(${companyPattern})[ \\t]+(?=(?:[A-Z][A-Za-z/&.,-]+[ \\t]+){0,5}(?:${rolePattern})(?:[ \\t]+/[ \\t]+[A-Z][A-Za-z/&.,-]+(?:[ \\t]+[A-Z][A-Za-z/&.,-]+){0,4})?[ \\t]*\\|)`, "g"),
      "$1\n",
    )
    .replace(
      new RegExp(`(${companyPattern})[ \\t]+[-\\u2013\\u2014]?[ \\t]*(${genericRoleLine})`, "g"),
      "$1\n$2",
    )
    .replace(
      /([a-z),.])[ \t]+([A-Z][A-Za-z&.]+(?:[ \t]+[A-Z][A-Za-z&.]+){1,5})[ \t]+((?:Professional Services|Customer Success|Technical Support|Implementation|Solutions|Project|Operations|Business Systems)[ \t]+(?:Consultant|Manager|Engineer|Specialist|Coordinator|Analyst|Lead|Associate)[ \t]+\|[ \t]+(?:\d{4}|Present|Current))/g,
      "$1\n\n$2\n$3",
    )
    .replace(
      /([a-z),.])[ \t]+([A-Z][A-Za-z&.]+(?:[ \t]+[A-Z][A-Za-z&.]+){1,4}?)[ \t]+((?:[A-Z][A-Za-z/&.,-]+[ \t]+){0,5}(?:Founder|Owner|Consultant|Manager|Engineer|Specialist|Coordinator|Analyst|Representative|Director|Lead|Administrator|Associate)[ \t]+\|[ \t]+(?:\d{4}|Present|Current))/g,
      "$1\n\n$2\n$3",
    );

  return inlineSeparated
    .split("\n")
    .reduce((state, line) => {
      if (isSectionHeader(line)) state.section = line;
      if (state.section !== "EDUCATION" && looksLikeEmployerLine(line) && state.lines.length && state.lines[state.lines.length - 1] !== "") {
        state.lines.push("");
      }
      state.lines.push(line);
      return state;
    }, { lines: [], section: "" })
    .lines
    .join("\n");
}

function normalizeBullets(text) {
  return text
    .split("\n")
    .map((line) => {
      const normalized = line.replace(/^\s*[-*\u2022\u25cf\u25aa\u25e6]\s+/, "- ");
      if (!normalized.startsWith("- ")) return normalized;
      return normalized.replace(/^-\s*/, "- ").replace(/\s+/g, " ").trim();
    })
    .join("\n");
}

function formatToolSections(text) {
  return text
    .split("\n")
    .map((line) => {
      if (isSectionHeader(line) || line.startsWith("- ")) return line;
      let formatted = line;
      toolLabels.forEach((label) => {
        formatted = formatted.replace(new RegExp(`\\s*(${escapeRegex(label)}:)\\s*`, "g"), "\n$1 ");
      });
      return formatted.trim();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function formatEducation(text) {
  return text
    .replace(
      /(Bachelor of Science\s*[-\u2013\u2014]\s*Information Systems\s*\/\s*Business Technology)\s+(Northwest Missouri State University)/gi,
      "$1\n$2",
    );
}

function finalSpacingCleanup(text) {
  let cleaned = text
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n-\s+/g, "\n- ")
    .replace(/\n{2,}(- )/g, "\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();

  sectionHeaders.forEach((header) => {
    cleaned = cleaned.replace(new RegExp(`${escapeRegex(header)}\\n\\n`, "g"), `${header}\n`);
  });

  return cleaned;
}

function isSectionHeader(line) {
  return sectionHeaders.includes(line.replace(/:$/, "").trim().toUpperCase());
}

function isDateLine(line) {
  return /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b|\b\d{4}\s*(?:-|to|\u2013|\u2014)\s*(?:\d{4}|Present|Current)\b/i.test(line);
}

function startsWithDurationPipe(line) {
  return /^\|\s*(?:(?:\d{4}|Present|Current)|(?:\d+\s*(?:Years?|Months?)))/i.test(line);
}

function looksLikeRoleTitleLine(line) {
  const trimmed = line.trim();
  if (!trimmed || isSectionHeader(trimmed) || trimmed.startsWith("- ")) return false;
  if (isDateLine(trimmed) || /\|\s*\d+\s*(?:Years?|Months?)\b/i.test(trimmed)) return false;
  if (trimmed.includes("|")) return /^[A-Z][A-Za-z/&.,\s-]+\|/.test(trimmed);
  return new RegExp(`\\b(?:${roleTitleWords.join("|")})\\b`).test(trimmed) && trimmed.length <= 80;
}

function shouldMergeOrphan(previous, line, next) {
  if (!previous || !line || isSectionHeader(previous) || isSectionHeader(line)) return false;
  if (looksLikeEmployerLine(line) || startsWithDurationPipe(line)) return false;
  if (line.startsWith("- ") || previous.endsWith(":")) return false;
  if (looksLikeRoleTitleLine(previous) || looksLikeRoleTitleLine(line)) return false;
  if (/^\d{1,3}%$/.test(line)) return true;
  if (/^[.,;:)]$/.test(line)) return true;
  if (/^\d{2,4}$/.test(line) && next && /^[a-z(]/.test(next)) return true;
  if (isShortContinuation(line) && !/[.!?]$/.test(previous) && next && /^[a-z(]/.test(next)) return true;
  return false;
}

function shouldAbsorbOrphanContinuation(orphan, next) {
  if (!orphan || !next || isSectionHeader(next) || next.startsWith("- ")) return false;
  return (/^\d{1,3}%$/.test(orphan) || isShortContinuation(orphan)) && /^[a-z(]/.test(next);
}

function isShortContinuation(line) {
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 3) return false;
  if (/^[A-Z][A-Za-z&.,'-]*(?:\s+[A-Z][A-Za-z&.,'-]*){0,2}$/.test(line)) return false;
  return line.length <= 28;
}

function findNextNonEmptyIndex(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index].trim()) return index;
  }
  return -1;
}

function looksLikeEmployerLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80 || isSectionHeader(trimmed) || trimmed.startsWith("- ")) return false;
  if (knownEmployerNames.includes(trimmed)) return true;
  if (/\|/.test(trimmed) || isDateLine(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 6) return false;
  return words.every((word) => /^[A-Z][A-Za-z&.,'-]*$/.test(word) || /^(LLC|Inc\.?|Corp\.?|Co\.?)$/.test(word));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
