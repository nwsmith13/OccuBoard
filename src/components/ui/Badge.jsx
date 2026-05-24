const tones = {
  Saved: "bg-cyan-100 text-cyan-800 ring-1 ring-cyan-200",
  Applied: "bg-blue-100 text-blue-800 ring-1 ring-blue-200",
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
