import { ProfileForm } from "../../components/profile/ProfileForm.jsx";
import { ResumeImportCard } from "../../components/resume/ResumeImportCard.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";

export function SettingsPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
      <Card>
        <h2 className="text-xl font-bold">Profile and base resume</h2>
        <p className="mt-2 text-sm text-slate-600">Keep your core job search identity and resume text ready for each application.</p>
        <div className="mt-5">
          <ProfileForm />
        </div>
      </Card>
      <div className="grid gap-6">
        <ResumeImportCard compact />
        <Card>
          <h2 className="text-xl font-bold">Theme</h2>
          <p className="mt-2 text-sm text-slate-600">Theme controls will live here as the product grows.</p>
          <div className="mt-5 flex gap-3">
            <span className="h-10 w-10 rounded-full border-4 border-brand-200 bg-brand-700" />
            <span className="h-10 w-10 rounded-full border border-slate-200 bg-white" />
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-bold">Account management</h2>
          <p className="mt-2 text-sm text-slate-600">Manage authentication, export, and account deletion settings when backend flows are connected.</p>
          <Button variant="secondary" className="mt-5">Manage account</Button>
        </Card>
      </div>
    </div>
  );
}
