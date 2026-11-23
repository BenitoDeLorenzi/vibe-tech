"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function GestaoShowMore({
  shown,
  total,
  param = "limite",
}: {
  shown: number;
  total: number;
  param?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!total) return null;

  return (
    <div className="mt-4 space-y-2">
      {shown < total && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={() => {
            const query = new URLSearchParams(searchParams.toString());
            query.set(param, String(shown + 10));
            startTransition(() =>
              router.push(`${pathname}?${query}`, { scroll: false }),
            );
          }}
        >
          {pending ? "Carregando..." : "Mostrar mais"}
        </Button>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Mostrando {shown} de {total}
      </p>
    </div>
  );
}
