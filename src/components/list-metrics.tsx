import { CircleCheck, CircleDollarSign, Gauge, KeyRound, List, ShieldAlert, CircleX, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const metricStyles = {
  neutral: { icon: List, className: "border-border bg-muted/25 text-muted-foreground" },
  success: { icon: CircleCheck, className: "border-emerald-200/70 bg-emerald-50/50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/25 dark:text-emerald-400" },
  inUse: { icon: KeyRound, className: "border-sky-200/70 bg-sky-50/50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/25 dark:text-sky-400" },
  info: { icon: CircleDollarSign, className: "border-sky-200/70 bg-sky-50/50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/25 dark:text-sky-400" },
  danger: { icon: CircleX, className: "border-red-200/70 bg-red-50/50 text-red-700 dark:border-red-800/60 dark:bg-red-950/25 dark:text-red-400" },
  warning: { icon: ShieldAlert, className: "border-amber-200/70 bg-amber-50/50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/25 dark:text-amber-400" },
};

const metricIcons = { money: CircleDollarSign, gauge: Gauge };

export function ListMetrics({
  items,
  loading = false,
  mobileThreeColumns = false,
}: {
  loading?: boolean;
  mobileThreeColumns?: boolean;
  items: Array<{ label: string; value: number | string; tone?: keyof typeof metricStyles; icon?: keyof typeof metricIcons }>;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", mobileThreeColumns && "grid w-full grid-cols-3 gap-1.5 md:flex md:w-auto max-md:[&_[data-slot=badge]]:!h-auto max-md:[&_[data-slot=badge]]:min-h-11 max-md:[&_[data-slot=badge]]:w-full max-md:[&_[data-slot=badge]]:flex-col max-md:[&_[data-slot=badge]]:justify-center max-md:[&_[data-slot=badge]]:gap-0 max-md:[&_[data-slot=badge]_svg]:hidden")} aria-label="Resumo da lista">
      {items.map(({ label, value, tone, icon }) => (
        <ListMetric key={label} label={label} value={value} tone={tone} icon={icon ? metricIcons[icon] : undefined} loading={loading} />
      ))}
    </div>
  );
}

export function ListMetric({ label, value, tone = "neutral", icon, loading = false }: {
  label: string;
  value: number | string;
  tone?: keyof typeof metricStyles;
  icon?: LucideIcon;
  loading?: boolean;
}) {
  const { icon: DefaultIcon, className } = metricStyles[tone];
  const Icon = icon ?? DefaultIcon;
  return (
    <Badge variant="outline" className={cn("h-8 gap-1.5 rounded-lg px-3 font-normal", className)}>
      <Icon aria-hidden="true" />
      <span className="font-semibold tabular-nums">{loading ? "—" : typeof value === "number" ? value.toLocaleString("pt-BR") : value}</span>
      <span>{label}</span>
    </Badge>
  );
}
