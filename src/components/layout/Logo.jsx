const occuboardLogo = "/occuboard-logo.svg";
const occuboardLogoOnDark = "/occuboard-logo-on-dark.svg";
const occuboardIcon = "/occuboard-icon.svg";

export function Logo({ compact = false, sidebar = false, onDark = false, className = "" }) {
  const src = compact ? occuboardIcon : onDark ? occuboardLogoOnDark : occuboardLogo;
  return (
    <div className="inline-flex items-center justify-center overflow-hidden">
      <img
        src={src}
        alt="OccuBoard logo"
        className={`${compact ? "h-12 w-12 object-contain" : `${sidebar ? "h-24" : "h-20"} w-auto max-w-full object-contain`} ${className}`}
      />
    </div>
  );
}
