"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/form-select";
import { mobileDrawerContentClassName } from "@/lib/mobile-drawer";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

type Option = { value: string; label: string };
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function AdminMobileFilters({ pathname, title, query = "", status = "", statusOptions = [], company = "", companyOptions = [], module = "", moduleOptions = [], month = "", currentMonth = "" }: {
  pathname: string;
  title: string;
  query?: string;
  status?: string;
  statusOptions?: Option[];
  company?: string;
  companyOptions?: Option[];
  module?: string;
  moduleOptions?: Option[];
  month?: string;
  currentMonth?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(query);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [selectedCompany, setSelectedCompany] = useState(company);
  const [selectedModule, setSelectedModule] = useState(module);
  const [selectedMonth, setSelectedMonth] = useState(month);
  const active = Boolean(query.trim() || status && status !== "all" || company || module && module !== "all" || month && month !== currentMonth);

  function apply(clear = false) {
    const params = new URLSearchParams();
    if (!clear) {
      if (search.trim()) params.set("q", search.trim());
      if (selectedStatus && selectedStatus !== "all") params.set("status", selectedStatus);
      if (selectedCompany) params.set("empresa", selectedCompany);
      if (selectedModule && selectedModule !== "all") params.set("modulo", selectedModule);
      if (selectedMonth && selectedMonth !== currentMonth) params.set("mes", selectedMonth);
    }
    setOpen(false);
    router.push(`${pathname}${params.size ? `?${params}` : ""}`);
  }

  return <div className="md:hidden">
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger render={<Button type="button" variant="outline" size="icon" aria-label={`Filtrar ${title.toLowerCase()}`} className="relative" />}>
        <ListFilter className="size-4" />
        {active && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary ring-2 ring-background" aria-hidden="true" />}
      </DrawerTrigger>
      <DrawerContent className={mobileDrawerContentClassName}>
        <DrawerHeader className="border-b text-left"><DrawerTitle>Filtrar {title.toLowerCase()}</DrawerTitle><DrawerDescription>Escolha os critérios para atualizar a lista.</DrawerDescription></DrawerHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <label className="block space-y-2 text-sm font-medium">Buscar<Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, CPF ou CNPJ" /></label>
          {statusOptions.length > 0 && <div className="space-y-2 text-sm font-medium"><label>Situação</label><FormSelect aria-label="Situação" value={selectedStatus || "all"} onValueChange={setSelectedStatus} options={statusOptions} /></div>}
          {companyOptions.length > 0 && <div className="space-y-2 text-sm font-medium"><label>Empresa</label><FormSelect aria-label="Empresa" value={selectedCompany || "all"} onValueChange={value => setSelectedCompany(value === "all" ? "" : value)} options={[{ value: "all", label: "Todas as empresas" }, ...companyOptions]} /></div>}
          {moduleOptions.length > 0 && <div className="space-y-2 text-sm font-medium"><label>Módulo</label><FormSelect aria-label="Módulo" value={selectedModule || "all"} onValueChange={setSelectedModule} options={[{ value: "all", label: "Todos os módulos" }, ...moduleOptions]} /></div>}
          {month && <div className="space-y-2 text-sm font-medium"><label>Competência</label><div className="grid grid-cols-[1fr_110px] gap-2">
            <FormSelect aria-label="Mês da competência" value={selectedMonth.slice(5)} onValueChange={value => setSelectedMonth(`${selectedMonth.slice(0, 4)}-${value}`)} options={monthNames.map((label, index) => ({ value: String(index + 1).padStart(2, "0"), label }))} />
            <FormSelect aria-label="Ano da competência" value={selectedMonth.slice(0, 4)} onValueChange={value => setSelectedMonth(`${value}-${selectedMonth.slice(5)}`)} options={Array.from({ length: 16 }, (_, index) => ({ value: String(Number(currentMonth.slice(0, 4)) - 5 + index), label: String(Number(currentMonth.slice(0, 4)) - 5 + index) }))} />
          </div></div>}
        </div>
        <DrawerFooter className="flex-row gap-2 border-t bg-popover p-4"><Button type="button" variant="outline" className="flex-1" onClick={() => apply(true)}>Limpar</Button><Button type="button" className="flex-1" onClick={() => apply()}>Aplicar filtros</Button></DrawerFooter>
      </DrawerContent>
    </Drawer>
  </div>;
}
