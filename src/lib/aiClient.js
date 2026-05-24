export async function generateAiOutput(action, profile, job, options = {}) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, profile, job, options }),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("AI service is unavailable. Start the serverless route or deploy with the server-only OpenAI key configured.");
  }

  if (!response.ok) {
    throw new Error(data.error || "AI generation failed.");
  }

  return data.result;
}

export function canRunAi(profile) {
  return Boolean(profile?.base_resume_text?.trim() && profile?.target_roles?.trim());
}
