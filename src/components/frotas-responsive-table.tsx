"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

type PageContent = { page: number; content: ReactNode; count: number };

export function FrotasResponsiveTable({ children, page, pageCount, total, count, pathname, params, loading = false }: {
  children: ReactNode;
  page: number;
  pageCount: number;
  total: number;
  count: number;
  pathname: string;
  params: Record<string, string | undefined>;
  loading?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mobile = useIsMobile();
  const [pages, setPages] = useState<PageContent[]>([{ page, content: children, count }]);
  const [pending, setPending] = useState(false);
  const filterKey = `${pathname}:${params.prefeitura ?? ""}:${params.q ?? ""}:${params.status ?? ""}:${params.tipo ?? ""}:${params.registro ?? ""}`;
  const [previous, setPrevious] = useState({ filterKey, page, children, count });
  if (previous.filterKey !== filterKey || previous.page !== page || previous.children !== children || previous.count !== count) {
    setPrevious({ filterKey, page, children, count });
    if (filterKey !== previous.filterKey) {
      setPages([{ page, content: children, count }]);
    } else {
      setPages(current => {
        const index = current.findIndex(item => item.page === page);
        if (index >= 0) return current.map(item => item.page === page ? { page, content: children, count } : item);
        return [...current, { page, content: children, count }].sort((a, b) => a.page - b.page);
      });
    }
    setPending(false);
  }

  useEffect(() => {
    if (!mobile || !searchParams.get("size") || searchParams.get("size") === "10") return;
    const next = new URLSearchParams(searchParams);
    next.set("size", "10");
    next.delete("page");
    router.replace(`${pathname}?${next}`);
  }, [mobile, pathname, router, searchParams]);

  if (!mobile) return <>{children}</>;
  const shown = pages.reduce((sum, item) => sum + item.count, 0);
  const nextPage = Math.max(page, ...pages.map(item => item.page)) + 1;
  function more() {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "size") query.set(key, value);
    query.set("page", String(nextPage));
    query.set("size", "10");
    setPending(true);
    router.push(`${pathname}?${query}`);
  }
  return <div data-fleet-route={pathname} className="space-y-3 md:hidden">
    {pages.map(item => <div key={item.page}>{item.content}</div>)}
    {!loading && nextPage <= pageCount && <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={more}>{pending ? "Carregando…" : "Mostrar mais"}</Button>}
    {!loading && total > 0 && <p className="text-center text-xs text-muted-foreground">Mostrando {shown} de {total}</p>}
  </div>;
}
