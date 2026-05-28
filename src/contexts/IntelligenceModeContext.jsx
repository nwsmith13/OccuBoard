import { createContext, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "occuboard-intelligence-mode";
const IntelligenceModeContext = createContext(null);

export function IntelligenceModeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved === "strategic" ? "strategic" : "compact";
    } catch {
      return "compact";
    }
  });

  function setMode(nextMode) {
    const normalized = nextMode === "strategic" ? "strategic" : "compact";
    setModeState(normalized);
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // Local storage can fail in private or restricted contexts; compact remains the fallback.
    }
  }

  const value = useMemo(() => ({
    mode,
    setMode,
    isCompact: mode === "compact",
    isStrategic: mode === "strategic",
  }), [mode]);

  return <IntelligenceModeContext.Provider value={value}>{children}</IntelligenceModeContext.Provider>;
}

export function useIntelligenceMode() {
  const context = useContext(IntelligenceModeContext);
  if (!context) {
    return {
      mode: "compact",
      setMode: () => {},
      isCompact: true,
      isStrategic: false,
    };
  }
  return context;
}

export function StrategicOnly({ children }) {
  const { isStrategic } = useIntelligenceMode();
  return isStrategic ? children : null;
}

export function CompactOnly({ children }) {
  const { isCompact } = useIntelligenceMode();
  return isCompact ? children : null;
}
