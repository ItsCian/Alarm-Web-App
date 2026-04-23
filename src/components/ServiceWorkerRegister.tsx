"use client";

import { useEffect } from "react";

const NOTIFICATION_PROMPT_KEY = "alarm-notification-prompted";

export function ServiceWorkerRegister() {
  useEffect(() => {
    let updateInterval: ReturnType<typeof setInterval> | null = null;

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered successfully:", registration);

          // Check for updates periodically
          updateInterval = setInterval(() => {
            registration.update();
          }, 60000); // Check every minute

          if (
            "Notification" in window &&
            Notification.permission === "default"
          ) {
            const alreadyPrompted =
              window.localStorage.getItem(NOTIFICATION_PROMPT_KEY) === "true";

            if (alreadyPrompted) {
              return;
            }

            window.localStorage.setItem(NOTIFICATION_PROMPT_KEY, "true");

            const wantsNotifications = window.confirm(
              "Would you like to enable notifications for alarm status updates?",
            );

            if (wantsNotifications) {
              Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                  registration.showNotification("Alarm notifications enabled", {
                    body: "You will now receive important alarm updates.",
                    tag: "notification-enabled",
                  });
                }
              });
            }
          }
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
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return null;
}
