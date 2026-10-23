import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-mark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LoginPageShellProps = {
  ariaLabel: string;
  eyebrow: string;
  heading: string;
  description: string;
  title: string;
  instruction: string;
  helpText: string;
  children: ReactNode;
};

export function LoginPageShell({ ariaLabel, eyebrow, heading, description, title, instruction, helpText, children }: LoginPageShellProps) {
  return (
    <main className="grid min-h-svh grid-cols-1 bg-background lg:grid-cols-[420px_1fr] xl:grid-cols-[440px_1fr]">
      <section className="relative hidden overflow-hidden bg-[#0b101d] px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-40 size-[620px] rounded-full bg-blue-600/10 blur-3xl" />
        <div className="relative"><BrandLogo className="w-full max-w-60" /></div>
        <div className="relative max-w-md space-y-6 py-16">
          <div className="h-1 w-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" aria-hidden="true" />
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{eyebrow}</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">{heading}</h1>
          <p className="max-w-sm text-base leading-7 text-slate-400">{description}</p>
        </div>
        <footer className="relative border-t border-white/10 pt-6 text-xs leading-6 text-slate-400"><CompanyCopyright /></footer>
      </section>
      <section aria-label={ariaLabel} className="flex min-h-svh flex-col items-center justify-center px-6 py-10 sm:px-12">
        <Card className="my-auto w-full max-w-[420px] overflow-visible border-0 bg-transparent shadow-none ring-0">
          <CardHeader className="space-y-2 px-0">
            <div className="mb-4 lg:hidden"><BrandLogo className="w-full max-w-60" /></div>
            <CardTitle className="text-3xl font-semibold tracking-tight">{title}</CardTitle>
            <CardDescription className="text-sm leading-6">{instruction}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {children}
            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">{helpText}</p>
          </CardContent>
        </Card>
        <footer className="mt-10 w-full max-w-[420px] border-t pt-5 text-center text-xs leading-6 text-muted-foreground lg:hidden"><CompanyCopyright /></footer>
      </section>
    </main>
  );
}

function CompanyCopyright() {
  return <>
    <p>© {new Date().getFullYear()} VIBE TECH LTDA</p>
    <p>CNPJ: 69.683.349/0001-71</p>
    <p className="mt-1 text-[11px]">Todos os direitos reservados.</p>
  </>;
}
