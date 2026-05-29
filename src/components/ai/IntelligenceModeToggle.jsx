import { useIntelligenceMode } from "../../contexts/IntelligenceModeContext.jsx";

export function IntelligenceModeToggle({ className = "" }) {
  const { mode, setMode } = useIntelligenceMode();
  const options = [
    ["compact", "Quick Apply"],
    ["strategic", "Recruiter Intelligence"],
  ];

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">View</span>
      <div className="inline-flex rounded-lg bg-slate-50 p-1 ring-1 ring-brand-100" role="group" aria-label="Recruiter intelligence view mode">
        {options.map(([value, label]) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              className={`min-h-8 whitespace-nowrap rounded-md px-3 text-xs font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${
                active
                  ? value === "strategic"
                    ? "bg-brand-900 text-white shadow-sm ring-1 ring-brand-800"
                    : "bg-white text-brand-900 shadow-sm ring-1 ring-brand-100"
                  : "text-slate-500 hover:bg-white/70 hover:text-brand-800"
              }`}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
