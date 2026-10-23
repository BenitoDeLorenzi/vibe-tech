import Link from "next/link";
import { ArrowLeft, LayoutDashboard, ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function AccessDenied({ homeHref = "/portal", homeLabel = "Voltar ao portal" }: {
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <main className="flex min-h-[calc(100svh-4rem)] items-center justify-center bg-background px-4 py-12 sm:px-8">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-blue-600 via-cyan-400 to-violet-600" />
        <div className="px-6 py-10 text-center sm:px-12 sm:py-12">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-blue-500/15 bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <ShieldAlert className="size-8" aria-hidden="true" />
          </div>
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Acesso restrito · 403</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Você não tem acesso a esta página</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Sua conta está ativa, mas não possui a permissão necessária para visualizar este conteúdo. Se precisar desse acesso, solicite ao administrador da sua empresa.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href={homeHref} className={buttonVariants({ className: "gap-2" })}>
              <LayoutDashboard className="size-4" aria-hidden="true" />
              {homeLabel}
            </Link>
            {homeHref !== "/portal" && <Link href="/portal" className={buttonVariants({ variant: "outline", className: "gap-2" })}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Portal de módulos
            </Link>}
          </div>
        </div>
      </div>
    </main>
  );
}
