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
        className={`${compact ? "h-11 w-11 object-contain" : `${sidebar ? "h-20" : "h-16"} w-auto max-w-full object-contain`} ${className}`}
      />
    </div>
  );
}
