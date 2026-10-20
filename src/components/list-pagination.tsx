import { RouteListSize } from "@/components/adaptive-list-size";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const LIST_PAGE_SIZE = 10;

export function getListPageSize(value?: string) {
  const size = Number(value);
  return Number.isInteger(size) && size >= 1 && size <= 50 ? size : LIST_PAGE_SIZE;
}

export function getListPage(value?: string | number | null) {
  const page = Number(value ?? 1);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function paginateList<T>(items: T[], page: number, pageSize = LIST_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  return {
    items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    page: currentPage,
    pageCount,
    total: items.length,
  };
}

export function ListPagination({
  page,
  pageCount,
  pathname,
  params = {},
}: {
  page: number;
  pageCount: number;
  pathname: string;
  params?: Record<string, string | undefined>;
}) {
  const href = (next: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    query.set("page", String(next));
    return `${pathname}?${query.toString()}`;
  };
  const pages = new Set<number>(pageCount <= 7 ? Array.from({ length: pageCount }, (_, index) => index + 1) : [1, 2, page - 1, page, page + 1, pageCount]);
  const visible = [...pages].filter((item) => item >= 1 && item <= pageCount).sort((a, b) => a - b);
  return (
    <nav aria-label="Paginação" className="mt-auto flex w-full items-center justify-end gap-1 py-3">
      <RouteListSize size={getListPageSize(params.size)} />
      {page > 1 ? (
        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")} href={href(page - 1)}>
          <ChevronLeft className="size-4" /> Anterior
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none gap-1 opacity-50")}>
          <ChevronLeft className="size-4" /> Anterior
        </span>
      )}
      {visible.map((item, index) => (
        <span key={item} className="contents">
          {index > 0 && visible[index - 1] !== item - 1 ? <MoreHorizontal aria-hidden className="mx-1 size-4 text-muted-foreground" /> : null}
          <Link
            aria-current={item === page ? "page" : undefined}
            aria-label={`Página ${item}`}
            className={cn(buttonVariants({ variant: item === page ? "default" : "outline", size: "icon-sm" }))}
            href={href(item)}
          >
            {item}
          </Link>
        </span>
      ))}
      {page < pageCount ? (
        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")} href={href(page + 1)}>
          Próximo <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none gap-1 opacity-50")}>
          Próximo <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
