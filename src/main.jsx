import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import posthog from "posthog-js";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { IntelligenceModeProvider } from "./contexts/IntelligenceModeContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import "./styles.css";

posthog.init(import.meta.env.VITE_POSTHOG_PROJECT_TOKEN, {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  defaults: "2026-01-30",
  capture_pageview: false,
});

function PostHogPageTracker() {
  const location = useLocation();
  useEffect(() => {
    posthog.capture("$pageview");
  }, [location.pathname]);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <PostHogPageTracker />
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
