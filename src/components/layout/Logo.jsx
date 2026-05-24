export function Logo({ compact = false }) {
  return (
    <div className="leading-tight">
      <div className="text-xl font-bold tracking-normal text-brand-800">OccuBoard</div>
      {!compact && <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-brand-300">by ARSO</div>}
    </div>
  );
}
