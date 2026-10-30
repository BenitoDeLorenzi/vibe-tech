import type { ReactNode } from "react";

export function AdminMobileCard({ title, subtitle, badge, details, actions }: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  details?: { label: string; value: ReactNode }[];
  actions?: ReactNode;
}) {
  return <article className="overflow-hidden rounded-xl border bg-card shadow-xs">
    <div className="flex min-w-0 items-start justify-between gap-3 p-4">
      <div className="min-w-0"><div className="break-words font-medium leading-snug">{title}</div>{subtitle && <div className="mt-1 break-words text-xs text-muted-foreground">{subtitle}</div>}</div>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
    {details && details.length > 0 && <dl className="grid gap-2 border-t px-4 py-3 text-sm">{details.map((item, index) => <div key={`${item.label}-${index}`} className="flex min-w-0 items-start justify-between gap-3"><dt className="shrink-0 text-muted-foreground">{item.label}</dt><dd className="min-w-0 text-right font-medium">{item.value}</dd></div>)}</dl>}
    {actions && <div className="flex justify-end border-t bg-muted/20 px-3 py-2">{actions}</div>}
  </article>;
}
