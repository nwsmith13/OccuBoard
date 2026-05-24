export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-lg border border-slate-100 bg-white/95 p-5 shadow-card ${className}`}>
      {children}
    </div>
  );
}
