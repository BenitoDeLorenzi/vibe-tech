"use client";
import { sidebarNavClass } from "@/components/sidebar-styles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardCheck,
  Package,
  Tags,
  Percent,
  Warehouse,
  Settings,
  ArrowLeftRight,
  Users,
  Wallet,
  Receipt,
} from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Fragment } from "react";
const groups = [
  {
    label: "Operações",
    items: [
      { href: "/gestao", label: "Painel", icon: LayoutDashboard },
      {
        href: "/gestao/fechamentos",
        label: "Fechamentos",
        icon: ClipboardCheck,
      },
      { href: "/gestao/estoque", label: "Estoque", icon: Warehouse },
      {
        href: "/gestao/estoque/movimentacoes",
        label: "Movimentações",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    label: "Financeiro",
    items: [
      {
        href: "/gestao/financeiro/contas",
        label: "Contas e saldos",
        icon: Wallet,
      },
      {
        href: "/gestao/financeiro/pagar",
        label: "Contas a pagar",
        icon: Receipt,
      },
      {
        href: "/gestao/financeiro/categorias",
        label: "Categorias de despesas",
        icon: Tags,
      },
      {
        href: "/gestao/financeiro/extratos",
        label: "Extratos",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { href: "/gestao/produtos", label: "Produtos", icon: Package },
      { href: "/gestao/categorias", label: "Categorias", icon: Tags },
      { href: "/gestao/taxas", label: "Taxas", icon: Percent },
    ],
  },
  {
    label: "Equipe",
    items: [{ href: "/gestao/equipe", label: "Colaboradores", icon: Users }],
  },
  {
    label: "Administração",
    items: [
      { href: "/gestao/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];
export function GestaoNav({
  gestor = false,
  master = false,
}: {
  gestor?: boolean;
  master?: boolean;
}) {
  const path = usePathname();
  return (
    <>
      {groups
        .filter(
          (group) =>
            (group.label !== "Equipe" || gestor) &&
            (group.label !== "Financeiro" || master),
        )
        .map((group, index) => (
          <Fragment key={group.label}>
            {index > 0 && <SidebarSeparator />}
            <SidebarGroup>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map(({ href, label, icon: Icon }) => (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        isActive={
                          path === href ||
                          (href === "/gestao/fechamentos" &&
                            path.startsWith(href + "/"))
                        }
                        className={sidebarNavClass}
                        tooltip={label}
                        render={
                          <Link
                            href={href}
                            aria-current={
                              path === href ||
                              (href === "/gestao/fechamentos" &&
                                path.startsWith(href + "/"))
                                ? "page"
                                : undefined
                            }
                          />
                        }
                      >
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </Fragment>
        ))}
    </>
  );
}
