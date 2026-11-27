import { sidebarFooterClass } from "@/components/sidebar-styles";
import type { ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { getGestaoContext } from "@/lib/gestao-data";
import { getContasVencendoHojeCount } from "@/lib/gestao-contas-data";
import { SidebarUserMenu } from "@/components/sidebar-user-menu";
import { HeaderSeparator } from "@/components/header-separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { GestaoNav } from "./gestao-nav";
import { GestaoUnidadeContext } from "./gestao-unidade-context";
import { MobileBrandBar } from "@/components/mobile-brand-bar";

// Same composition and dimensions as FrotasShell; domain navigation differs.
export async function GestaoShell({
  title,
  icon: Icon,
  actions,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { profile, empresas, unidades, unidade, gestor } =
    await getGestaoContext();
  const venceHoje = profile.role === "bdl_admin" && unidade
    ? await getContasVencendoHojeCount()
    : 0;
  return (
    <SidebarProvider data-vibe-gestao="" className="h-screen min-h-0 overflow-hidden print:block print:h-auto print:min-h-0 print:overflow-visible print:bg-white">
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <GestaoUnidadeContext
            empresas={empresas}
            unidades={unidades}
            selectedId={unidade?.id}
            master={profile.role === "bdl_admin"}
          />
        </SidebarHeader>
        <SidebarContent>
          <GestaoNav gestor={gestor} master={profile.role === "bdl_admin"} venceHoje={venceHoje} />
        </SidebarContent>
        <SidebarFooter className={sidebarFooterClass}>
          <SidebarMenu>
            <SidebarUserMenu
              emphasized
              profile={profile}
              tooltip="Conta Vibe Gestão"
            />
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden print:m-0 print:block print:min-h-0 print:w-full print:overflow-visible print:rounded-none print:bg-white print:shadow-none">
        <MobileBrandBar section="Gestão" />
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-card/85 px-4 print:hidden">
          <SidebarTrigger className="-ml-1" />
          <HeaderSeparator />
          <div className="flex min-w-0 items-center gap-2 md:shrink-0">
            {Icon && <Icon className="size-5 text-primary" />}
            <h1 className="truncate text-base font-semibold tracking-normal md:text-xl">
              {title}
            </h1>
          </div>
          {actions && (
            <div className="ml-auto flex min-w-0 flex-1 items-center justify-end">
              {actions}
            </div>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto print:block print:min-h-0 print:overflow-visible">
          <main className="flex flex-1 flex-col gap-3 p-4">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
