"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered successfully:", registration);

          // Check for updates periodically
          const interval = setInterval(() => {
            registration.update();
          }, 60000); // Check every minute

          return () => clearInterval(interval);
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }

    // Handle service worker updates
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("Service Worker controller changed, app updated");
      });
    }

    // Detect online/offline status
    const handleOnline = () => {
      console.log("App is online");
    };
    const handleOffline = () => {
      console.log("App is offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return null;
}
