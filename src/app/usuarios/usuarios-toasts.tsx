"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type UsuariosToastsProps = {
  deleted?: string;
  error?: string;
  status?: string;
};

export function UsuariosToasts({ deleted, error, status }: UsuariosToastsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!deleted && !error && !status) {
      return;
    }

    if (deleted) {
      toast.success("Usuário excluído com sucesso.", {
        id: "usuarios-deleted",
      });
    }

    if (error) {
      toast.error(decodeURIComponent(error), {
        id: "usuarios-error",
      });
    }

    if (status === "activated" || status === "deactivated") {
      toast.success(status === "activated" ? "Usuário ativado com sucesso." : "Usuário inativado com sucesso.", {
        id: "usuarios-status",
      });
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("deleted");
    nextParams.delete("error");
    nextParams.delete("status");

    const queryString = nextParams.toString();
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, {
      scroll: false,
    });
  }, [deleted, error, status, pathname, router, searchParams]);

  return null;
}
