"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaginationControl({
  page,
  pageCount,
  onPageChange,
  disabled,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const visible = [...new Set(pageCount <= 7 ? Array.from({ length: pageCount }, (_, index) => index + 1) : [1, 2, page - 1, page, page + 1, pageCount])]
    .filter((item) => item >= 1 && item <= pageCount)
    .sort((a, b) => a - b);
  return (
    <nav aria-label="Paginação" className="flex items-center justify-end gap-1 py-2">
      <Button variant="outline" size="sm" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="size-4" /> Anterior
      </Button>
      {visible.map((item, index) => (
        <span key={item} className="contents">
          {index > 0 && visible[index - 1] !== item - 1 ? <MoreHorizontal aria-hidden className="mx-1 size-4 text-muted-foreground" /> : null}
          <Button aria-current={item === page ? "page" : undefined} aria-label={`Página ${item}`} variant={item === page ? "default" : "outline"} size="icon-sm" disabled={disabled} onClick={() => onPageChange(item)}>
            {item}
          </Button>
        </span>
      ))}
      <Button variant="outline" size="sm" disabled={disabled || page >= pageCount} onClick={() => onPageChange(page + 1)}>
        Próximo <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}
