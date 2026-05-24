export function getCompletenessTone(value) {
  if (value >= 80) {
    return {
      label: "Strong",
      panel: "bg-emerald-50",
      text: "text-emerald-800",
      track: "bg-emerald-100",
      bar: "bg-emerald-600",
    };
  }
  if (value >= 45) {
    return {
      label: "Building",
      panel: "bg-amber-50",
      text: "text-amber-800",
      track: "bg-amber-100",
      bar: "bg-amber-500",
    };
  }
  return {
    label: "Needs attention",
    panel: "bg-rose-50",
    text: "text-rose-800",
    track: "bg-rose-100",
    bar: "bg-rose-500",
  };
}
