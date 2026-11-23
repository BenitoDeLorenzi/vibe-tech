"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { FormSelect } from "@/components/form-select";
export function ContaFilter({
  contas,
  value,
  categorias,
  categoria,
}: {
  contas: { id: string; nome: string }[];
  value?: string;
  categorias: string[];
  categoria?: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  return (
    <div className="flex flex-wrap gap-2">
    <div className="w-48 sm:w-56">
      <FormSelect
        aria-label="Filtrar extrato por conta"
        value={value || "todas"}
        options={[
          { value: "todas", label: "Todas as contas" },
          ...contas.map((c) => ({ value: c.id, label: c.nome })),
        ]}
        onValueChange={(v) => {
          const params = new URLSearchParams(search);
          params.delete("limite");
          if (v === "todas") params.delete("conta");
          else params.set("conta", v);
          router.push("/gestao/financeiro/extratos?" + params.toString());
        }}
      />
    </div>
    <div className="w-44 sm:w-52">
      <FormSelect
        aria-label="Filtrar extrato por categoria"
        value={categoria || "todas"}
        options={[{ value: "todas", label: "Todas as categorias" }, ...categorias.map((nome) => ({ value: nome, label: nome }))]}
        onValueChange={(valor) => {
          const params = new URLSearchParams(search.toString());
          params.delete("limite");
          if (valor === "todas") params.delete("categoria");
          else params.set("categoria", valor);
          router.push(`/gestao/financeiro/extratos?${params.toString()}`, { scroll: false });
        }}
      />
    </div>
    </div>
  );
}
