import { redirect } from "next/navigation";
import { LoginPageShell } from "@/components/login-page-shell";
import { getPostoSession } from "@/lib/posto-auth";
import { PostoLoginForm } from "../login-form";

export const dynamic = "force-dynamic";

export default async function PostoLoginPage() {
  const session = await getPostoSession();
  if (session) redirect("/frotas/posto");

  return (
    <LoginPageShell
      ariaLabel="Acesso ao portal do posto"
      eyebrow="Vibe Frotas · Portal do posto"
      heading="Abastecimentos em dia, operação em movimento."
      description="Consulte e conclua ordens de abastecimento do seu posto em um só lugar."
      title="Portal do posto"
      instruction="Entre com o CNPJ e a senha do posto para continuar."
      helpText="Precisa de acesso? Entre em contato com o responsável pelo seu credenciamento."
    >
      <PostoLoginForm />
    </LoginPageShell>
  );
}
