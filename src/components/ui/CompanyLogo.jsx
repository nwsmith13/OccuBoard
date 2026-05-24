import { useEffect, useMemo, useState } from "react";
import { deriveCompanyDomain, getCompanyInitials, getCompanyLogoSources } from "../../lib/companyIdentity.js";

const sizeClasses = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-9 w-9 text-sm",
};

export function CompanyLogo({ companyName = "", companyDomain = "", companyLogoUrl = "", sourceUrl = "", size = "md", className = "" }) {
  const resolvedDomain = companyDomain || deriveCompanyDomain(sourceUrl);
  const sources = useMemo(
    () => getCompanyLogoSources({ companyDomain: resolvedDomain, companyLogoUrl, sourceUrl }),
    [companyLogoUrl, resolvedDomain, sourceUrl],
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = sources[sourceIndex];
  const initials = getCompanyInitials(companyName);
  const baseClass = `${sizeClasses[size] ?? sizeClasses.md} grid shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-brand-100/80 ${className}`;

  useEffect(() => {
    setSourceIndex(0);
  }, [companyLogoUrl, resolvedDomain, sourceUrl]);

  if (src) {
    return (
      <span className={`${baseClass} bg-white shadow-sm`} aria-label={`${companyName || "Company"} logo`}>
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain p-1.5"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setSourceIndex((index) => index + 1)}
        />
      </span>
    );
  }

  return (
    <span
      className={`${baseClass} bg-gradient-to-br from-brand-100 via-white to-emerald-100 font-black text-brand-900 shadow-sm`}
      aria-label={`${companyName || "Company"} initials`}
      title={companyName || "Company"}
    >
      {initials}
    </span>
  );
}
