import { getDisplayCompanyName, getDisplayJobTitle } from "./jobDisplay.js";
import { normalizeResumeText } from "./resumeTextNormalizer.js";

const resumeHeaders = [
  "CONTACT",
  "HEADER",
  "PROFESSIONAL SUMMARY",
  "TAILORED PROFESSIONAL SUMMARY",
  "SUMMARY",
  "CORE SKILLS",
  "OPTIMIZED CORE SKILLS",
  "SKILLS",
  "PROFESSIONAL EXPERIENCE",
  "EXPERIENCE",
  "WORK EXPERIENCE",
  "REORDERED / REWORDED EXPERIENCE BULLETS",
  "REORDERED EXPERIENCE BULLETS",
  "REWORDED EXPERIENCE BULLETS",
  "TOOLS & TECHNOLOGIES",
  "TOOLS AND TECHNOLOGIES",
  "TECHNOLOGIES",
  "EDUCATION",
  "CERTIFICATIONS",
  "PROJECTS",
  "WHY THIS FITS",
  "WHY THIS ROLE FITS",
];

const headerAliases = {
  HEADER: "CONTACT",
  "TAILORED PROFESSIONAL SUMMARY": "PROFESSIONAL SUMMARY",
  SUMMARY: "PROFESSIONAL SUMMARY",
  "OPTIMIZED CORE SKILLS": "CORE SKILLS",
  SKILLS: "CORE SKILLS",
  EXPERIENCE: "PROFESSIONAL EXPERIENCE",
  "WORK EXPERIENCE": "PROFESSIONAL EXPERIENCE",
  "REORDERED / REWORDED EXPERIENCE BULLETS": "PROFESSIONAL EXPERIENCE",
  "REORDERED EXPERIENCE BULLETS": "PROFESSIONAL EXPERIENCE",
  "REWORDED EXPERIENCE BULLETS": "PROFESSIONAL EXPERIENCE",
  "TOOLS AND TECHNOLOGIES": "TOOLS & TECHNOLOGIES",
  TECHNOLOGIES: "TOOLS & TECHNOLOGIES",
  "WHY THIS FITS": "WHY THIS ROLE FITS",
};

const knownEmployerNames = [
  "ARSO Solutions Lab",
  "TouchNet Information Systems",
  "Sock101",
];

export function parseResumeForExport(content = "", { includeWhyThisFits = false, profile = null } = {}) {
  const profileContact = buildProfileContactLines(profile);
  const normalized = normalizeResumeText(prepareExportText(content))
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\n\s*Why this fits\s*:/i, "\n\nWHY THIS FITS\n")
    .replace(/\n\s*Why this role fits\s*:/i, "\n\nWHY THIS FITS\n");

  const sections = [];
  let current = { title: "CONTACT", lines: [] };

  normalized.split("\n").forEach((rawLine) => {
    const line = sanitizeExportText(rawLine.trim());
    if (!line) {
      if (current.lines[current.lines.length - 1] !== "") current.lines.push("");
      return;
    }

    const heading = getResumeHeading(line);
    if (heading) {
      pushSection(sections, current);
      current = { title: standardizeHeading(heading), lines: [] };
      return;
    }

    current.lines.push(line);
  });

  pushSection(sections, current);

  const merged = profileContact.length
    ? [{ title: "CONTACT", lines: profileContact }, ...sections.filter((section) => section.title !== "CONTACT")]
    : sections;

  const withEducation = ensureEducationFallback(merged, profile);

  return withEducation
    .filter((section) => includeWhyThisFits || section.title !== "WHY THIS ROLE FITS")
    .map((section) => ({
      title: standardizeHeading(section.title),
      lines: normalizeExportSectionLines(section.title, section.lines),
    }))
    .filter((section) => section.lines.length);
}

export function buildResumeFilename({ profile, job, extension }) {
  const person = slugifyName(profile?.full_name || profile?.email?.split("@")[0] || "Resume");
  const company = slugifyName(getDisplayCompanyName(job));
  const title = slugifyName(getDisplayJobTitle(job));
  return `${person}-${company}-${title}-Resume.${extension}`;
}

export async function exportResumePdf({ content, profile, job, resume, includeWhyThisFits = false, accentColor = "#7c3aed" }) {
  const { jsPDF } = await import("jspdf");
  const sections = parseResumeForExport(content, { includeWhyThisFits, profile });
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const fileName = buildResumeFilename({ profile, job, extension: "pdf" });
  renderPdf(doc, sections, { accentColor });
  doc.save(fileName);
  rememberResumeExport({ fileName, type: "PDF", job, resume });
}

export async function exportResumeDocx({ content, profile, job, resume, includeWhyThisFits = false, accentColor = "#7c3aed" }) {
  const docx = await import("docx");
  const sections = parseResumeForExport(content, { includeWhyThisFits, profile });
  const fileName = buildResumeFilename({ profile, job, extension: "docx" });
  const accentHex = toDocxHex(accentColor);
  const document = new docx.Document({
    numbering: {
      config: [{
        reference: "resume-bullets",
        levels: [{
          level: 0,
          format: docx.LevelFormat.BULLET,
          text: "\u2022",
          alignment: docx.AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 180 } } },
        }],
      }],
    },
    styles: {
      paragraphStyles: [
        {
          id: "ResumeSection",
          name: "Resume Section",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { bold: true, size: 21, color: accentHex },
          paragraph: { spacing: { before: 180, after: 80 }, keepNext: true },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: buildDocxParagraphs(sections, docx),
    }],
  });

  const blob = await docx.Packer.toBlob(document);
  downloadBlob(blob, fileName);
  rememberResumeExport({ fileName, type: "DOCX", job, resume });
}

export function openResumePrintPreview({ content, profile, job, includeWhyThisFits = false, accentColor = "#7c3aed" }) {
  const sections = parseResumeForExport(content, { includeWhyThisFits, profile });
  const fileName = buildResumeFilename({ profile, job, extension: "pdf" });
  const preview = window.open("", "_blank");
  if (!preview) throw new Error("Print preview was blocked.");
  const html = buildPrintHtml(sections, fileName, { accentColor });
  preview.document.open();
  preview.document.write(html);
  preview.document.close();
  let printed = false;
  const printWhenReady = () => {
    if (printed) return;
    printed = true;
    preview.focus();
    preview.print();
  };
  preview.addEventListener?.("load", () => window.setTimeout(printWhenReady, 150), { once: true });
  window.setTimeout(printWhenReady, 600);
}

export function getResumeExportHistory() {
  try {
    return JSON.parse(window.localStorage.getItem("occuboard.resumeExportHistory") || "[]");
  } catch {
    return [];
  }
}

function rememberResumeExport(item) {
  const next = [
    {
      id: crypto.randomUUID(),
      fileName: item.fileName,
      type: item.type,
      resumeId: item.resume?.id ?? "",
      company: getDisplayCompanyName(item.job),
      jobTitle: getDisplayJobTitle(item.job),
      created_at: new Date().toISOString(),
    },
    ...getResumeExportHistory(),
  ].slice(0, 12);
  try {
    window.localStorage.setItem("occuboard.resumeExportHistory", JSON.stringify(next));
  } catch {
    // Export still succeeded; history is a convenience layer.
  }
}

function renderPdf(doc, sections, { accentColor = "#7c3aed" } = {}) {
  const page = { width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() };
  const margin = 54;
  const maxWidth = page.width - margin * 2;
  let y = margin;

  const ensureSpace = (height) => {
    if (y + height <= page.height - margin) return;
    doc.addPage();
    y = margin;
  };

  sections.forEach((section, sectionIndex) => {
    if (section.title === "CONTACT" && sectionIndex === 0) {
      const [name, ...contact] = section.lines.filter(Boolean);
      if (name) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        ensureSpace(28);
        doc.text(name, page.width / 2, y, { align: "center" });
        y += 18;
      }
      if (contact.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        contact.forEach((contactLine, contactIndex) => {
          const wrapped = doc.splitTextToSize(contactLine, maxWidth);
          wrapped.forEach((line) => {
            ensureSpace(14);
            doc.text(line, page.width / 2, y, { align: "center" });
            y += 12;
          });
          if (contactIndex === 0 && contact.length > 1) y += 2;
        });
      }
      y += 10;
      return;
    }

    ensureSpace(34);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(section.title, margin, y);
    y += 4;
    doc.setDrawColor(...hexToRgb(accentColor));
    doc.setLineWidth(0.7);
    doc.line(margin, y, page.width - margin, y);
    y += 14;

    doc.setFontSize(10);
    const lines = section.lines.filter((line) => line !== "");
    lines.forEach((line, lineIndex) => {
      const isBullet = /^[-*]\s+/.test(line);
      const text = line.replace(/^[-*]\s+/, "");
      const indent = isBullet ? 14 : 0;
      const wrapped = doc.splitTextToSize(text, maxWidth - indent);

      if (!isBullet && looksLikeEmployerLine(line)) {
        const nextLine = lines[lineIndex + 1] || "";
        const firstBullet = lines[lineIndex + 2] || "";
        const nextWrapped = nextLine ? doc.splitTextToSize(nextLine.replace(/^[-*]\s+/, ""), maxWidth).length : 0;
        const bulletWrapped = /^[-*]\s+/.test(firstBullet) ? doc.splitTextToSize(firstBullet.replace(/^[-*]\s+/, ""), maxWidth - 14).length : 0;
        ensureSpace(Math.min(70, 24 + nextWrapped * 13 + bulletWrapped * 13));
      } else {
        ensureSpace(wrapped.length * 13 + 8);
      }

      doc.setFont("helvetica", isEmployerOrRoleLine(line, lines[lineIndex - 1]) ? "bold" : "normal");
      wrapped.forEach((wrappedLine, wrappedIndex) => {
        if (isBullet && wrappedIndex === 0) doc.text("-", margin, y);
        doc.text(wrappedLine, margin + indent, y);
        y += 13;
      });
      y += isBullet ? 2 : 4;
    });
    y += 5;
  });
}

function buildDocxParagraphs(sections, docx) {
  const paragraphs = [];
  sections.forEach((section, sectionIndex) => {
    if (section.title === "CONTACT" && sectionIndex === 0) {
      const [name, ...contact] = section.lines.filter(Boolean);
      if (name) {
        paragraphs.push(new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new docx.TextRun({ text: name, bold: true, size: 30 })],
        }));
      }
      if (contact.length) {
        contact.forEach((contactLine, contactIndex) => {
          paragraphs.push(new docx.Paragraph({
            alignment: docx.AlignmentType.CENTER,
            spacing: { after: contactIndex === contact.length - 1 ? 160 : 35 },
            children: [new docx.TextRun({ text: contactLine, size: 19 })],
          }));
        });
      }
      return;
    }

    paragraphs.push(new docx.Paragraph({
      text: section.title,
      heading: docx.HeadingLevel.HEADING_2,
      style: "ResumeSection",
      thematicBreak: true,
      keepNext: true,
    }));

    const lines = section.lines.filter((line) => line !== "");
    lines.forEach((line, lineIndex) => {
      const isBullet = /^[-*]\s+/.test(line);
      const nextLine = lines[lineIndex + 1] || "";
      paragraphs.push(new docx.Paragraph({
        numbering: isBullet ? { reference: "resume-bullets", level: 0 } : undefined,
        keepNext: (!isBullet && looksLikeEmployerLine(line)) || (!isBullet && /\|/.test(line) && /^[-*]\s+/.test(nextLine)),
        spacing: { after: 80 },
        children: [new docx.TextRun({
          text: line.replace(/^[-*]\s+/, ""),
          size: 20,
          bold: isEmployerOrRoleLine(line, lines[lineIndex - 1]),
        })],
      }));
    });
  });
  return paragraphs;
}

function buildPrintHtml(sections, title, { accentColor = "#7c3aed" } = {}) {
  return `<!doctype html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: letter; margin: 0.65in; }
    body { color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.35; margin: 0; }
    .resume { max-width: 7.2in; margin: 0 auto; }
    .contact { text-align: center; margin-bottom: 14px; }
    .name { font-size: 18pt; font-weight: 700; }
    .meta { margin-top: 4px; font-size: 9.5pt; color: #334155; }
    .links { margin-top: 2px; font-size: 9.5pt; color: #334155; }
    h2 { border-bottom: 1px solid ${escapeHtml(accentColor)}; break-after: avoid; font-size: 10.5pt; letter-spacing: 0.02em; margin: 15px 0 7px; padding-bottom: 3px; page-break-after: avoid; }
    p { margin: 0 0 6px; }
    ul { margin: 0 0 7px 18px; padding: 0; }
    li { margin: 0 0 4px; }
    section, .employer-block { break-inside: auto; page-break-inside: auto; }
    .section-start, .employer-heading { break-inside: avoid; page-break-inside: avoid; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <main class="resume">${sections.map(sectionToHtml).join("")}</main>
</body>
</html>`;
}

function sectionToHtml(section, index) {
  if (section.title === "CONTACT" && index === 0) {
    const [name, ...contact] = section.lines.filter(Boolean);
    const [primary, links] = contact;
    return `<section class="contact"><div class="name">${escapeHtml(name || "")}</div>${primary ? `<div class="meta">${escapeHtml(primary)}</div>` : ""}${links ? `<div class="links">${escapeHtml(links)}</div>` : ""}</section>`;
  }
  if (section.title === "PROFESSIONAL EXPERIENCE") {
    return `<section><div class="section-start"><h2>${escapeHtml(section.title)}</h2></div>${experienceBlocksToHtml(section.lines)}</section>`;
  }
  const chunks = [];
  let bullets = [];
  const flushBullets = () => {
    if (!bullets.length) return;
    chunks.push(`<ul>${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
    bullets = [];
  };
  section.lines.filter(Boolean).forEach((line) => {
    if (/^[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*]\s+/, ""));
      return;
    }
    flushBullets();
    const className = looksLikeEmployerLine(line) ? " class=\"employer-block\"" : "";
    chunks.push(`<p${className}>${escapeHtml(line)}</p>`);
  });
  flushBullets();
  return `<section><div class="section-start"><h2>${escapeHtml(section.title)}</h2>${chunks.shift() ?? ""}</div>${chunks.join("")}</section>`;
}

function experienceBlocksToHtml(lines) {
  const blocks = [];
  let current = [];
  lines.filter(Boolean).forEach((line) => {
    if (looksLikeEmployerLine(line) && current.length) {
      blocks.push(current);
      current = [line];
      return;
    }
    current.push(line);
  });
  if (current.length) blocks.push(current);

  return blocks.map((block) => {
    const chunks = [];
    let bullets = [];
    const heading = [];
    const flushBullets = () => {
      if (!bullets.length) return;
      chunks.push(`<ul>${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
      bullets = [];
    };
    block.forEach((line, index) => {
      if (/^[-*]\s+/.test(line)) {
        bullets.push(line.replace(/^[-*]\s+/, ""));
        return;
      }
      flushBullets();
      if (index <= 1) {
        heading.push(`<p>${escapeHtml(line)}</p>`);
        return;
      }
      chunks.push(`<p>${escapeHtml(line)}</p>`);
    });
    flushBullets();
    return `<div class="employer-block">${heading.length ? `<div class="employer-heading">${heading.join("")}</div>` : ""}${chunks.join("")}</div>`;
  }).join("");
}

function buildProfileContactLines(profile) {
  if (!profile) return [];
  const name = sanitizeExportText(profile.full_name || profile.email?.split("@")[0] || "");
  const primary = [
    profile.location,
    formatPhoneForExport(profile.phone),
    profile.email,
  ].filter(Boolean).map(sanitizeExportText);
  const links = [
    profile.linkedin_url ? `LinkedIn: ${formatUrlForExport(profile.linkedin_url)}` : "",
    profile.portfolio_url ? `Portfolio: ${formatUrlForExport(profile.portfolio_url)}` : "",
  ].filter(Boolean).map(sanitizeExportText);

  return [
    name,
    primary.join(" | "),
    links.join(" | "),
  ].filter(Boolean);
}

function ensureEducationFallback(sections, profile) {
  if (sections.some((section) => standardizeHeading(section.title) === "EDUCATION")) return sections;
  const education = extractEducationFromBaseResume(profile?.base_resume_text);
  if (!education.length) return sections;

  const whyIndex = sections.findIndex((section) => section.title === "WHY THIS ROLE FITS");
  const educationSection = { title: "EDUCATION", lines: education };
  if (whyIndex === -1) return [...sections, educationSection];
  return [
    ...sections.slice(0, whyIndex),
    educationSection,
    ...sections.slice(whyIndex),
  ];
}

function extractEducationFromBaseResume(baseResumeText = "") {
  if (!baseResumeText?.trim()) return [];
  const sections = parseResumeForExport(baseResumeText, { includeWhyThisFits: true, profile: null });
  const education = sections.find((section) => section.title === "EDUCATION");
  return education?.lines ?? [];
}

function normalizeExportSectionLines(title, lines) {
  const cleaned = trimBlankLines(lines.map(sanitizeExportText));
  if (standardizeHeading(title) !== "PROFESSIONAL EXPERIENCE") return cleaned;
  return normalizeExperienceLines(cleaned);
}

function normalizeExperienceLines(lines) {
  const output = [];
  const knownPattern = knownEmployerNames.map(escapeRegex).join("|");
  lines.forEach((line) => {
    const splitKnownEmployer = line.match(new RegExp(`^(${knownPattern})\\s+(.+\\|.+)$`));
    if (splitKnownEmployer) {
      output.push(splitKnownEmployer[1], splitKnownEmployer[2]);
      return;
    }
    output.push(line);
  });
  return output;
}

function formatPhoneForExport(phone = "") {
  const value = String(phone || "").trim();
  const digits = value.replace(/\D/g, "");
  if (!value) return "";
  if (/^\d{10}$/.test(digits) && value === digits) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value;
}

function formatUrlForExport(url = "") {
  return String(url || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

function sanitizeExportText(value = "") {
  return String(value)
    .replace(/â†’|→|➜|➡|⟶/g, " to ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[–—−‑]/g, "-")
    .replace(/(\d{4})\s+\?\s+(Present|Current|\d{4})/gi, "$1 - $2")
    .replace(/(Bachelor[^?\n]+)\s+\?\s+/gi, "$1 - ")
    .replace(/\s+\?\s+\w+\s+\?\s+/g, (match) => match.replace(/\?/g, "to"))
    .replace(/\s+\?\s+/g, " to ")
    .replace(/\u00a0/g, " ")
    .replace(/\uFFFD/g, "")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function prepareExportText(value = "") {
  return sanitizeExportText(value)
    .replace(/TAILORED\s+PROFESSIONAL\s+SUMMARY/gi, "PROFESSIONAL SUMMARY")
    .replace(/OPTIMIZED\s+CORE\s+SKILLS/gi, "CORE SKILLS")
    .replace(/REORDERED\s*\/\s*REWORDED\s+EXPERIENCE\s+BULLETS/gi, "PROFESSIONAL EXPERIENCE")
    .replace(/REORDERED\s+EXPERIENCE\s+BULLETS/gi, "PROFESSIONAL EXPERIENCE")
    .replace(/REWORDED\s+EXPERIENCE\s+BULLETS/gi, "PROFESSIONAL EXPERIENCE")
    .replace(/TOOLS\s+AND\s+TECHNOLOGIES/gi, "TOOLS & TECHNOLOGIES");
}

function standardizeHeading(value) {
  const normalized = String(value || "").replace(/:$/, "").trim().toUpperCase();
  return headerAliases[normalized] ?? normalized;
}

function pushSection(sections, section) {
  const title = standardizeHeading(section.title);
  const lines = trimBlankLines(section.lines);
  if (lines.length) sections.push({ title, lines });
}

function trimBlankLines(lines) {
  const next = [...lines];
  while (next[0] === "") next.shift();
  while (next[next.length - 1] === "") next.pop();
  return next;
}

function getResumeHeading(line) {
  const normalized = line.replace(/:$/, "").trim().toUpperCase();
  return resumeHeaders.includes(normalized) ? normalized : "";
}

function looksLikeEmployerLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 90 || /^[-*]\s+/.test(trimmed)) return false;
  if (knownEmployerNames.includes(trimmed)) return true;
  if (/\|/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 6) return false;
  return words.every((word) => /^[A-Z][A-Za-z&.,'-]*$/.test(word) || /^(LLC|Inc\.?|Corp\.?|Co\.?)$/.test(word));
}

function isEmployerOrRoleLine(line, previousLine = "") {
  if (looksLikeEmployerLine(line)) return true;
  return looksLikeEmployerLine(previousLine) && /\|/.test(line) && !/^[-*]\s+/.test(line);
}

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function slugifyName(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "Resume";
}

function hexToRgb(value = "#7c3aed") {
  const hex = String(value).replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(hex)) return [124, 58, 237];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function toDocxHex(value = "#7c3aed") {
  const hex = String(value).replace("#", "").trim();
  return /^[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : "7C3AED";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
