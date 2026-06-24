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
        className={`${compact ? "h-10 w-10 object-contain" : `${sidebar ? "h-16" : "h-16"} w-auto max-w-full object-contain`} ${className}`}
      />
    </div>
  );
}
