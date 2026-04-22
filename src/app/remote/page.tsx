"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type AlarmAction,
  requestAlarmAction,
  useAlarmLogs,
  useAlarmSystem,
} from "@/lib/hooks";

type Feedback = {
  level: "info" | "error";
  text: string;
};

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function RemotePage() {
  const { state, device, loading, error, refetch } = useAlarmSystem();
  const {
    logs,
    loading: logsLoading,
    error: logsError,
    refetch: refetchLogs,
  } = useAlarmLogs(25);

  const [runningAction, setRunningAction] = useState<AlarmAction | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const isBusy = loading || runningAction !== null;
  const alarmStatus = state?.status ?? "disarmed";
  const isOnline = device?.isConnected ?? false;

  const lastEvent = useMemo(() => {
    if (logs.length === 0) return "No alarm events yet";
    const latest = logs[0];
    return `${latest.message} (${new Date(latest.createdAt).toLocaleTimeString()})`;
  }, [logs]);

  async function runAction(action: AlarmAction) {
    try {
      setRunningAction(action);
      const result = await requestAlarmAction(action, "web-remote");

      setFeedback({
        level: result.ok ? "info" : "error",
        text: result.message,
      });

      await Promise.all([refetch(), refetchLogs()]);
    } catch (err) {
      setFeedback({
        level: "error",
        text: err instanceof Error ? err.message : "Failed to send command",
      });
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Alarm Realtime Remote
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            This page is connected to Supabase realtime tables. Arm/disarm/test
            actions are written to the command queue, and all events are logged
            live. Arming is rejected when the physical alarm connection is
            offline.
          </p>
        </header>

        {error ? (
          <Card className="border-destructive/30">
            <CardContent className="pt-4 text-sm text-destructive">
              {error}
              <p className="mt-1 text-muted-foreground">
                Run the SQL script in supabase-init.sql to create the alarm
                tables and functions.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Connection</span>
                <Badge variant={isOnline ? "default" : "destructive"}>
                  {isOnline ? "Online" : "Offline"}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Alarm status</span>
                <Badge
                  variant={alarmStatus === "armed" ? "destructive" : "outline"}
                >
                  {alarmStatus}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last heartbeat</span>
                <span>{formatTimestamp(device?.lastHeartbeatAt)}</span>
              </div>

              <div className="flex flex-col gap-1 pt-1">
                <span className="text-muted-foreground">Last event</span>
                <span>{lastEvent}</span>
              </div>

              {state?.lastError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  Last error: {state.lastError}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Commands are written to alarm_commands and picked up by the
                Raspberry Pi process later. The database already validates
                offline errors for arm, disarm, and test.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={isBusy || alarmStatus === "armed"}
                  onClick={() => runAction("arm")}
                  variant="default"
                >
                  {runningAction === "arm" ? "Arming..." : "Arm Alarm"}
                </Button>
                <Button
                  disabled={isBusy || alarmStatus === "disarmed"}
                  onClick={() => runAction("disarm")}
                  variant="outline"
                >
                  {runningAction === "disarm" ? "Disarming..." : "Disarm Alarm"}
                </Button>
                <Button
                  disabled={isBusy}
                  onClick={() => runAction("test")}
                  variant="secondary"
                >
                  {runningAction === "test" ? "Testing..." : "Test Alarm"}
                </Button>
              </div>

              {feedback ? (
                <div
                  className={
                    feedback.level === "error"
                      ? "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                      : "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
                  }
                >
                  {feedback.text}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Realtime Event Log</CardTitle>
          </CardHeader>
          <CardContent>
            {logsError ? (
              <p className="text-sm text-destructive">{logsError}</p>
            ) : null}

            {logsLoading && logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading logs...</p>
            ) : (
              <div className="max-h-105 space-y-2 overflow-y-auto pr-1">
                {logs.map((entry) => (
                  <div
                    className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2"
                    key={entry.id}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{formatTimestamp(entry.createdAt)}</span>
                      <Badge
                        variant={
                          entry.level === "error"
                            ? "destructive"
                            : entry.level === "warning"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {entry.level}
                      </Badge>
                    </div>
                    <p className="text-sm">{entry.message}</p>
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                      {entry.eventType}
                    </p>
                  </div>
                ))}

                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No events recorded yet.
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
