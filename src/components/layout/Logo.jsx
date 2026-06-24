const occuboardLogo = "/occuboard-logo.svg";
const occuboardIcon = "/occuboard-icon.svg";

export function Logo({ compact = false, sidebar = false, className = "" }) {
  return (
    <div className={`inline-flex items-center justify-center overflow-hidden bg-white/95 shadow-sm ring-1 ring-slate-200/70 ${compact ? "rounded-xl p-1" : "rounded-2xl px-2 py-1"}`}>
      <img
        src={compact ? occuboardIcon : occuboardLogo}
        alt="OccuBoard logo"
        className={`${compact ? "h-10 w-10 object-contain" : `${sidebar ? "h-16" : "h-16"} w-auto max-w-full object-contain`} ${className}`}
      />
    </div>
  );
}
