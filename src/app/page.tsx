// src/app/page.tsx

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type AlarmStatus = "armed" | "disarmed";

export default function HomePage() {
  const [alarmStatus, setAlarmStatus] = useState<AlarmStatus>("disarmed");
  const [lastEvent, setLastEvent] = useState<string>("No events yet");
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [heartbeat, setHeartbeat] = useState<boolean>(true);

  // Simple heartbeat indicator (purely frontend, no backend)
  useEffect(() => {
    const interval = setInterval(() => {
      setHeartbeat((prev) => !prev);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Simulate possible connectivity toggle (optional, still local only)
  useEffect(() => {
    const interval = setInterval(() => {
      // In a real app this would reflect backend status,
      // here we just keep it "online" to show stable system.
      setIsOnline(true);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  function formatNow() {
    return new Date().toLocaleTimeString();
  }

  function handleArm() {
    setAlarmStatus("armed");
    setLastEvent(`Alarm armed at ${formatNow()}`);
  }

  function handleDisarm() {
    setAlarmStatus("disarmed");
    setLastEvent(`Alarm disarmed at ${formatNow()}`);
  }

  function handleTest() {
    setLastEvent(`Test alarm triggered at ${formatNow()}`);
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header / Overview */}
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Alarm Control Panel
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Minimal web interface for a school project alarm system built around
            a Raspberry Pi and a custom PCB. The main focus of the project is
            the electronic design; this page provides a simple, reliable way to
            monitor status and trigger core actions.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                System Status
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      heartbeat ? "bg-emerald-500" : "bg-emerald-300"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-muted-foreground">
                    Heartbeat
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Connection</span>
                <Badge
                  variant={isOnline ? "default" : "destructive"}
                  className="capitalize"
                >
                  {isOnline ? "Online" : "Offline"}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Alarm status</span>
                <Badge
                  variant={alarmStatus === "armed" ? "destructive" : "outline"}
                  className="capitalize"
                >
                  {alarmStatus}
                </Badge>
              </div>

              <div className="flex flex-col gap-1 pt-2">
                <span className="text-muted-foreground">Last event</span>
                <span className="text-sm">{lastEvent}</span>
              </div>
            </CardContent>
          </Card>

          {/* Controls Card */}
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Use these actions to simulate the core behaviour of the alarm
                system. All interactions are handled locally in the browser for
                demonstration.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  onClick={handleArm}
                  disabled={alarmStatus === "armed"}
                >
                  Arm Alarm
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDisarm}
                  disabled={alarmStatus === "disarmed"}
                >
                  Disarm Alarm
                </Button>
                <Button variant="secondary" onClick={handleTest}>
                  Test Alarm
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Small project note */}
        <section className="text-xs text-muted-foreground">
          Frontend built with Next.js and shadcn/ui, acting as a thin layer on
          top of the Raspberry Pi and custom PCB electronics. No real backend or
          Realtime connection is used on this page; state is fully mocked for
          demo purposes.
        </section>
      </div>
    </main>
  );
}
