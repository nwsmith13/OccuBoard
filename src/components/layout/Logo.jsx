import occuboardLogo from "../../../assets/occuboard-logo.svg";
import occuboardMark from "../../../assets/occuboard-mark.svg";

export function Logo({ compact = false, sidebar = false }) {
  if (sidebar && !compact) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={occuboardMark}
          alt=""
          aria-hidden="true"
          className="h-20 w-20 shrink-0 object-contain"
        />
        <span className="truncate text-2xl font-bold tracking-normal text-brand-800">OccuBoard</span>
      </div>
    );
  }

  return (
    <div className={compact ? "flex items-center justify-center" : "leading-tight"}>
      <img
        src={compact ? occuboardMark : occuboardLogo}
        alt={compact ? "OccuBoard" : "OccuBoard logo"}
        className={compact ? "h-14 w-14 object-contain" : "h-16 w-auto max-w-full object-contain"}
      />
    </div>
  );
}
