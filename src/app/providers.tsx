"use client";

import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Optionally set up any global realtime listeners here
    const channel = supabase
      .channel("app-updates")
      .on("broadcast", { event: "test" }, (payload) => {
        console.log("Broadcast received:", payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!mounted) {
    return null;
  }

  return children;
}
