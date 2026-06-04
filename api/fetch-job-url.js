import { URL } from "url";

export default async function handler(req, res) {
  setJson(res);
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const rawBody = req.body ?? (await readJson(req));
    const body = typeof rawBody === "string" ? JSON.parse(rawBody || "{}") : rawBody;
    const url = String(body?.url || "").trim();
    if (!/^https?:\/\//i.test(url)) return send(res, 400, { error: "Enter a valid job URL." });
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 OccuBoard job import",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return send(res, 422, { error: "Could not fetch this job page." });
    const html = await response.text();
    const details = extractJobDetails(html, url);
    return send(res, 200, { details });
  } catch {
    return send(res, 422, { error: "Could not import this URL. Paste the job description manually." });
  }
}

function extractJobDetails(html = "", url = "") {
  const title = cleanText(
    getMeta(html, "og:title") ||
    getMeta(html, "twitter:title") ||
    getTagText(html, "h1") ||
    getTagText(html, "title"),
  );
  const company = cleanText(getMeta(html, "og:site_name") || inferCompanyFromUrl(url));
  const description = cleanText(
    getMeta(html, "description") ||
    getMeta(html, "og:description") ||
    htmlToText(html),
  ).slice(0, 18000);
  return {
    job_title: title.replace(/\s+\|\s+.*$/, "").replace(/\s+-\s+.*$/, "").slice(0, 120),
    company_name: company.slice(0, 100),
    job_description: description,
  };
}

function getMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return html.match(pattern)?.[1] || "";
}

function getTagText(html, tag) {
  return html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "";
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function cleanText(value = "") {
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function inferCompanyFromUrl(url = "") {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0].split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  } catch {
    return "";
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function setJson(res) {
  res.setHeader("content-type", "application/json");
}

function send(res, status, body) {
  res.statusCode = status;
  res.end(JSON.stringify(body));
}
