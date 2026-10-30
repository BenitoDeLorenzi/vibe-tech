import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shared heading for list cards, matching the Vehicles screen. */
export function ListPanelHeader({ title, icon: Icon, description, metrics, mobileMetricsOnly = false }: {
  title: ReactNode;
  icon?: LucideIcon;
  description?: ReactNode;
  metrics?: ReactNode;
  mobileMetricsOnly?: boolean;
}) {
  return (
    <CardHeader className={cn(mobileMetricsOnly && "px-0 pb-3 md:px-(--card-spacing) md:pb-0 [&_[data-slot=badge]]:max-md:h-7 [&_[data-slot=badge]]:max-md:gap-1 [&_[data-slot=badge]]:max-md:px-2 [&_[data-slot=badge]]:max-md:text-[11px] [&_[data-slot=badge]_svg]:max-md:size-3")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className={cn("flex min-w-0 items-center gap-3", mobileMetricsOnly && "hidden md:flex")}>
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
