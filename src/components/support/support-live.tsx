"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { SidebarMenuBadge } from "@/components/ui/sidebar";

type SupportLive = { revision: number; unread: number; connected: boolean; refresh: () => void; base: string };
const Context = createContext<SupportLive | null>(null);
export function useSupportLive() {
  const value = useContext(Context);
  if (!value) throw new Error("SupportLiveProvider is required");
  return value;
}
export function SupportLiveProvider({ master = false, empresa, children }: { master?: boolean; empresa?: string; children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = `/api/suporte?${new URLSearchParams({ mode: master ? "master" : "usuario", empresa: empresa ?? "" })}`;
  const refresh = useCallback(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      setRevision(value => value + 1);
    }, 100);
  }, []);
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(base, { cache: "no-store", signal: controller.signal }).then(response => response.ok ? response.json() : Promise.reject()).then(data => setUnread(data.unread)).catch(() => {});
    return () => controller.abort();
  }, [base, revision]);
  useEffect(() => {
    const stream = new EventSource(base.replace("/api/suporte?", "/api/suporte/realtime?"));
    const changed = () => refresh();
    stream.addEventListener("ready", () => { setConnected(true); changed(); });
    stream.addEventListener("changed", changed);
    stream.onerror = () => setConnected(false);
    const visible = () => { if (document.visibilityState === "visible") changed(); };
    document.addEventListener("visibilitychange", visible);
    return () => { stream.close(); document.removeEventListener("visibilitychange", visible); };
  }, [base, refresh]);
  return <Context.Provider value={{ base, revision, unread, connected, refresh }}>{children}</Context.Provider>;
}
export function SupportBadge() {
  const { unread } = useSupportLive();
  if (!unread) return null;
  return <><SidebarMenuBadge className="bg-red-600 text-white peer-hover/menu-button:text-white peer-data-active/menu-button:text-white" aria-label={`${unread} mensagens não lidas`}>{unread > 99 ? "99+" : unread}</SidebarMenuBadge><span className="pointer-events-none absolute right-1 top-1 hidden size-2 rounded-full bg-red-600 ring-2 ring-sidebar group-data-[collapsible=icon]:block" aria-label="Novas mensagens" /></>;
}
