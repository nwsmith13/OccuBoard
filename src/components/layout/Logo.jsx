import occuboardLogo from "../../../assets/occuboard-logo.svg";
import occuboardMark from "../../../assets/occuboard-mark.svg";

export function Logo({ compact = false }) {
  return (
    <div className={compact ? "flex items-center justify-center" : "leading-tight"}>
      <img
        src={compact ? occuboardMark : occuboardLogo}
        alt={compact ? "OccuBoard" : "OccuBoard logo"}
        className={compact ? "h-12 w-12 object-contain" : "h-16 w-auto max-w-full object-contain"}
      />
    </div>
  );
}
