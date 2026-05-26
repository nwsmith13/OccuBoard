import { getDisplayCompanyName, getDisplayJobTitle } from "./jobDisplay.js";

export function buildCoverLetterFilename({ profile, job, extension }) {
  const person = slugifyName(profile?.full_name || profile?.email?.split("@")[0] || "Cover-Letter");
  const company = slugifyName(getDisplayCompanyName(job));
  const title = slugifyName(getDisplayJobTitle(job));
  return `${person}-${company}-${title}-Cover-Letter.${extension}`;
}

export async function exportCoverLetterPdf({ content, profile, job, accentColor = "#0F5EA8" }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const fileName = buildCoverLetterFilename({ profile, job, extension: "pdf" });
  const margin = 58;
  const page = { width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() };
  const maxWidth = page.width - margin * 2;
  let y = margin;

  const ensureSpace = (height) => {
    if (y + height <= page.height - margin) return;
    doc.addPage();
    y = margin;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(profile?.full_name || "Cover Letter", margin, y);
  y += 18;
  doc.setDrawColor(...hexToRgb(accentColor));
  doc.setLineWidth(1);
  doc.line(margin, y, page.width - margin, y);
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  normalizeParagraphs(content).forEach((paragraph) => {
    const lines = doc.splitTextToSize(paragraph, maxWidth);
    ensureSpace(lines.length * 15 + 16);
    lines.forEach((line) => {
      doc.text(line, margin, y);
      y += 15;
    });
    y += 10;
  });

  doc.save(fileName);
  rememberCoverLetterExport({ fileName, type: "PDF", job });
}

export async function exportCoverLetterDocx({ content, profile, job, accentColor = "#0F5EA8" }) {
  const docx = await import("docx");
  const fileName = buildCoverLetterFilename({ profile, job, extension: "docx" });
  const document = new docx.Document({
    styles: {
      paragraphStyles: [{
        id: "CoverLetterName",
        name: "Cover Letter Name",
        basedOn: "Normal",
        quickFormat: true,
        run: { bold: true, size: 30, color: toDocxHex(accentColor) },
        paragraph: { spacing: { after: 180 } },
      }],
    },
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [
        new docx.Paragraph({ text: profile?.full_name || "Cover Letter", style: "CoverLetterName" }),
        ...normalizeParagraphs(content).map((paragraph) => new docx.Paragraph({
          spacing: { after: 180 },
          children: [new docx.TextRun({ text: paragraph, size: 22 })],
        })),
      ],
    }],
  });

  const blob = await docx.Packer.toBlob(document);
  downloadBlob(blob, fileName);
  rememberCoverLetterExport({ fileName, type: "DOCX", job });
}

function normalizeParagraphs(content = "") {
  return String(content)
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function rememberCoverLetterExport(item) {
  const next = [
    {
      id: crypto.randomUUID(),
      fileName: item.fileName,
      type: item.type,
      company: getDisplayCompanyName(item.job),
      jobTitle: getDisplayJobTitle(item.job),
      created_at: new Date().toISOString(),
    },
    ...getCoverLetterExportHistory(),
  ].slice(0, 12);
  try {
    window.localStorage.setItem("occuboard.coverLetterExportHistory", JSON.stringify(next));
  } catch {
    // Export still succeeded; history is a convenience layer.
  }
}

export function getCoverLetterExportHistory() {
  try {
    return JSON.parse(window.localStorage.getItem("occuboard.coverLetterExportHistory") || "[]");
  } catch {
    return [];
  }
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
    .replace(/^-+|-+$/g, "") || "Cover-Letter";
}

function hexToRgb(value = "#0F5EA8") {
  const hex = String(value).replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(hex)) return [15, 94, 168];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function toDocxHex(value = "#0F5EA8") {
  const hex = String(value).replace("#", "").trim();
  return /^[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : "0F5EA8";
}
