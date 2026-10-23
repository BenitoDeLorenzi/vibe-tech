import { redirect } from "next/navigation";
import { LoginPageShell } from "@/components/login-page-shell";
import { getPostoSession } from "@/lib/posto-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { PostoFirstAccessForm } from "./posto-first-access-form";

export const dynamic = "force-dynamic";

export default async function PostoFirstAccessPage() {
  const session = await getPostoSession();
  if (!session) redirect("/frotas/posto/login");
  const db = createSupabaseServerClient();
  const [{ data: posto }, { data: code }] = await Promise.all([
    db.from("frota_postos_credenciados")
      .select("email_contato,endereco,telefone,primeiro_acesso_concluido_em")
      .eq("id", session.id).maybeSingle(),
    db.from("frota_posto_codigos")
      .select("finalidade,email,expira_em,tentativas")
      .eq("posto_id", session.id).maybeSingle(),
  ]);
  if (!posto) redirect("/frotas/posto/login");
  if (posto.primeiro_acesso_concluido_em) redirect("/frotas/posto");

  return <LoginPageShell
    ariaLabel="Primeiro acesso do posto"
    eyebrow="Vibe Frotas · Portal do posto"
    heading="Seu posto pronto para operar."
    description="Complete o cadastro e confirme o e-mail para acessar as ordens de abastecimento."
    title="Complete seu acesso"
    instruction="Informe os dados do posto e crie sua senha definitiva."
    helpText="O e-mail confirmado será usado para recuperar sua senha quando necessário."
  >
    <PostoFirstAccessForm
      initialEmail={posto.email_contato ?? ""}
      initialEndereco={posto.endereco ?? ""}
      initialTelefone={posto.telefone ?? ""}
      initialCodePending={code?.finalidade === "primeiro_acesso" && code.email === posto.email_contato && code.tentativas < 5}
    />
  </LoginPageShell>;
}
