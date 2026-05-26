import { forwardRef } from "react";

export const Field = forwardRef(function Field({ label, id, as = "input", className = "", ...props }, ref) {
  const Component = as;
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium text-ink" htmlFor={id}>
      {label}
      <Component
        id={id}
        ref={ref}
        className={`min-w-0 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 hover:border-brand-300 focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-100 ${className}`}
        {...props}
      />
    </label>
  );
});
