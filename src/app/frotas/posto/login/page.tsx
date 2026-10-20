import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-mark";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPostoSession } from "@/lib/posto-auth";
import { PostoLoginForm } from "../login-form";

export const dynamic = "force-dynamic";

export default async function PostoLoginPage() {
  const session = await getPostoSession();

  if (session) {
    redirect("/frotas/posto");
  }

  return (
    <main className="grid min-h-screen grid-cols-1 bg-muted/30 lg:grid-cols-[420px_1fr]">
      <section className="hidden min-h-screen flex-col justify-between bg-[#0b101d] p-8 text-white lg:flex">
        <BrandLogo className="w-full max-w-80" />

        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-normal">
            Conclua ordens de abastecimento.
          </h1>
          <p className="text-sm leading-6 text-white/70">
            Acesso exclusivo para postos credenciados.
          </p>
        </div>

        <div className="text-sm text-white/60">
          Vibe Tech · Vibe Frotas
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-[420px] shadow-sm">
          <CardHeader className="space-y-2">
            <div className="mb-4 lg:hidden">
              <BrandLogo className="w-full max-w-72" />
            </div>
            <CardTitle className="text-2xl">Portal do posto</CardTitle>
            <CardDescription>Informe o CNPJ para continuar.</CardDescription>
          </CardHeader>
          <CardContent>
            <PostoLoginForm />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
