"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormSelect } from "@/components/form-select";

export function CategoriaFilter({
  categorias,
  value,
}: {
  categorias: { id: string; nome: string }[];
  value?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div className="w-36 shrink-0 sm:w-48">
      <FormSelect
        aria-label="Filtrar produtos por categoria"
        groupLabel="Categorias"
        value={value || "todas"}
        options={[
          { value: "todas", label: "Todas as categorias" },
          ...categorias.map((categoria) => ({
            value: categoria.id,
            label: categoria.nome,
          })),
        ]}
        onValueChange={(categoria) => {
          const query = new URLSearchParams(searchParams.toString());
          query.delete("limite");
          if (categoria === "todas") query.delete("categoria");
          else query.set("categoria", categoria);
          const search = query.toString();
          router.push(`/gestao/produtos${search ? `?${search}` : ""}`, {
            scroll: false,
          });
        }}
      />
    </div>
  );
}
