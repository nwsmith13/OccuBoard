const profileFields = [
  "full_name",
  "email",
  "location",
  "phone",
  "target_roles",
  "base_resume_text",
  "linkedin_url",
  "portfolio_url",
];

export function getProfileCompleteness(profile) {
  if (!profile) return 0;
  const completed = profileFields.filter((field) => Boolean(String(profile[field] ?? "").trim())).length;
  return Math.round((completed / profileFields.length) * 100);
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
