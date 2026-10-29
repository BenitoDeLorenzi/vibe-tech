"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { refreshStaleInterBillingsAction } from "./inter-actions";

export function InterAutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    let running = false;
    const check = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        const updated = await refreshStaleInterBillingsAction();
        if (active && updated) router.refresh();
      } catch { /* a próxima execução tenta novamente */ }
      finally { running = false; }
    };
    if (enabled) void check();
    const source = enabled ? new EventSource("/cobrancas/realtime") : null;
    source?.addEventListener("changed", () => router.refresh());
    const bankTimer = enabled ? window.setInterval(() => void check(), 5 * 60_000) : undefined;
    const screenTimer = enabled ? window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000) : undefined;
    return () => {
      active = false;
      if (bankTimer) window.clearInterval(bankTimer);
      if (screenTimer) window.clearInterval(screenTimer);
      source?.close();
    };
  }, [router, enabled]);
  return null;
}
