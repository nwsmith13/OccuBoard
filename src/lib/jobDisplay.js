export const UNTITLED_JOB = "Untitled Job";
export const COMPANY_TO_CONFIRM = "Company to confirm";

export function getDisplayJobTitle(jobOrTitle) {
  const value = typeof jobOrTitle === "string" ? jobOrTitle : jobOrTitle?.job_title;
  const title = String(value || "").replace(/\s+/g, " ").trim();
  if (!title || title.length > 80 || title === "Role to analyze") return UNTITLED_JOB;
  return title;
}

export function getDisplayCompanyName(jobOrCompany) {
  const value = typeof jobOrCompany === "string" ? jobOrCompany : jobOrCompany?.company_name;
  const company = String(value || "").replace(/\s+/g, " ").trim();
  if (!company || company.length > 80) return COMPANY_TO_CONFIRM;
  return company;
}

export function getTailoredResumeTitle(job) {
  return `Tailored Resume - ${getDisplayCompanyName(job)} - ${getDisplayJobTitle(job)}`;
}
