"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import type { AlarmStatus } from "@/lib/hooks";

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const lastAlarmStatusRef = useRef<AlarmStatus | null>(null);

  const syncAlarmStatus = useCallback(async (shouldNotifyOnArm: boolean) => {
    const { data, error } = await supabase
      .from("alarm_system_state")
      .select("status")
      .eq("id", 1)
      .single();

    if (error || !data) {
      return;
    }

    const nextStatus = data.status as AlarmStatus;
    const previousStatus = lastAlarmStatusRef.current;

    if (
      shouldNotifyOnArm &&
      previousStatus !== null &&
      previousStatus !== "armed" &&
      nextStatus === "armed" &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      "serviceWorker" in navigator
    ) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Alarm armed", {
        body: "The alarm is now on.",
        tag: "alarm-armed",
        data: {
          url: "/remote",
        },
      });
    }

    lastAlarmStatusRef.current = nextStatus;
  }, []);

  useEffect(() => {
    setMounted(true);

    // Optionally set up any global realtime listeners here
    const channel = supabase
      .channel("app-updates")
      .on("broadcast", { event: "test" }, (payload) => {
        console.log("Broadcast received:", payload);
      })
      .subscribe();

    void syncAlarmStatus(false);

    const alarmChannel = supabase
      .channel("alarm-status-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alarm_system_state",
        },
        () => {
          void syncAlarmStatus(true);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(alarmChannel);
    };
  }, [syncAlarmStatus]);

  if (!mounted) {
    return null;
  }

  return children;
}
