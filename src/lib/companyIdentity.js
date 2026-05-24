const disposableSubdomains = new Set(["www", "jobs", "job", "careers", "career", "apply", "boards"]);

export function deriveCompanyDomain(jobOrUrl) {
  const sourceUrl = typeof jobOrUrl === "string" ? jobOrUrl : jobOrUrl?.company_domain || jobOrUrl?.companyDomain || jobOrUrl?.source_url;
  if (!sourceUrl) return "";

  try {
    const normalized = sourceUrl.match(/^https?:\/\//i) ? sourceUrl : `https://${sourceUrl}`;
    const url = new globalThis.URL(normalized);
    const labels = url.hostname.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
    if (!labels.length) return "";
    while (labels.length > 2 && disposableSubdomains.has(labels[0])) labels.shift();
    return labels.join(".");
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
  const domain = companyDomain || deriveCompanyDomain(sourceUrl);
  return [companyLogoUrl, domain && `https://logo.clearbit.com/${domain}`, domain && `https://www.google.com/s2/favicons?domain=${domain}&sz=128`].filter(Boolean);
}
