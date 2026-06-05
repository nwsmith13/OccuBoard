const occuboardLogo = "/assets/occuboard-logo.svg";

export function Logo({ compact = false, sidebar = false }) {
  return (
    <div className={compact ? "flex items-center justify-center overflow-hidden" : "leading-tight"}>
      <img
        src={occuboardLogo}
        alt="OccuBoard logo"
        className={compact ? "h-10 w-14 object-contain" : `${sidebar ? "h-16" : "h-16"} w-auto max-w-full object-contain`}
      />
    </div>
  );
}
