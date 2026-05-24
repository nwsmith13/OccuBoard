const variants = {
  primary: "bg-brand-700 text-white shadow-soft hover:bg-brand-800",
  secondary: "bg-white text-brand-800 ring-1 ring-brand-200 hover:bg-brand-50",
  ghost: "text-ink hover:bg-brand-50",
  danger: "bg-red-50 text-red-700 hover:bg-red-100",
};

export function Button({ children, className = "", variant = "primary", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
