import { Mail, MessageSquareText, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "../../components/ai/AiToolsPanel.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { generateAiOutput } from "../../lib/aiClient.js";
import { formatDate } from "../../lib/date.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "../../lib/jobDisplay.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";

export function MessagesPage() {
  const { user } = useAuth();
  const { jobs, profile, messages, saveMessage } = useWorkspaceStore();
  const [state, setState] = useState({ loading: "", error: "" });

  async function regenerate(message) {
    const job = jobs.find((item) => item.id === message.job_id);
    if (!job) {
      setState({ loading: "", error: "This message is not connected to a saved job." });
      return;
    }
    setState({ loading: message.id, error: "" });
    try {
      const result = await generateAiOutput("message", profile, job);
      await saveMessage(user, job, result);
      setState({ loading: "", error: "" });
    } catch (error) {
      setState({ loading: "", error: error.message });
    }
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <h2 className="text-xl font-bold">Saved generated messages</h2>
        {state.error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{state.error}</p>}
        <div className="mt-5 grid gap-4">
          {messages.map((message) => {
            const job = jobs.find((item) => item.id === message.job_id);
            return (
              <div key={message.id} className="rounded-lg border border-brand-100 p-4 shadow-card transition hover:border-brand-200 hover:shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <Mail className="mt-1 text-brand-700" size={20} />
                    <div>
                      <p className="font-bold">{message.type === "LinkedIn intro" ? "Recruiter Message" : message.type}</p>
                      <p className="text-sm font-semibold text-brand-800">{job ? `${getDisplayCompanyName(job)} - ${getDisplayJobTitle(job)}` : "Job not found"}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(message.created_at?.slice(0, 10))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyButton text={message.content} />
                    <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => regenerate(message)} disabled={state.loading === message.id}>
                      <RefreshCcw size={14} /> {state.loading === message.id ? "Working..." : "Regenerate"}
                    </Button>
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-wrap rounded-lg bg-brand-50 p-3 text-sm leading-6 text-slate-700">{message.content}</p>
              </div>
            );
          })}
          {!messages.length && <p className="rounded-lg bg-brand-50 p-4 text-sm text-slate-600">Create recruiter outreach drafts tied to saved jobs.</p>}
        </div>
      </Card>
      <Card>
        <h2 className="text-xl font-bold">Saved templates</h2>
        <div className="mt-5 grid gap-3">
          {["Initial outreach", "Post-application follow-up", "Interview thank-you"].map((template) => (
            <div key={template} className="flex items-center gap-3 rounded-lg border border-brand-100 bg-brand-50 p-4">
              <MessageSquareText className="text-brand-700" size={20} />
              <div>
                <p className="font-semibold">{template}</p>
                <p className="text-sm text-slate-500">Editable template placeholder</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
