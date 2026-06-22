const profileFields = [
  "full_name",
  "email",
  "base_resume_text",
];

const profileFieldLabels = {
  full_name: "Full name",
  email: "Email",
  base_resume_text: "Base resume",
  phone: "Phone",
  location: "Location",
  linkedin_url: "LinkedIn URL",
};

const resumeHeaderFields = [
  "full_name",
  "email",
  "phone",
  "location",
  "linkedin_url",
];

export function getProfileCompleteness(profile) {
  if (!profile) return 0;
  const completed = profileFields.filter((field) => Boolean(String(profile[field] ?? "").trim())).length;
  return Math.round((completed / profileFields.length) * 100);
}

export function getMissingProfileItems(profile) {
  return profileFields
    .filter((field) => !String(profile?.[field] ?? "").trim())
    .map((field) => profileFieldLabels[field] || field);
}

export function getResumeHeaderCompleteness(profile) {
  const items = resumeHeaderFields.map((field) => ({
    field,
    label: profileFieldLabels[field] || field,
    complete: Boolean(String(profile?.[field] ?? "").trim()),
  }));
  const completed = items.filter((item) => item.complete).length;
  return {
    items,
    missing: items.filter((item) => !item.complete),
    complete: completed === items.length,
    percent: Math.round((completed / items.length) * 100),
  };
}

export function getMissingResumeHeaderItems(profile, fields = ["phone", "location", "linkedin_url"]) {
  return fields
    .filter((field) => !String(profile?.[field] ?? "").trim())
    .map((field) => ({ field, label: profileFieldLabels[field] || field }));
}

export function createEmptyProfile(user) {
  return {
    id: user?.id ?? "local-demo-user",
    full_name: user?.user_metadata?.full_name ?? "",
    email: user?.email ?? "",
    location: "",
    phone: "",
    target_roles: "",
    base_resume_text: "",
    linkedin_url: "",
    portfolio_url: "",
    created_at: new Date().toISOString(),
  };
}
