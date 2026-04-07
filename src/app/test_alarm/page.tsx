"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fakeAlarmProcessNextCommand,
  updateAlarmDeviceConnection,
  useAlarmCommands,
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

export default function TestAlarmPage() {
  const { state, device, loading, error, refetch } = useAlarmSystem();
  const { logs, refetch: refetchLogs } = useAlarmLogs(12);
  const { commands, refetch: refetchCommands } = useAlarmCommands("pending");

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [autoProcess, setAutoProcess] = useState(false);

  useEffect(() => {
    if (!autoProcess) return;

    const interval = setInterval(async () => {
      try {
        const result = await fakeAlarmProcessNextCommand();
        if (result.commandId) {
          setFeedback({ level: "info", text: result.message });
          await Promise.all([refetch(), refetchLogs(), refetchCommands()]);
        }
      } catch {
        setAutoProcess(false);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [autoProcess, refetch, refetchCommands, refetchLogs]);

  async function setConnection(nextConnected: boolean) {
    try {
      setBusyAction(nextConnected ? "online" : "offline");
      await updateAlarmDeviceConnection(nextConnected);
      await Promise.all([refetch(), refetchLogs()]);
      setFeedback({
        level: "info",
        text: nextConnected
          ? "Fake alarm is now online"
          : "Fake alarm is now offline",
      });
    } catch (err) {
      setFeedback({
        level: "error",
        text:
          err instanceof Error ? err.message : "Failed to update connection",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function sendHeartbeat() {
    try {
      setBusyAction("heartbeat");
      await updateAlarmDeviceConnection(true);
      await Promise.all([refetch(), refetchLogs()]);
      setFeedback({ level: "info", text: "Heartbeat sent from fake alarm" });
    } catch (err) {
      setFeedback({
        level: "error",
        text: err instanceof Error ? err.message : "Failed to send heartbeat",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function processNext() {
    try {
      setBusyAction("process");
      const result = await fakeAlarmProcessNextCommand();
      setFeedback({
        level: result.ok ? "info" : "error",
        text: result.message,
      });
      await Promise.all([refetch(), refetchLogs(), refetchCommands()]);
    } catch (err) {
      setFeedback({
        level: "error",
        text: err instanceof Error ? err.message : "Failed to process command",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Fake Alarm Simulator
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Temporary device emulator for testing before Raspberry Pi
            integration. Use this page to bring the fake alarm online, send
            heartbeat updates, and process queued commands.
          </p>
        </header>

        {error ? (
          <Card className="border-destructive/30">
            <CardContent className="pt-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Fake Device Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Connection</span>
                <Badge
                  variant={device?.isConnected ? "default" : "destructive"}
                >
                  {device?.isConnected ? "Online" : "Offline"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Alarm state</span>
                <Badge
                  variant={
                    state?.status === "armed" ? "destructive" : "outline"
                  }
                >
                  {state?.status ?? "disarmed"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last heartbeat</span>
                <span>{formatTimestamp(device?.lastHeartbeatAt)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Simulator Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={loading || busyAction !== null}
                  onClick={() => setConnection(true)}
                  variant="default"
                >
                  {busyAction === "online" ? "Updating..." : "Set Online"}
                </Button>
                <Button
                  disabled={loading || busyAction !== null}
                  onClick={() => setConnection(false)}
                  variant="outline"
                >
                  {busyAction === "offline" ? "Updating..." : "Set Offline"}
                </Button>
                <Button
                  disabled={loading || busyAction !== null}
                  onClick={sendHeartbeat}
                  variant="secondary"
                >
                  {busyAction === "heartbeat" ? "Sending..." : "Send Heartbeat"}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={loading || busyAction !== null}
                  onClick={processNext}
                  variant="default"
                >
                  {busyAction === "process"
                    ? "Processing..."
                    : "Process Next Command"}
                </Button>
                <Button
                  disabled={loading || busyAction !== null}
                  onClick={() => setAutoProcess((prev) => !prev)}
                  variant={autoProcess ? "destructive" : "outline"}
                >
                  {autoProcess ? "Stop Auto Process" : "Start Auto Process"}
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

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pending Commands</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-xs text-muted-foreground">
                Requests made from the remote page appear here.
              </p>
              <div className="space-y-2">
                {commands.map((command) => (
                  <div
                    className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-sm"
                    key={command.id}
                  >
                    <p className="font-medium uppercase tracking-wide">
                      {command.action}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requested by {command.requestedBy} at{" "}
                      {formatTimestamp(command.createdAt)}
                    </p>
                  </div>
                ))}

                {commands.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No pending commands.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
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
                  <p className="text-sm text-muted-foreground">No logs yet.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
