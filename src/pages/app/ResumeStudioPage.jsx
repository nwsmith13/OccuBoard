import { useState } from "react";
import { ProfileForm } from "../../components/profile/ProfileForm.jsx";
import { formatDateTime, formatFileSize, ResumeImportCard, ResumeReviewModal } from "../../components/resume/ResumeImportCard.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { normalizeResumeText } from "../../lib/resumeParser.js";
import { createEmptyProfile } from "../../lib/profile.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";

export function ResumeStudioPage() {
  const { user } = useAuth();
  const { profile, resumeUploads, saveProfile } = useWorkspaceStore();
  const [reviewUpload, setReviewUpload] = useState(null);
  const latestUpload = resumeUploads[0];

  async function applyUploadText(text) {
    const currentProfile = profile?.id === user?.id ? profile : createEmptyProfile(user);
    await saveProfile(user, { ...currentProfile, base_resume_text: normalizeResumeText(text) });
    setReviewUpload(null);
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="grid gap-6 self-start">
        {!profile?.base_resume_text?.trim() && (
          <Card className="bg-brand-50/60">
            <h2 className="text-xl font-bold">Upload Your First Resume</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Your resume becomes the foundation for every tailored application.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="#resume-import" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-brand-800">Upload Resume</a>
              <a href="#base-resume" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-50">Paste Resume Manually</a>
            </div>
          </Card>
        )}
        <Card id="base-resume">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-500">Career Profile</p>
          <h2 className="mt-2 text-xl font-bold">Base Resume</h2>
          <p className="mt-2 text-sm text-slate-600">Store the main resume text you want to adapt manually for different roles.</p>
          <BaseResumeSource profile={profile} latestUpload={latestUpload} />
          <div className="mt-5">
            <ProfileForm compact />
          </div>
        </Card>
      </div>
      <div className="grid gap-6">
        <div id="resume-import">
          <section className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-500">Resume Uploads</p>
            <ResumeImportCard />
          </section>
        </div>
        <Card>
          <h2 className="text-xl font-bold">Upload History</h2>
          <div className="mt-5 grid gap-3">
            {resumeUploads.map((upload) => (
              <div key={upload.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-brand-100 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-brand-900">{upload.file_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{upload.file_type} | {formatFileSize(upload.file_size)} | {formatDateTime(upload.created_at)}</p>
                  {latestUpload?.id === upload.id && <span className="mt-2 inline-flex rounded-full bg-brand-100 px-2 py-1 text-[11px] font-bold text-brand-800">Latest import</span>}
                </div>
                <Button variant="secondary" className="w-fit" onClick={() => setReviewUpload(upload)}>Review & Use</Button>
              </div>
            ))}
            {!resumeUploads.length && <p className="rounded-lg bg-brand-50 p-4 text-sm text-slate-600">No resumes uploaded yet.</p>}
          </div>
        </Card>
      </div>
      {reviewUpload && (
        <ResumeReviewModal
          upload={reviewUpload}
          initialText={reviewUpload.extracted_text}
          hasBaseResume={Boolean(profile?.base_resume_text?.trim())}
          loading={false}
          onCancel={() => setReviewUpload(null)}
          onSave={(text) => applyUploadText(text)}
        />
      )}
    </div>
  );
}

function BaseResumeSource({ profile, latestUpload }) {
  if (!profile?.base_resume_text?.trim()) {
    return <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">Upload a resume to start generating tailored applications.</p>;
  }

  if (latestUpload && profile.updated_at && new Date(profile.updated_at) > new Date(latestUpload.created_at)) {
    return <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-slate-600">Last updated manually on {formatDateTime(profile.updated_at)}</p>;
  }

  if (latestUpload) {
    return <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-slate-600">Imported from {latestUpload.file_name} | {formatDateTime(latestUpload.created_at)}</p>;
  }

  return <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-slate-600">Base resume entered manually.</p>;
}
