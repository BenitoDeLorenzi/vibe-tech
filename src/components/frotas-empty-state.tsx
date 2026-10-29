import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function FrotasEmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-lg border bg-muted/20 px-5 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg border bg-background">
        <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
