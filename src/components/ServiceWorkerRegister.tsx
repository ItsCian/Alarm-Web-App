"use client";

import { useEffect } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function registerPushSubscription(
  registration: ServiceWorkerRegistration,
) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return;
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscription,
      userAgent: navigator.userAgent,
    }),
  });
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    let updateInterval: ReturnType<typeof setInterval> | null = null;

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (registration) => {
          console.log("Service Worker registered successfully:", registration);

          // Check for updates periodically
          updateInterval = setInterval(() => {
            registration.update();
          }, 60000); // Check every minute

          if (
            "Notification" in window &&
            Notification.permission === "default"
          ) {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
              await registerPushSubscription(registration);
              registration.showNotification("Alarm notifications enabled", {
                body: "You will now receive important alarm updates.",
                tag: "notification-enabled",
                icon: "/icon-192.svg",
                badge: "/notification-badge.svg",
              });
            }
          } else if (Notification.permission === "granted") {
            await registerPushSubscription(registration);
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
