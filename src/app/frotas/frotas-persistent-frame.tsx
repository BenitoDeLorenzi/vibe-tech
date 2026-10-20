"use client";

import {
  NotificationProvider,
  NotificationBadge,
} from "@/app/frotas/notificacoes/notification-center";
import {
  sidebarFooterClass,
  sidebarNavClass,
} from "@/components/sidebar-styles";
import { usePathname, useSearchParams } from "next/navigation";

import { SidebarRouteLink } from "./sidebar-route-link";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { FrotasPrefeituraContext } from "@/app/frotas/frotas-prefeitura-context";
import { SidebarUserMenu } from "@/components/sidebar-user-menu";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Bell,
  Building2,
  Headset,
  Car,
  ChartNoAxesCombined,
  Fuel,
  KeyRound,
  LayoutDashboard,
  Settings,
  UserRoundCog,
  Wrench,
} from "lucide-react";
import type { CurrentUserProfile } from "@/lib/auth-data";
import type { FrotasPermissionAccess } from "@/lib/frotas-permissions";
import type { FrotaPrefeituraOption } from "@/lib/frotas-data";

const CompanyContext = createContext<((id?: string) => void) | null>(null);

export function FrotasCompanyScope({ empresa }: { empresa?: string }) {
  const select = useContext(CompanyContext);
  useLayoutEffect(() => {
    select?.(empresa);
  }, [empresa, select]);
  return null;
}

const navOperacoes = [
  { key: "dashboard", label: "Painel", href: "/frotas", icon: LayoutDashboard },
  { key: "veiculos", label: "Veículos", href: "/frotas/veiculos", icon: Car },
  {
    key: "uso-veiculo",
    label: "Uso do Veículo",
    href: "/frotas/uso-veiculo",
    icon: KeyRound,
  },
  {
    key: "manutencao",
    label: "Manutenção",
    href: "/frotas/manutencao",
    icon: Wrench,
  },
  {
    key: "abastecimento",
    label: "Abastecimento",
    href: "/frotas/abastecimento",
    icon: Fuel,
  },
] as const;

const navCadastros = [
  {
    key: "secretarias",
    label: "Secretarias",
    href: "/frotas/secretarias",
    icon: Building2,
  },
  {
    key: "oficinas",
    label: "Oficinas",
    href: "/frotas/oficinas",
    icon: Wrench,
  },
  {
    key: "postos",
    label: "Postos de Combustível",
    href: "/frotas/postos",
    icon: Fuel,
  },
  {
    key: "motoristas",
    label: "Motoristas",
    href: "/frotas/motoristas",
    icon: UserRoundCog,
  },
] as const;

const navAdministracao = [
  {
    key: "ajuda",
    label: "Central de Ajuda",
    href: "/frotas/ajuda",
    icon: Headset,
  },
  {
    key: "relatorios",
    label: "Relatórios",
    href: "/frotas/relatorios",
    icon: ChartNoAxesCombined,
  },
  {
    key: "notificacoes",
    label: "Notificações",
    href: "/frotas/notificacoes",
    icon: Bell,
  },
  { label: "Configurações", href: "#", icon: Settings },
] as const;

export function FrotasPersistentFrame({
  children,
  profile,
  prefeituras,
  access,
}: {
  children: ReactNode;
  profile: CurrentUserProfile;
  prefeituras: FrotaPrefeituraOption[];
  access: FrotasPermissionAccess;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [pageEmpresa, setPageEmpresa] = useState<string | undefined>();
  const requested = search.get("prefeitura");
  const selectedPrefeituraId =
    profile.role === "bdl_admin"
      ? requested && prefeituras.some((item) => item.id === requested)
        ? requested
        : (pageEmpresa ?? prefeituras[0]?.id)
      : (profile.prefeitura_id ?? undefined);
  const active = pathname === "/frotas" ? "dashboard" : pathname.split("/")[2];
  const hrefFor = (href: string) =>
    href === "#" || !selectedPrefeituraId
      ? href
      : `${href}?prefeitura=${selectedPrefeituraId}`;
  const visibleOperacoes = navOperacoes.filter((item) => {
    if (item.key === "dashboard") {
      return true;
    }

    if (item.key === "veiculos") {
      return access.canViewVeiculos;
    }

    if (item.key === "uso-veiculo") {
      return access.canViewUsoVeiculo;
    }

    if (item.key === "manutencao") {
      return access.canViewManutencao;
    }

    if (item.key === "abastecimento") {
      return access.canViewAbastecimento;
    }

    return true;
  });
  const visibleCadastros = navCadastros.filter((item) => {
    if (item.key === "secretarias")
      return (
        Boolean(
          prefeituras.find((empresa) => empresa.id === selectedPrefeituraId)
            ?.is_prefeitura,
        ) &&
        (access.isFullAccess ||
          access.keys.includes("departments.read") ||
          access.keys.includes("departments.manage"))
      );
    if (access.isFullAccess) {
      return true;
    }

    if (!("key" in item)) {
      return false;
    }

    if (item.key === "oficinas")
      return (
        access.keys.includes("workshops.read") ||
        access.keys.includes("workshops.manage")
      );

    if (item.key === "postos") {
      return (
        access.keys.includes("fuel_stations.read") ||
        access.keys.includes("fuel_stations.manage")
      );
    }

    if (item.key === "motoristas") {
      return access.canViewMotoristas;
    }

    return false;
  });
  const visibleAdministracao = navAdministracao.filter((item) => {
    if ("key" in item && item.key === "ajuda") return true;
    if ("key" in item && item.key === "notificacoes") return true;
    if ("key" in item && item.key === "relatorios") {
      return access.canViewRelatorios;
    }

    return access.isFullAccess;
  });

  return (
    <CompanyContext.Provider value={setPageEmpresa}>
      <NotificationProvider
        key={`${profile.id}-${selectedPrefeituraId}`}
        empresa={selectedPrefeituraId}
        enabled
      >
        <SidebarProvider className="h-screen min-h-0 overflow-hidden print:block print:h-auto print:min-h-0 print:overflow-visible print:bg-white">
          <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
              <FrotasPrefeituraContext
                prefeituras={prefeituras}
                profile={profile}
                selectedPrefeituraId={selectedPrefeituraId}
              />
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Operações</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleOperacoes.map((item) => (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          className={sidebarNavClass}
                          isActive={active === item.key}
                          tooltip={item.label}
                          render={
                            <SidebarRouteLink href={hrefFor(item.href)} />
                          }
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              {visibleCadastros.length ? (
                <>
                  <SidebarSeparator />
                  <SidebarGroup>
                    <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {visibleCadastros.map((item) => (
                          <SidebarMenuItem key={item.label}>
                            <SidebarMenuButton
                              className={sidebarNavClass}
                              isActive={"key" in item && active === item.key}
                              tooltip={item.label}
                              render={
                                <SidebarRouteLink href={hrefFor(item.href)} />
                              }
                            >
                              <item.icon />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </>
              ) : null}
              {visibleAdministracao.length ? (
                <>
                  <SidebarSeparator />
                  <SidebarGroup>
                    <SidebarGroupLabel>Administração</SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {visibleAdministracao.map((item) => (
                          <SidebarMenuItem key={item.label}>
                            <SidebarMenuButton
                              className={sidebarNavClass}
                              isActive={"key" in item && active === item.key}
                              tooltip={item.label}
                              render={
                                <SidebarRouteLink href={hrefFor(item.href)} />
                              }
                            >
                              <item.icon />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                            {"key" in item && item.key === "notificacoes" && (
                              <NotificationBadge />
                            )}
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </>
              ) : null}
            </SidebarContent>
            <SidebarFooter className={sidebarFooterClass}>
              <SidebarMenu>
                <SidebarUserMenu
                  emphasized
                  profile={profile}
                  tooltip="Conta Vibe Frotas"
                />
              </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>

          <SidebarInset className="min-h-0 overflow-hidden print:m-0 print:block print:min-h-0 print:w-full print:overflow-visible print:rounded-none print:bg-white print:shadow-none">
            {children}
          </SidebarInset>
        </SidebarProvider>
      </NotificationProvider>
    </CompanyContext.Provider>
  );
}
