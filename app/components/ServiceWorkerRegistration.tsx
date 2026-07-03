"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Flush offline queue and clear the Home Screen icon badge on focus
      const flush = () => {
        reg.active?.postMessage({ type: "FLUSH_QUEUE" });
        reg.active?.postMessage({ type: "CLEAR_BADGE" });
      };
      window.addEventListener("focus", flush, { passive: true });
      flush();
      return () => window.removeEventListener("focus", flush);
    });
  }, []);

  return null;
}
