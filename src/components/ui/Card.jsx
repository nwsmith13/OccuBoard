export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-200/60 bg-white/95 p-5 shadow-card transition-shadow duration-200 ${className}`}>
      {children}
    </div>
  );
}
