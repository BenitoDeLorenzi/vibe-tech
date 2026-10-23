import { redirect } from "next/navigation";
import { LoginPageShell } from "@/components/login-page-shell";
import { getCurrentUserProfile } from "@/lib/auth-data";
import { PrimeiroAcessoForm } from "./primeiro-acesso-form";

export const dynamic = "force-dynamic";

export default async function PrimeiroAcessoPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  if (profile.primeiro_acesso_concluido_em) redirect("/portal");

  return (
    <LoginPageShell
      ariaLabel="Configuração do primeiro acesso"
      eyebrow="Primeiro acesso · Vibe Tech"
      heading="Seu acesso começa aqui."
      description="Confirme seu e-mail e personalize sua conta antes de usar os módulos."
      title="Complete seu acesso"
      instruction={profile.senha_inicial_alterada_em ? "Confirme seu e-mail para concluir o primeiro acesso." : "Seu e-mail e a nova senha são obrigatórios. Foto e telefone são opcionais."}
      helpText={profile.senha_inicial_alterada_em ? "O código vence em 10 minutos. Caso não tenha recebido, verifique o spam ou solicite outro." : "Após salvar, digite nesta tela o código enviado ao seu e-mail para liberar o portal."}
    >
      <PrimeiroAcessoForm
        nome={profile.nome}
        avatarUrl={profile.avatar_url ?? null}
        email={profile.email_contato ?? ""}
        telefone={profile.telefone ?? ""}
        senhaAlterada={Boolean(profile.senha_inicial_alterada_em)}
      />
    </LoginPageShell>
  );
}
