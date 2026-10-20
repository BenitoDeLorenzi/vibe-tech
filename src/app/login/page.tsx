import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-mark";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUserProfile } from "@/lib/auth-data";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const profile = await getCurrentUserProfile();

  if (profile) {
    redirect("/portal");
  }

  return (
    <main className="grid min-h-screen grid-cols-1 bg-muted/30 lg:grid-cols-[460px_1fr]">
      <section className="hidden min-h-screen flex-col justify-between bg-[#0b101d] p-8 text-white lg:flex">
        <BrandLogo className="w-full max-w-80" />

        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-normal">
            Acesse seus módulos.
          </h1>
          <p className="text-sm leading-6 text-white/70">
            Portal operacional da Vibe Tech para clientes e equipe interna.
          </p>
        </div>

        <div className="text-sm text-white/60">
          Vibe Tech
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-[420px] shadow-sm">
          <CardHeader className="space-y-2">
            <div className="mb-4 lg:hidden">
              <BrandLogo className="w-full max-w-72" />
            </div>
            <CardTitle className="text-2xl">Entrar no portal</CardTitle>
            <CardDescription>Informe seu CPF para continuar.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
