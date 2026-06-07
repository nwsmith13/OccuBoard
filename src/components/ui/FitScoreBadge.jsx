export function FitScoreBadge({ score, compact = false }) {
  if (!score || !Number.isFinite(Number(score.score))) return null;
  const tone = getFitScoreTone(score.score);
  return (
    <span title={tone.label} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-black ring-1 ${tone.className} ${compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
      <span>{Math.round(Number(score.score))}%</span>
      <span className="font-bold">{tone.label}</span>
    </span>
  );
}

export function getLatestFitScore(jobScores, jobId) {
  return [...jobScores]
    .filter((score) => score.job_id === jobId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

export function getFitScoreTone(score) {
  const value = Number(score);
  if (value >= 90) return { label: "Strong Match", className: "bg-emerald-50 text-emerald-800 ring-emerald-100" };
  if (value >= 80) return { label: "Competitive Match", className: "bg-emerald-50 text-emerald-800 ring-emerald-100" };
  if (value >= 70) return { label: "Viable Match", className: "bg-brand-50 text-brand-800 ring-brand-100" };
  if (value >= 60) return { label: "Stretch Match", className: "bg-amber-50 text-amber-800 ring-amber-100" };
  return { label: "Low Match", className: "bg-rose-50 text-rose-700 ring-rose-100" };
}
