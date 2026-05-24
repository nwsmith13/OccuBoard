import { normalizeResumeText } from "./resumeTextNormalizer.js";

export { normalizeResumeText } from "./resumeTextNormalizer.js";

export const MAX_RESUME_FILE_SIZE = 5 * 1024 * 1024;

const supportedTypes = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

export function validateResumeFile(file) {
  if (!file) return "Choose a resume file to import.";
  if (file.size > MAX_RESUME_FILE_SIZE) return "Resume files must be 5MB or smaller.";
  if (!getResumeFileKind(file)) return "Upload a PDF, DOCX, or TXT resume.";
  return "";
}

export function getResumeFileKind(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (supportedTypes[file.type]) return supportedTypes[file.type];
  if (["pdf", "docx", "txt"].includes(extension)) return extension;
  return "";
}

export async function extractResumeText(file) {
  const validationError = validateResumeFile(file);
  if (validationError) throw new Error(validationError);

  const kind = getResumeFileKind(file);
  if (kind === "txt") return normalizeResumeText(await file.text());
  if (kind === "docx") return extractDocxText(file);
  if (kind === "pdf") return extractPdfText(file);
  throw new Error("Upload a PDF, DOCX, or TXT resume.");
}

async function extractDocxText(file) {
  const mammothModule = await import("mammoth/mammoth.browser");
  const mammoth = mammothModule.default ?? mammothModule;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return normalizeResumeText(result.value);
}

async function extractPdfText(file) {
  try {
    const [pdfjsLib, workerModule] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.mjs?url"),
    ]);
    const pdfWorkerUrl = workerModule.default ?? workerModule;
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join("\n"));
    }
    return normalizeResumeText(pages.join("\n\n"));
  } catch {
    throw new Error("We couldn't read this PDF. Try uploading a DOCX or paste your resume text.");
  }
}
