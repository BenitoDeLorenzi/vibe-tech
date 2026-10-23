import { redirect } from "next/navigation";
import { LoginPageShell } from "@/components/login-page-shell";
import { getCurrentUserProfile } from "@/lib/auth-data";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const profile = await getCurrentUserProfile();
  if (profile) redirect("/portal");

  return (
    <LoginPageShell
      ariaLabel="Acesso ao portal"
      eyebrow="Portal Vibe Tech"
      heading="Sua gestão, sempre conectada."
      description="Acesse seus módulos e acompanhe a operação da sua empresa em um só lugar."
      title="Boas-vindas"
      instruction="Entre com seu CPF e senha para acessar o portal."
      helpText="Precisa de acesso? Entre em contato com o administrador da sua empresa."
    >
      <LoginForm />
    </LoginPageShell>
  );
}
