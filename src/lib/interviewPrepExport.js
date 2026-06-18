import { formatDate } from "./date.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "./jobDisplay.js";

const defaultAccent = "#0F5EA8";

export function buildInterviewCheatSheetFilename({ profile, job, extension = "pdf" }) {
  const person = slugifyName(profile?.full_name || profile?.email?.split("@")[0] || "Interview-Cheat-Sheet");
  const company = slugifyName(getDisplayCompanyName(job));
  const title = slugifyName(getDisplayJobTitle(job));
  return `${person}-${company}-${title}-Interview-Cheat-Sheet.${extension}`;
}

export async function exportInterviewCheatSheetPdf({ profile, job, score, content = {}, interviewDetails = {}, questions = [], stories = [], focusAreas = [], questionsToAsk = [], concerns = [], accentColor = defaultAccent }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const fileName = buildInterviewCheatSheetFilename({ profile, job, extension: "pdf" });
  const renderer = createPdfRenderer(doc, { accentColor });
  const talkingPoints = normalizeList(content.talkingPoints);
  const topStrengths = [...normalizeList(score?.strengths), ...talkingPoints].slice(0, 6);

  renderer.title("Interview Cheat Sheet", `${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
  renderer.meta([
    interviewDetails.interview_date ? `Interview: ${formatDate(interviewDetails.interview_date)}` : "",
    score?.score ? `Fit score: ${score.score}%` : "",
  ].filter(Boolean).join("   |   "));
  renderer.section("Interview Summary");
  renderer.paragraph(content.summary || content.prepSummary || "Use this sheet to quickly review the role, your strongest talking points, likely questions, and follow-up reminders before the conversation.");
  renderer.section("Key Talking Points");
  renderer.bullets(topStrengths.length ? topStrengths : talkingPoints);
  renderer.section("STAR Stories");
  renderer.cards(stories.slice(0, 4).map((story) => ({
    title: story.title || "Recommended story",
    body: [
      story.situation ? `Situation: ${story.situation}` : "",
      story.task ? `Task: ${story.task}` : "",
      story.action ? `Action: ${story.action}` : "",
      story.result ? `Result: ${story.result}` : "",
      story.bestUseCases?.length ? `Best used for: ${story.bestUseCases.join(", ")}` : "",
    ].filter(Boolean),
  })));
  renderer.section("Questions To Expect");
  renderer.cards(questions.slice(0, 6).map(formatQuestionCard));
  renderer.section("Questions To Ask");
  renderer.bullets(questionsToAsk.slice(0, 6));
  renderer.section("Research Notes");
  renderer.cards(focusAreas.slice(0, 5).map(formatFocusAreaCard));
  renderer.section("Follow-Up Reminders");
  renderer.bullets(buildFollowUpReminders({ job, interviewDetails, concerns }));
  doc.save(fileName);
  return fileName;
}

export async function exportInterviewPrepPacketPdf({ profile, job, score, content = {}, interviewDetails = {}, questions = [], stories = [], focusAreas = [], questionsToAsk = [], concerns = [], accentColor = defaultAccent }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const fileName = buildGenericInterviewFilename({ profile, job, suffix: "Interview-Prep-Packet" });
  const renderer = createPdfRenderer(doc, { accentColor });
  const talkingPoints = normalizeList(content.talkingPoints);
  const topStrengths = [...normalizeList(score?.strengths), ...talkingPoints].slice(0, 6);

  renderer.title("Interview Prep Packet", `${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
  renderer.meta([
    interviewDetails.interview_date ? `Interview: ${formatDate(interviewDetails.interview_date)}` : "",
    score?.score ? `Fit score: ${score.score}%` : "",
  ].filter(Boolean).join("   |   "));
  renderer.section("Interview Summary");
  renderer.paragraph(content.summary || content.prepSummary || "Review the role, your strongest talking points, likely questions, research notes, and follow-up reminders before the conversation.");
  renderer.section("Key Talking Points");
  renderer.bullets(topStrengths.length ? topStrengths : talkingPoints);
  renderer.section("Questions To Expect");
  renderer.cards(questions.map(formatQuestionCard));
  renderer.section("STAR Stories");
  renderer.cards(stories.map((story) => ({
    title: story.title || "Recommended story",
    body: [
      story.situation ? `Situation: ${story.situation}` : "",
      story.task ? `Task: ${story.task}` : "",
      story.action ? `Action: ${story.action}` : "",
      story.result ? `Result: ${story.result}` : "",
      story.bestUseCases?.length ? `Best used for: ${story.bestUseCases.join(", ")}` : "",
      story.followUps?.length ? `Likely follow-ups: ${story.followUps.join("; ")}` : "",
    ].filter(Boolean),
  })));
  renderer.section("Questions To Ask");
  renderer.bullets(questionsToAsk);
  renderer.section("Research Notes");
  renderer.cards(focusAreas.map(formatFocusAreaCard));
  renderer.section("Follow-Up Reminders");
  renderer.bullets(buildFollowUpReminders({ job, interviewDetails, concerns }));
  doc.save(fileName);
  return fileName;
}

export async function exportRecruiterMessagePdf({ profile, job, message = "", accentColor = defaultAccent }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const fileName = buildGenericInterviewFilename({ profile, job, suffix: "Recruiter-Message" });
  const renderer = createPdfRenderer(doc, { accentColor });
  renderer.title("Recruiter Message", `${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
  renderer.paragraph(message || "No recruiter message generated yet.");
  doc.save(fileName);
  return fileName;
}

export async function exportInterviewQuestionsPdf({ profile, job, questions = [], accentColor = defaultAccent }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const fileName = buildGenericInterviewFilename({ profile, job, suffix: "Interview-Questions" });
  const renderer = createPdfRenderer(doc, { accentColor });
  renderer.title("Interview Questions", `${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
  renderer.cards(questions.map(formatQuestionCard));
  doc.save(fileName);
  return fileName;
}

export async function exportStarStoriesPdf({ profile, job, stories = [], accentColor = defaultAccent }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const fileName = buildGenericInterviewFilename({ profile, job, suffix: "STAR-Stories" });
  const renderer = createPdfRenderer(doc, { accentColor });
  renderer.title("STAR Stories", `${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
  renderer.cards(stories.map((story) => ({
    title: story.title || "Recommended story",
    body: [
      story.situation ? `Situation: ${story.situation}` : "",
      story.task ? `Task: ${story.task}` : "",
      story.action ? `Action: ${story.action}` : "",
      story.result ? `Result: ${story.result}` : "",
      story.followUps?.length ? `Likely follow-ups: ${story.followUps.join("; ")}` : "",
    ].filter(Boolean),
  })));
  doc.save(fileName);
  return fileName;
}

export async function exportResearchNotesPdf({ profile, job, focusAreas = [], questionsToAsk = [], accentColor = defaultAccent }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const fileName = buildGenericInterviewFilename({ profile, job, suffix: "Research-Notes" });
  const renderer = createPdfRenderer(doc, { accentColor });
  renderer.title("Research Notes", `${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`);
  renderer.section("Company and Role Notes");
  renderer.cards(focusAreas.map(formatFocusAreaCard));
  renderer.section("Questions To Ask");
  renderer.bullets(questionsToAsk);
  doc.save(fileName);
  return fileName;
}

function createPdfRenderer(doc, { accentColor = defaultAccent } = {}) {
  const page = { width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() };
  const margin = 62;
  const maxWidth = page.width - margin * 2;
  let y = margin;

  const ensureSpace = (height) => {
    if (y + height <= page.height - margin) return;
    doc.addPage();
    y = margin;
  };

  const writeLines = (lines, { x = margin, font = "normal", size = 10.5, leading = 15, color = [23, 32, 51] } = {}) => {
    doc.setFont("helvetica", font);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    lines.forEach((line) => {
      const split = doc.splitTextToSize(line, maxWidth - (x - margin));
      ensureSpace(split.length * leading + 4);
      split.forEach((part) => {
        doc.text(part, x, y);
        y += leading;
      });
    });
  };

  return {
    title(title, subtitle) {
      const accent = hexToRgb(accentColor);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(19);
      doc.setTextColor(23, 32, 51);
      ensureSpace(42);
      doc.text(title, margin, y);
      y += 20;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(91, 103, 122);
      doc.text(subtitle, margin, y);
      y += 12;
      doc.setDrawColor(...accent);
      doc.setLineWidth(1.2);
      doc.line(margin, y, page.width - margin, y);
      y += 22;
    },
    meta(text) {
      if (!text) return;
      writeLines([text], { size: 9.5, color: [91, 103, 122] });
      y += 8;
    },
    section(title) {
      y += 4;
      ensureSpace(34);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...hexToRgb(accentColor));
      doc.text(String(title).toUpperCase(), margin, y);
      y += 18;
    },
    paragraph(text) {
      const clean = normalizeText(text);
      writeLines([clean || "No notes available yet."]);
      y += 8;
    },
    bullets(items = []) {
      const clean = normalizeList(items);
      if (!clean.length) {
        writeLines(["No items available yet."], { color: [91, 103, 122] });
        y += 8;
        return;
      }
      clean.forEach((item) => {
        writeLines([`\u2022 ${item}`], { x: margin + 8 });
        y += 2;
      });
      y += 10;
    },
    cards(cards = []) {
      const clean = cards.filter((card) => card?.title || card?.body);
      if (!clean.length) {
        writeLines(["No items available yet."], { color: [91, 103, 122] });
        y += 8;
        return;
      }
      clean.forEach((card) => {
        const titleLines = doc.splitTextToSize(normalizeText(card.title), maxWidth - 24);
        const bodyGroups = getCardBodyGroups(card.body).map((group) => doc.splitTextToSize(group, maxWidth - 24));
        const bodyLineCount = bodyGroups.reduce((sum, group) => sum + group.length, 0);
        const height = 32 + titleLines.length * 15 + bodyLineCount * 14 + Math.max(0, bodyGroups.length - 1) * 6;
        ensureSpace(height + 14);
        doc.setDrawColor(217, 230, 242);
        doc.setFillColor(248, 251, 253);
        doc.roundedRect(margin, y - 8, maxWidth, height, 8, 8, "FD");
        y += 10;
        writeLines(titleLines, { x: margin + 12, font: "bold", size: 11, leading: 15 });
        bodyGroups.forEach((group) => {
          writeLines(group, { x: margin + 12, size: 9.5, leading: 14, color: [71, 85, 105] });
          y += 6;
        });
        y += 12;
      });
    },
  };
}

function formatQuestionCard(question = {}) {
  return {
    title: question.question || "Interview question",
    body: [
      question.why || question.whyTheyAsk ? `Why they ask: ${question.why || question.whyTheyAsk}` : "",
      question.evaluating || question.whatTheyEvaluate ? `What they evaluate: ${question.evaluating || question.whatTheyEvaluate}` : "",
      question.guidance || question.answerDirection ? `Suggested direction: ${question.guidance || question.answerDirection}` : "",
      question.relatedStory ? `Related story: ${question.relatedStory}` : "",
    ].filter(Boolean),
  };
}

function formatFocusAreaCard(area = {}) {
  return {
    title: area.title || area.emphasize || "Research note",
    body: area.description || area.guidance || area.why || area.note || "",
  };
}

function buildFollowUpReminders({ job = {}, interviewDetails = {}, concerns = [] }) {
  return [
    interviewDetails.interview_date ? `Send a thank-you note after the ${formatDate(interviewDetails.interview_date)} interview.` : "Send a thank-you note after the interview.",
    job.follow_up_date ? `Follow up on ${formatDate(job.follow_up_date)}.` : "Set a follow-up reminder after applying or interviewing.",
    concerns.length ? "Prepare concise responses for the highlighted conversation topics." : "Review your strongest stories before the interview.",
  ];
}

function buildGenericInterviewFilename({ profile, job, suffix }) {
  const person = slugifyName(profile?.full_name || profile?.email?.split("@")[0] || suffix);
  const company = slugifyName(getDisplayCompanyName(job));
  const title = slugifyName(getDisplayJobTitle(job));
  return `${person}-${company}-${title}-${suffix}.pdf`;
}

function normalizeList(items = []) {
  return items
    .map((item) => {
      if (typeof item === "string") return normalizeText(item);
      if (item?.title && item?.description) return normalizeText(`${item.title}: ${item.description}`);
      return normalizeText(item?.title || item?.question || item?.emphasize || item?.label || "");
    })
    .filter(Boolean);
}

function normalizeText(value = "") {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCardBodyGroups(body = "") {
  const values = Array.isArray(body) ? body : String(body || "").split(/\n+/);
  return values.map(normalizeText).filter(Boolean);
}

function slugifyName(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "OccuBoard";
}

function hexToRgb(value = defaultAccent) {
  const hex = String(value).replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(hex)) return [15, 94, 168];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}
