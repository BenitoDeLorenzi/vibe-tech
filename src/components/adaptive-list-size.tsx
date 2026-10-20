"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const rowHeights = new Map<string, number>();

/** Measures the actual rows, including wrapped text, and reserves the footer. */
export function AdaptiveListSize({ size, onSizeChange, maximum = 50, loading = false }: {
  size: number; onSizeChange: (size: number) => void; maximum?: number; loading?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const measured = useRef({ width: 0, height: 0 });
  useEffect(() => {
    const marker = ref.current;
    const content = marker?.closest<HTMLElement>('[data-slot="card-content"]');
    const table = content?.querySelector<HTMLTableElement>("table");
    const frame = table?.parentElement?.parentElement;
    const main = content?.closest("main");
    const footer = marker?.parentElement;
    if (!content || !table || !frame || !main || !footer || loading) return;
    let timer: ReturnType<typeof setTimeout>;
    const measure = () => {
      const rows = Array.from(table.querySelectorAll("tbody tr"))
        .filter(row => !row.querySelector("[colspan]"));
      if (!rows.length) return;
      const width = table.getBoundingClientRect().width;
      if (Math.abs(measured.current.width - width) > 1) measured.current = { width, height: 0 };
      const key = `${window.location.pathname}:${Math.round(width)}`;
      measured.current.height = Math.max(rowHeights.get(key) ?? 0, measured.current.height, ...rows.map(row => row.getBoundingClientRect().height));
      rowHeights.set(key, measured.current.height);
      const bottom = Math.min(window.innerHeight, main.parentElement?.getBoundingClientRect().bottom ?? window.innerHeight);
      const card = content.closest<HTMLElement>('[data-slot="card"]');
      const padding = parseFloat(getComputedStyle(main).paddingBottom) + parseFloat(getComputedStyle(content).paddingBottom) + (card ? parseFloat(getComputedStyle(card).paddingBottom) : 0);
      const available = Math.max(0, bottom - table.getBoundingClientRect().top - padding - footer.getBoundingClientRect().height - 14);
      // Keep the footer reachable even when a single row is taller than the viewport.
      frame.style.maxHeight = `${available}px`;
      frame.style.overflowY = "auto";
      frame.style.flexShrink = "0";
      const header = table.tHead?.getBoundingClientRect().height ?? 0;
      const next = Math.max(1, Math.min(maximum, Math.floor((available - header - 2) / measured.current.height)));
      if (next !== size) onSizeChange(next);
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(measure, 120); };
    const observer = new ResizeObserver(schedule);
    observer.observe(table);
    observer.observe(footer);
    if (main.parentElement) observer.observe(main.parentElement);
    window.addEventListener("resize", schedule);
    schedule();
    return () => { clearTimeout(timer); observer.disconnect(); window.removeEventListener("resize", schedule); };
  }, [size, onSizeChange, maximum, loading]);
  return <span ref={ref} hidden aria-hidden="true" />;
}

export function RouteListSize({ size }: { size: number }) {
  const router = useRouter();
  const params = useSearchParams();
  return <AdaptiveListSize size={size} onSizeChange={next => {
    const query = new URLSearchParams(params.toString());
    query.set("size", String(next));
    query.set("page", "1");
    router.replace(`?${query}`, { scroll: false });
  }} />;
}
