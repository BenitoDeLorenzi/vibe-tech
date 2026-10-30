import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { hasModuleAccess } from "@/lib/empresa-access";
import type { CurrentUserProfile } from "@/lib/auth-data";
import type { FrotaPrefeituraOption } from "@/lib/frotas-data";
import { HeaderSeparator } from "@/components/header-separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { FrotasCompanyScope } from "./frotas-persistent-frame";
import { FrotasMobileFilters } from "./frotas-mobile-filters";

type FrotasShellProps = {
  loading?: boolean;
  mobileList?: boolean;
  active:
    | "dashboard"
    | "veiculos"
    | "uso-veiculo"
    | "manutencao"
    | "abastecimento"
    | "oficinas"
    | "postos"
    | "motoristas"
    | "secretarias"
    | "relatorios"
    | "notificacoes"
    | "ajuda"
    | "alertas";
  actions?: ReactNode;
  children: ReactNode;
  icon?: LucideIcon;
  prefeituras: FrotaPrefeituraOption[];
  profile: CurrentUserProfile;
  selectedPrefeituraId?: string;
  title: string;
};

export async function FrotasShell({
  loading = false,
  mobileList = false,
  active,
  actions,
  children,
  icon: Icon,
  prefeituras,
  profile,
  selectedPrefeituraId,
  title,
}: FrotasShellProps) {
  if (!(await hasModuleAccess(profile, "frotas-publicas"))) redirect("/portal");
  const isList = mobileList;
  return (
    <>
      {!loading && <FrotasCompanyScope empresa={selectedPrefeituraId} />}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 print:hidden">
        <SidebarTrigger className="-ml-1" />
        <HeaderSeparator />
        <div className="flex min-w-0 items-center gap-2 md:shrink-0">
          {Icon ? <Icon className="size-5 text-muted-foreground" /> : null}
          <h1 className="truncate text-base font-semibold tracking-normal md:text-xl">
            {title}
          </h1>
        </div>
        {actions ? (
          <div
            inert={loading}
            aria-busy={loading}
            className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2"
          >
              {isList && <FrotasMobileFilters route={active} companies={prefeituras} companyId={selectedPrefeituraId} canChooseCompany={profile.role === "bdl_admin"} />}
              <div className={isList ? "frotas-route-actions" : undefined}>{actions}</div>
          </div>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto print:block print:min-h-0 print:overflow-visible">
        {loading && (
          <p role="status" className="sr-only">
            Carregando registros…
          </p>
        )}
        {children}
      </div>
    </>
  );
}
