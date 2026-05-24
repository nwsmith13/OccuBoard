import occuboardLogo from "../../../assets/occuboard-logo.svg";
import occuboardMark from "../../../assets/occuboard-mark.svg";

export function Logo({ compact = false }) {
  return (
    <div className={compact ? "flex items-center justify-center" : "leading-tight"}>
      <img
        src={compact ? occuboardMark : occuboardLogo}
        alt={compact ? "OccuBoard" : "OccuBoard logo"}
        className={compact ? "h-10 w-10 object-contain" : "h-10 w-auto object-contain"}
      />
      {!compact && <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-brand-500">An ARSO Solutions product</div>}
    </div>
  );
}
