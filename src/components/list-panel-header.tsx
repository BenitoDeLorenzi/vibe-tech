import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shared heading for list cards, matching the Vehicles screen. */
export function ListPanelHeader({ title, icon: Icon, description, metrics }: {
  title: ReactNode;
  icon?: LucideIcon;
  description?: ReactNode;
  metrics?: ReactNode;
}) {
  return (
    <CardHeader>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
            <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
          </div>}
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
        {metrics && <div className="flex flex-wrap items-center gap-2" aria-label="Resumo da lista">{metrics}</div>}
      </div>
    </CardHeader>
  );
}
