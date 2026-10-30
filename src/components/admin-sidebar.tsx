import {
  sidebarFooterClass,
  sidebarNavClass,
} from "@/components/sidebar-styles";
import Link from "next/link";
import { SupportBadge } from "@/components/support/support-live";
import { SidebarIdentity } from "@/components/sidebar-identity";
import { AdminSidebarLink } from "@/components/admin-sidebar-link";
import {
  CircleDollarSign,
  Building2,
  Headset,
  Car,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  Settings,
  Store,
  ShieldCheck,
  Users,
} from "lucide-react";

import { SidebarUserMenu } from "@/components/sidebar-user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import type { CurrentUserProfile } from "@/lib/auth-data";

type AdminSidebarProps = {
  active:
    | "dashboard"
    | "empresas"
    | "licencas"
    | "cobrancas"
    | "usuarios"
    | "atendimentos"
    | "integracoes";
  profile: CurrentUserProfile;
};

const navOperacoes = [
  { key: "dashboard", label: "Visão geral", href: "/", icon: LayoutDashboard },
  { key: "empresas", label: "Empresas", href: "/empresas", icon: Building2 },
  { key: "licencas", label: "Licenças", href: "/licencas", icon: KeyRound },
  { key: "cobrancas", label: "Cobranças", href: "/cobrancas", icon: CircleDollarSign },
  { key: "usuarios", label: "Usuários", href: "/usuarios", icon: Users },
] as const;

const navModulos = [
  { label: "Vibe Frotas", href: "/frotas", icon: Car },
  { label: "Vibe Gestão", href: "/gestao", icon: Store },
] as const;

const navAdministracao = [
  { key: "atendimentos", label: "Atendimentos", href: "/atendimentos", icon: Headset },
  { key: "configuracoes", label: "Configurações", href: "#", icon: Settings },
  { key: "seguranca", label: "Segurança", href: "#", icon: ShieldCheck },
] as const;

export function AdminSidebar({ active, profile }: AdminSidebarProps) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarIdentity
          icon={<ShieldCheck className="size-4 text-muted-foreground" />}
          name="Vibe Tech"
          description="Portal administrativo"
          logoUrl="/brand/vibe-tech-icon.png"
        />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navOperacoes.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    className={sidebarNavClass}
                    isActive={active === item.key}
                    tooltip={item.label}
                    render={<AdminSidebarLink href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navModulos.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    className={sidebarNavClass}
                    tooltip={`${item.label} · abrir em nova aba`}
                    render={
                      <Link href={item.href} target="_blank" rel="noreferrer" />
                    }
                  >
                    <item.icon />
                    <span>{item.label}</span>
                    <ExternalLink className="ml-auto size-3.5 text-muted-foreground" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Administração</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navAdministracao.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    className={sidebarNavClass}
                    isActive={active === item.key}
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.key === "atendimentos" && <SupportBadge />}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={sidebarFooterClass}>
        <SidebarMenu>
          <SidebarUserMenu
            emphasized
            profile={profile}
            tooltip="Conta Vibe Tech"
          />
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
