import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import posthog from "posthog-js";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { IntelligenceModeProvider } from "./contexts/IntelligenceModeContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { SeoManager } from "./components/seo/SeoManager.jsx";
import "./styles.css";

const posthogKey = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN || import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

globalThis.console?.log?.("[PostHog] init", { hasKey: Boolean(posthogKey), host: posthogHost });

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    defaults: "2026-01-30",
    capture_pageview: false,
  });
}

function PostHogPageTracker() {
  const location = useLocation();
  useEffect(() => {
    if (posthogKey) posthog.capture("$pageview");
  }, [location.pathname]);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <PostHogPageTracker />
      <SeoManager />
      <AuthProvider>
        <ToastProvider>
          <IntelligenceModeProvider>
            <App />
          </IntelligenceModeProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
