"use client";
import type { ReactNode } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type CompanyOption = {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string | null;
};
function CompanyAvatar({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string | null;
}) {
  return (
    <Avatar className="size-8 shrink-0 rounded-lg">
      {logoUrl && (
        <AvatarImage
          src={logoUrl}
          alt={`Logo de ${name}`}
          className="object-contain"
        />
      )}
      <AvatarFallback className="rounded-lg bg-sidebar-accent text-xs font-medium">
        {name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0])
          .join("")
          .toUpperCase() || "VT"}
      </AvatarFallback>
    </Avatar>
  );
}
/** Original shadcn company-switcher composition, shared by all modules. */
export function SidebarIdentity({
  moduleName,
  name,
  description,
  logoUrl,
  options,
  selectedId,
  onSelect,
  pending = false,
}: {
  moduleName?: string;
  icon?: ReactNode;
  name: string;
  description?: string;
  logoUrl?: string | null;
  options?: CompanyOption[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  pending?: boolean;
}) {
  const identity = (
    <>
      <CompanyAvatar name={name} logoUrl={logoUrl} />
      <div className="grid min-w-0 flex-1 gap-0.5 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate font-semibold" title={name}>
          {name}
        </span>
        {description && (
          <span
            className="truncate text-xs text-muted-foreground"
            title={description}
          >
            {description}
          </span>
        )}
      </div>
    </>
  );
  return (
    <div className="space-y-2 py-1">
      {moduleName ? <p className="px-2 pt-1 text-xs font-medium tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden">{moduleName}</p> : null}
      <SidebarMenu>
        <SidebarMenuItem>
          {options && onSelect ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    disabled={pending}
                    tooltip={name}
                    aria-label={`Trocar empresa: ${name}`}
                    className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                  />
                }
              >
                {identity}
                <ChevronsUpDown className="ml-auto size-4 shrink-0 group-data-[collapsible=icon]:hidden" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="bottom"
                className="w-64 max-w-[calc(100vw-2rem)]"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Empresas</DropdownMenuLabel>
                  {options.map((option) => (
                    <DropdownMenuItem
                      key={option.id}
                      className="gap-2 p-2"
                      onClick={() => {
                        if (option.id !== selectedId) onSelect(option.id);
                      }}
                    >
                      <CompanyAvatar
                        name={option.name}
                        logoUrl={option.logoUrl}
                      />
                      <div className="grid min-w-0 flex-1">
                        <span className="truncate">{option.name}</span>
                        {option.description && (
                          <span className="truncate text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </div>
                      {option.id === selectedId && (
                        <Check className="ml-auto size-4" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  {!options.length && (
                    <DropdownMenuItem disabled>
                      Nenhuma empresa disponível
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div
              title={name}
              className="flex h-12 w-full items-center gap-2 rounded-lg p-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
            >
              {identity}
            </div>
          )}
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
}
