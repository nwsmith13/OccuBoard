import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

const fallbackToast = {
  notify: () => {},
  success: () => {},
  warning: () => {},
  error: () => {},
  info: () => {},
  dismiss: () => {},
};

const variants = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-100 bg-white text-emerald-900 shadow-soft",
    iconClassName: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-amber-100 bg-white text-amber-950 shadow-soft",
    iconClassName: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  error: {
    icon: XCircle,
    className: "border-rose-100 bg-white text-rose-950 shadow-soft",
    iconClassName: "bg-rose-50 text-rose-700 ring-rose-100",
  },
  info: {
    icon: Info,
    className: "border-brand-100 bg-white text-ink shadow-soft",
    iconClassName: "bg-brand-50 text-brand-700 ring-brand-100",
  },
};

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((toast) => {
    const id = makeId();
    const nextToast = {
      id,
      variant: toast.variant || "info",
      title: toast.title || "",
      message: toast.message || toast.title || "",
    };
    setToasts((current) => [...current.slice(-3), nextToast]);
    window.setTimeout(() => dismiss(id), toast.duration ?? (nextToast.variant === "error" ? 4200 : 3200));
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({
    notify,
    success: (message, options = {}) => notify({ ...options, message, variant: "success" }),
    warning: (message, options = {}) => notify({ ...options, message, variant: "warning" }),
    error: (message, options = {}) => notify({ ...options, message, variant: "error" }),
    info: (message, options = {}) => notify({ ...options, message, variant: "info" }),
    dismiss,
  }), [dismiss, notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext) || fallbackToast;
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[120] grid w-[min(380px,calc(100vw-2rem))] gap-2">
      {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />)}
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  const variant = variants[toast.variant] || variants.info;
  const Icon = variant.icon;
  return (
    <div className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3 py-3 text-sm animate-toast-in ${variant.className}`} role="status">
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 ${variant.iconClassName}`}>
        <Icon size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        {toast.title && <p className="font-bold leading-5 text-ink">{toast.title}</p>}
        <p className="leading-5 text-slate-600">{toast.message}</p>
      </div>
      <button type="button" className="rounded-md p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200" onClick={onDismiss} aria-label="Dismiss notification">
        <X size={14} />
      </button>
    </div>
  );
}
