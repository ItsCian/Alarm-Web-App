import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase-admin";

type DispatchBody = {
  eventType?: string;
  message?: string;
};

type NotificationPayload = {
  title: string;
  body: string;
  tag: string;
  icon: string;
  badge: string;
  url: string;
};

function getPayload(eventType: string, message: string): NotificationPayload {
  const normalizedType = eventType.trim().toLowerCase();
  const normalizedMessage = message.trim();

  if (
    normalizedType === "alarm_warning_10s" ||
    /\b10\s*(s|sec|secs|second|seconds)\b/i.test(normalizedMessage)
  ) {
    return {
      title: "Alarm in 10 seconds",
      body: normalizedMessage || "Warning: alarm will trigger in 10 seconds.",
      tag: "alarm-warning-10s",
      icon: "/icon-192.svg",
      badge: "/notification-badge.svg",
      url: "/remote",
    };
  }

  if (
    normalizedType === "alarm_sounding" ||
    normalizedType === "alarm_triggered"
  ) {
    return {
      title: "Alarm active",
      body: normalizedMessage || "The alarm is sounding now.",
      tag: "alarm-active",
      icon: "/icon-192.svg",
      badge: "/notification-badge.svg",
      url: "/remote",
    };
  }

  return {
    title: "Alarm update",
    body: normalizedMessage || "A new alarm event is available.",
    tag: "alarm-update",
    icon: "/icon-192.svg",
    badge: "/notification-badge.svg",
    url: "/remote",
  };
}

function initWebPush() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:alarm@example.com";

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error("Missing VAPID keys");
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export async function POST(request: Request) {
  const expectedSecret = process.env.PUSH_DISPATCH_SECRET;
  const providedSecret = request.headers.get("x-push-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DispatchBody;
  try {
    body = (await request.json()) as DispatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const eventType = String(body.eventType ?? "");
  const message = String(body.message ?? "");

  if (!eventType && !message) {
    return NextResponse.json(
      { error: "eventType or message is required" },
      { status: 400 },
    );
  }

  try {
    initWebPush();

    const { data, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, subscription")
      .eq("is_active", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const payload = JSON.stringify(getPayload(eventType, message));
    let sentCount = 0;
    let removedCount = 0;

    for (const row of data ?? []) {
      try {
        await webpush.sendNotification(
          row.subscription as webpush.PushSubscription,
          payload,
        );
        sentCount += 1;
      } catch (err) {
        const statusCode =
          typeof err === "object" && err !== null && "statusCode" in err
            ? Number((err as { statusCode: unknown }).statusCode)
            : null;

        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", row.endpoint);
          removedCount += 1;
        }
      }
    }

    return NextResponse.json({ ok: true, sentCount, removedCount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Push dispatch failed" },
      { status: 500 },
    );
  }
}
