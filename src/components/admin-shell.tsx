import type { ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

import { AdminSidebar } from "@/components/admin-sidebar";
import { SupportLiveProvider } from "@/components/support/support-live";
import { HeaderSeparator } from "@/components/header-separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { CurrentUserProfile } from "@/lib/auth-data";

type AdminShellProps = {
  active:
    | "dashboard"
    | "empresas"
    | "licencas"
    | "cobrancas"
    | "usuarios"
    | "modulos"
    | "atendimentos"
    | "integracoes";
  actions?: ReactNode;
  children: ReactNode;
  icon?: LucideIcon;
  profile: CurrentUserProfile;
  title: string;
};

export function AdminShell({
  active,
  actions,
  children,
  icon: Icon,
  profile,
  title,
}: AdminShellProps) {
  return (
    <SupportLiveProvider master><SidebarProvider className="h-screen min-h-0 overflow-hidden">
      <AdminSidebar active={active} profile={profile} />

      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <HeaderSeparator />
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            {Icon ? <Icon className="size-5 text-muted-foreground" /> : null}
            <h1 className="truncate text-xl font-semibold tracking-normal">
              {title}
            </h1>
          </div>
          {actions ? (
            <div className="ml-auto flex min-w-0 flex-1 items-center justify-end">
              {actions}
            </div>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider></SupportLiveProvider>
  );
}
