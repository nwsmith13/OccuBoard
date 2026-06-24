import { forwardRef } from "react";

export const Card = forwardRef(function Card({ children, className = "", ...props }, ref) {
  return (
    <div ref={ref} className={`rounded-xl border border-slate-200/70 bg-white/95 p-5 shadow-card transition-shadow duration-200 ${className}`} {...props}>
      {children}
    </div>
  );
});
