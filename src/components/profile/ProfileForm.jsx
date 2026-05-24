import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getCompletenessTone } from "../../lib/completenessTone.js";
import { createEmptyProfile, getProfileCompleteness } from "../../lib/profile.js";
import { normalizeResumeText } from "../../lib/resumeParser.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { Button } from "../ui/Button.jsx";
import { Field } from "../ui/Field.jsx";

export function ProfileForm({ compact = false }) {
  const { user } = useAuth();
  const { profile, saveProfile } = useWorkspaceStore();
  const [form, setForm] = useState(profile ?? createEmptyProfile(user));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cleaned, setCleaned] = useState(false);
  const [autoClean, setAutoClean] = useState(true);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const completeness = getProfileCompleteness(form);
  const tone = getCompletenessTone(completeness);
  const update = (event) => {
    setSaved(false);
    setCleaned(false);
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  function cleanBaseResume() {
    setSaved(false);
    setCleaned(true);
    setForm((current) => ({ ...current, base_resume_text: normalizeResumeText(current.base_resume_text ?? "") }));
  }

  async function submit(event) {
    event.preventDefault();
    const payload = autoClean
      ? { ...form, base_resume_text: normalizeResumeText(form.base_resume_text ?? "") }
      : form;
    setSaving(true);
    await saveProfile(user, payload);
    setForm(payload);
    setSaving(false);
    setSaved(true);
    setCleaned(false);
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className={`rounded-lg p-4 transition-colors ${tone.panel}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${tone.text}`}>Profile Completeness</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-600">{tone.label}</p>
          </div>
          <p className={`text-sm font-bold ${tone.text}`}>{completeness}%</p>
        </div>
        <div className={`mt-3 h-2 rounded-full ${tone.track}`}>
          <div className={`h-2 rounded-full transition-all duration-300 ${tone.bar}`} style={{ width: `${completeness}%` }} />
        </div>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <Field id="full_name" label="Full name" name="full_name" value={form.full_name ?? ""} onChange={update} />
        <Field id="email" label="Email" name="email" type="email" value={form.email ?? ""} onChange={update} />
        <Field id="location" label="Location" name="location" value={form.location ?? ""} onChange={update} />
        <Field id="phone" label="Phone" name="phone" value={form.phone ?? ""} onChange={update} />
        <Field id="linkedin_url" label="LinkedIn URL" name="linkedin_url" value={form.linkedin_url ?? ""} onChange={update} />
        <Field id="portfolio_url" label="Portfolio/website URL" name="portfolio_url" value={form.portfolio_url ?? ""} onChange={update} />
      </div>
      <Field
        id="target_roles"
        label="Target roles"
        as="textarea"
        name="target_roles"
        rows="3"
        value={form.target_roles ?? ""}
        onChange={update}
        placeholder="Product manager, Operations lead, Customer success..."
      />
      <div>
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Base resume text</p>
            <p className="mt-1 text-xs text-slate-500">Formatting cleanup runs automatically when you save. Use this if you paste or edit text manually.</p>
          </div>
        </div>
        <Field
          id="base_resume_text"
          label=""
          as="textarea"
          name="base_resume_text"
          rows={compact ? "10" : "16"}
          value={form.base_resume_text ?? ""}
          onChange={update}
          placeholder="Paste your base resume here."
          className="min-h-80 bg-white p-5 font-mono leading-7 text-slate-800 shadow-inner"
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={autoClean}
              onChange={(event) => setAutoClean(event.target.checked)}
              className="h-4 w-4 rounded border-brand-200 text-brand-700 focus:ring-brand-200"
            />
            Clean formatting automatically on save
          </label>
          <Button type="button" variant="secondary" className="min-h-8 px-3 text-xs" onClick={cleanBaseResume}>Re-clean formatting</Button>
        </div>
        {cleaned && <p className="mt-2 text-sm font-semibold text-brand-700">Formatting cleaned. Review, then save your profile.</p>}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button>
        {saved && <p className="text-sm font-semibold text-brand-700">Saved</p>}
      </div>
    </form>
  );
}
