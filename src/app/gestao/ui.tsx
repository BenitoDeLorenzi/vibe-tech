import { HeaderSeparator } from "@/components/header-separator";
import { ListPanelHeader } from "@/components/list-panel-header";
import { ListMetric } from "@/components/list-metrics";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  CircleCheck,
  FilePenLine,
  PackageOpen,
  Plus,
  Pencil,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field as BaseField, FieldLabel } from "@/components/ui/field";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
export const inputClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <BaseField className="gap-2">
      <FieldLabel className="grid w-full gap-2">
        {label}
        {children}
      </FieldLabel>
    </BaseField>
  );
}
export function Panel({
  title,
  description,
  children,
  icon: Icon,
  metrics,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  icon?: LucideIcon;
  metrics?: ReactNode;
}) {
  return (
    <Card>
      <ListPanelHeader title={title} icon={Icon} description={description} metrics={metrics} />
      <CardContent>{children}</CardContent>
    </Card>
  );
}
export function MetricBadge({
  label,
  value,
  icon: Icon = BadgeCheck,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: keyof typeof badgeTones;
}) {
  return (
    <ListMetric label={label} value={value} icon={Icon} tone={tone} />
  );
}
export function Empty({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border bg-muted/20 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg border bg-background">
        <PackageOpen className="size-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      {href && (
        <Link
          href={href}
          className={buttonVariants({ className: "mt-4 gap-2" })}
        >
          {action}
        </Link>
      )}
    </div>
  );
}
const badgeTones = {
  neutral: "border-border bg-muted/40 text-muted-foreground",
  danger:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300",
  info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
};

export function ListBadge({
  children,
  icon: Icon,
  tone = "neutral",
}: {
  children: ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof badgeTones;
}) {
  return (
    <Badge
      variant="outline"
      className={`h-6 gap-1.5 rounded-full px-2.5 ${badgeTones[tone]}`}
    >
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  );
}

export function Status({ status }: { status: string }) {
  const conferido = status === "conferido";
  const Icon = conferido ? CircleCheck : FilePenLine;
  return (
    <Badge
      variant="outline"
      className={`h-6 gap-1.5 rounded-full px-2.5 ${badgeTones[conferido ? "success" : "warning"]}`}
    >
      <Icon aria-hidden="true" />
      {conferido ? "Conferido" : "Rascunho"}
    </Badge>
  );
}
export function GestaoDialog({
  title,
  titleBadge,
  description,
  label,
  children,
  wide,
  defaultOpen = false,
  editing = false,
}: {
  title: string;
  titleBadge?: ReactNode;
  description?: string;
  label: string;
  children: ReactNode;
  wide?: boolean;
  defaultOpen?: boolean;
  editing?: boolean;
}) {
  return (
    <Dialog defaultOpen={defaultOpen}>
      {editing ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                aria-label={label}
                title={label}
                className={buttonVariants({
                  variant: editing ? "ghost" : "default",
                  size: editing ? "icon-sm" : "default",
                  className: editing ? "shrink-0" : "h-9 shrink-0 gap-2",
                })}
              >
                {editing ? (
                  <Pencil className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                <span className={editing ? "sr-only" : "hidden sm:inline"}>
                  {label}
                </span>
                <span className="sr-only sm:hidden">{label}</span>
              </DialogTrigger>
            }
          />
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ) : (
        <DialogTrigger
          aria-label={label}
          title={label}
          className={buttonVariants({
            variant: editing ? "ghost" : "default",
            size: editing ? "icon-sm" : "default",
            className: editing ? "shrink-0" : "h-9 shrink-0 gap-2",
          })}
        >
          {editing ? (
            <Pencil className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          <span className={editing ? "sr-only" : "hidden sm:inline"}>
            {label}
          </span>
          <span className="sr-only sm:hidden">{label}</span>
        </DialogTrigger>
      )}
      <DialogContent className={wide ? "sm:max-w-5xl" : "sm:max-w-xl"}>
        <DialogHeader>
          <div className="flex items-center gap-2 pr-6">
            <DialogTitle>{title}</DialogTitle>
            {titleBadge}
          </div>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function SearchToolbar({
  placeholder,
  query,
  clearHref,
  children,
  hidden,
}: {
  placeholder: string;
  query?: string;
  clearHref: string;
  children?: ReactNode;
  hidden?: Record<string, string>;
}) {
  return (
    <div className="flex w-full min-w-0 items-center justify-end gap-2">
      <form className="hidden min-w-0 shrink-0 gap-2 xl:flex">
        <div className="relative w-[320px] min-w-0">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            name="q"
            placeholder={placeholder}
            defaultValue={query}
          />
        </div>
        {Object.entries(hidden ?? {}).map(([key, value]) => (
          <input key={key} name={key} value={value} type="hidden" />
        ))}
        {query ? (
          <Link
            href={clearHref}
            className={buttonVariants({
              variant: "outline",
              className: "h-9 gap-2",
            })}
          >
            <X className="size-4" />
            Limpar
          </Link>
        ) : (
          <Button type="submit" variant="outline" className="h-9">
            <Search className="size-4" />
            Filtrar
          </Button>
        )}
      </form>
      {children && <HeaderSeparator className="hidden xl:block" />}
      {children}
    </div>
  );
}
