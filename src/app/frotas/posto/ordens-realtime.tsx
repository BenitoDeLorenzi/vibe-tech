"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function OrdensRealtime({ nextExpiry }: { nextExpiry: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const source = new EventSource("/frotas/posto/realtime");
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 300);
    };
    source.addEventListener("ready", refresh);
    source.addEventListener("changed", refresh);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { source.close(); clearTimeout(refreshTimer); document.removeEventListener("visibilitychange", onVisible); };
  }, [router]);
  useEffect(() => {
    if (!nextExpiry) return;
    // Expiration happens with the clock, even when no database event is emitted.
    const delay = Math.min(Math.max(Date.parse(nextExpiry) - Date.now() + 1000, 1000), 2147483647);
    const timer = setTimeout(() => router.refresh(), delay);
    return () => clearTimeout(timer);
  }, [nextExpiry, router]);
  return null;
}
