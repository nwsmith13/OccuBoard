const disposableSubdomains = new Set(["www", "jobs", "job", "careers", "career", "apply", "boards"]);
const referrerDomains = new Set([
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "greenhouse.io",
  "lever.co",
  "workable.com",
  "ashbyhq.com",
  "smartrecruiters.com",
  "ziprecruiter.com",
  "builtin.com",
  "remote.co",
  "wellfound.com",
]);

export function deriveCompanyDomain(jobOrUrl) {
  if (typeof jobOrUrl !== "string") {
    const explicitDomain = normalizeDomain(jobOrUrl?.company_domain || jobOrUrl?.companyDomain);
    if (explicitDomain) return explicitDomain;
  }

  const sourceUrl = typeof jobOrUrl === "string" ? jobOrUrl : jobOrUrl?.source_url;
  if (!sourceUrl) return "";

  try {
    return normalizeDomain(new globalThis.URL(normalizeUrl(sourceUrl)).hostname);
  } catch {
    return "";
  }
}

export function getCompanyInitials(companyName = "") {
  const words = String(companyName)
    .replace(/&/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);

  if (!words.length) return "OC";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function getCompanyLogoSources({ companyDomain, companyLogoUrl, sourceUrl } = {}) {
  const domain = normalizeDomain(companyDomain) || deriveCompanyDomain(sourceUrl);
  return [getValidCompanyLogoUrl(companyLogoUrl), domain && `https://logo.clearbit.com/${domain}`, domain && `https://www.google.com/s2/favicons?domain=${domain}&sz=128`].filter(Boolean);
}

export function isReferrerDomain(domain = "") {
  const normalized = String(domain).toLowerCase().replace(/^www\./, "");
  return [...referrerDomains].some((referrer) => normalized === referrer || normalized.endsWith(`.${referrer}`));
}

function normalizeDomain(value = "") {
  if (!value) return "";
  try {
    const parsed = new globalThis.URL(normalizeUrl(value));
    return normalizeHost(parsed.hostname);
  } catch {
    return normalizeHost(value);
  }
}

function normalizeHost(value = "") {
  const labels = String(value).toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (!labels.length) return "";
  while (labels.length > 2 && disposableSubdomains.has(labels[0])) labels.shift();
  const domain = labels.join(".");
  return isReferrerDomain(domain) ? "" : domain;
}

function getValidCompanyLogoUrl(value = "") {
  if (!value) return "";
  try {
    const url = new globalThis.URL(normalizeUrl(value));
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (isReferrerDomain(hostname)) return "";
    if (hostname === "logo.clearbit.com") return normalizeDomain(decodeURIComponent(url.pathname.replace(/^\/+/, ""))) ? value : "";
    if (hostname === "www.google.com" && url.pathname.includes("/s2/favicons")) return normalizeDomain(url.searchParams.get("domain") || "") ? value : "";
    return value;
  } catch {
    return "";
  }
}

function normalizeUrl(value = "") {
  return String(value).match(/^https?:\/\//i) ? String(value) : `https://${value}`;
}
