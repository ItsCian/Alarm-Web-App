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
  const lastNotifiedLogIdRef = useRef<string | null>(null);

  const getRealtimeAlarmNotification = useCallback(
    (row: Record<string, unknown>) => {
      const eventType = String(row.event_type ?? "");
      const message = String(row.message ?? "");
      const metadata =
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : null;

      if (eventType === "alarm_triggered") {
        return {
          title: "Alarm active",
          body: message || "The alarm is sounding now.",
          tag: "alarm-triggered",
        };
      }

      const hasTenSecondEventType = [
        "alarm_countdown_10s",
        "alarm_warning_10s",
        "alarm_pretrigger_10s",
        "alarm_10s_warning",
      ].includes(eventType);

      const hasTenSecondMetadata =
        metadata?.seconds_remaining === 10 ||
        metadata?.countdown_seconds === 10;

      const hasTenSecondMessage = /\b10\s*(s|sec|secs|second|seconds)\b/i.test(
        message,
      );

      if (
        hasTenSecondEventType ||
        hasTenSecondMetadata ||
        hasTenSecondMessage
      ) {
        return {
          title: "Alarm in 10 seconds",
          body: message || "Warning: alarm will trigger in 10 seconds.",
          tag: "alarm-warning-10s",
        };
      }

      return null;
    },
    [],
  );

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

      const nextNotification = getRealtimeAlarmNotification(nextRow);
      if (!nextNotification) {
        return;
      }

      const logId = String(nextRow.id ?? "");
      if (logId && lastNotifiedLogIdRef.current === logId) {
        return;
      }

      if (logId) {
        lastNotifiedLogIdRef.current = logId;
      }

      await showBrowserNotification(
        nextNotification.title,
        nextNotification.body,
        nextNotification.tag,
      );
    },
    [getRealtimeAlarmNotification, showBrowserNotification],
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
