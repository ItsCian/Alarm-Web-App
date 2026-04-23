import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PushSubscriptionBody = {
  subscription?: PushSubscription;
  userAgent?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PushSubscriptionBody;
    const endpoint = body.subscription?.endpoint;

    if (!body.subscription || !endpoint) {
      return NextResponse.json(
        { error: "Missing push subscription endpoint" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        endpoint,
        subscription: body.subscription,
        user_agent: body.userAgent ?? null,
        is_active: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "endpoint",
      },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
