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
  const lastNotifiedTriggerLogIdRef = useRef<string | null>(null);

  const showBrowserNotification = useCallback(
    async (title: string, body: string, tag: string) => {
      if (
        !("Notification" in window) ||
        Notification.permission !== "granted" ||
        !("serviceWorker" in navigator)
      ) {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        tag,
        data: {
          url: "/remote",
        },
      });
    },
    [],
  );

  const syncAlarmStatus = useCallback(
    async (shouldNotifyOnArm: boolean) => {
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
        nextStatus === "armed"
      ) {
        await showBrowserNotification(
          "Alarm armed",
          "The alarm is now on.",
          "alarm-armed",
        );
      }

      lastAlarmStatusRef.current = nextStatus;
    },
    [showBrowserNotification],
  );

  const notifyIfAlarmTriggered = useCallback(
    async (payload: { new?: Record<string, unknown> }) => {
      const nextRow = payload.new;
      if (!nextRow) {
        return;
      }

      const eventType = String(nextRow.event_type ?? "");
      if (eventType !== "alarm_triggered") {
        return;
      }

      const logId = String(nextRow.id ?? "");
      if (logId && lastNotifiedTriggerLogIdRef.current === logId) {
        return;
      }

      if (logId) {
        lastNotifiedTriggerLogIdRef.current = logId;
      }

      const message = String(
        nextRow.message ?? "Alarm is active. Check the remote view now.",
      );
      await showBrowserNotification("Alarm active", message, "alarm-triggered");
    },
    [showBrowserNotification],
  );

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

    const alarmTriggerChannel = supabase
      .channel("alarm-trigger-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alarm_logs",
        },
        (payload) => {
          void notifyIfAlarmTriggered(
            payload as { new?: Record<string, unknown> },
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(alarmChannel);
      supabase.removeChannel(alarmTriggerChannel);
    };
  }, [notifyIfAlarmTriggered, syncAlarmStatus]);

  if (!mounted) {
    return null;
  }

  return children;
}
