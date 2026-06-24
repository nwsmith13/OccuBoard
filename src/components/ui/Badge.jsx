const tones = {
  Saved: "bg-brand-50 text-brand-900 ring-1 ring-brand-200",
  Applied: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100",
  Interview: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  Closed: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
};

export function Badge({ children }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[children] ?? tones.Saved}`}>
      {children}
    </span>
  );
}
