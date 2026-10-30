"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/form-select";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { mobileDrawerContentClassName } from "@/lib/mobile-drawer";
import type { FrotaPrefeituraOption } from "@/lib/frotas-data";

const statuses: Record<string, { value: string; label: string }[]> = {
  veiculos: [{ value: "active", label: "Ativos" }, { value: "maintenance", label: "Manutenção" }, { value: "inactive", label: "Inativos" }],
  "uso-veiculo": [{ value: "in_use", label: "Em uso" }, { value: "returned", label: "Devolvidos" }, { value: "cancelled", label: "Cancelados" }],
  manutencao: [{ value: "open", label: "Abertas" }, { value: "completed", label: "Concluídas" }, { value: "cancelled", label: "Canceladas" }],
  abastecimento: [{ value: "issued", label: "Pendentes" }, { value: "completed", label: "Concluídas" }, { value: "cancelled", label: "Canceladas" }, { value: "expired", label: "Vencidas" }],
  motoristas: [{ value: "active", label: "Ativos" }, { value: "inactive", label: "Inativos" }],
  relatorios: [{ value: "generated", label: "Gerados" }, { value: "archived", label: "Arquivados" }, { value: "cancelled", label: "Cancelados" }],
};

const names: Record<string, string> = {
  veiculos: "veículos", "uso-veiculo": "uso do veículo", manutencao: "manutenções", abastecimento: "abastecimentos",
  secretarias: "secretarias", oficinas: "oficinas", postos: "postos", motoristas: "motoristas", relatorios: "relatórios",
};

export function FrotasMobileFilters({ route, companies, companyId, canChooseCompany }: {
  route: string;
  companies: FrotaPrefeituraOption[];
  companyId?: string;
  canChooseCompany: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [company, setCompany] = useState(companyId ?? "");
  const [type, setType] = useState("");
  const active = Boolean(params.get("status") || params.get("tipo") || (canChooseCompany && params.get("prefeitura") && params.get("prefeitura") !== companyId));

  function apply(clear = false) {
    const next = new URLSearchParams();
    if (params.get("q")) next.set("q", params.get("q")!);
    const selectedCompany = clear ? companyId : company;
    if (selectedCompany) next.set("prefeitura", selectedCompany);
    if (!clear) {
      if (status) next.set("status", status);
      if (type) next.set("tipo", type);
    }
    setOpen(false);
    router.push(`${pathname}?${next}`);
  }

  return <div className="md:hidden"><Drawer open={open} onOpenChange={value => {
    setOpen(value);
    if (value) { setStatus(params.get("status") ?? ""); setCompany(params.get("prefeitura") ?? companyId ?? ""); setType(params.get("tipo") ?? ""); }
  }} showSwipeHandle>
    <DrawerTrigger render={<Button type="button" variant="outline" size="icon" className="relative" aria-label={`Filtrar ${names[route] ?? "registros"}`} />}>
      <ListFilter className="size-4" />{active && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary ring-2 ring-background" aria-hidden />}
    </DrawerTrigger>
    <DrawerContent className={mobileDrawerContentClassName}>
      <DrawerHeader className="border-b text-left"><DrawerTitle>Filtrar {names[route] ?? "registros"}</DrawerTitle><DrawerDescription>Escolha os critérios para atualizar a lista.</DrawerDescription></DrawerHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {canChooseCompany && companies.length > 1 && <div className="space-y-2 text-sm font-medium"><label>Empresa</label><FormSelect aria-label="Empresa" value={company} onValueChange={setCompany} options={companies.map(item => ({ value: item.id, label: item.nome }))} /></div>}
        {statuses[route]?.length > 0 && <div className="space-y-2 text-sm font-medium"><label>Situação</label><FormSelect aria-label="Situação" value={status || "all"} onValueChange={value => setStatus(value === "all" ? "" : value)} options={[{ value: "all", label: "Todas" }, ...statuses[route]]} /></div>}
        {route === "relatorios" && <div className="space-y-2 text-sm font-medium"><label>Tipo</label><FormSelect aria-label="Tipo" value={type || "all"} onValueChange={value => setType(value === "all" ? "" : value)} options={[{ value: "all", label: "Todos" }, { value: "expirations", label: "Débitos" }, { value: "fuel", label: "Abastecimentos" }, { value: "maintenance", label: "Manutenções" }, { value: "vehicles", label: "Veículos" }]} /></div>}
      </div>
      <DrawerFooter className="flex-row gap-2 border-t bg-popover p-4"><Button type="button" variant="outline" className="flex-1" onClick={() => apply(true)}>Limpar</Button><Button type="button" className="flex-1" onClick={() => apply()}>Aplicar filtros</Button></DrawerFooter>
    </DrawerContent>
  </Drawer></div>;
}
