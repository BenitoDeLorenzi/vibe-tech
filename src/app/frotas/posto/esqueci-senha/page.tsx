import { LoginPageShell } from "@/components/login-page-shell";
import { PostoPasswordRecoveryForm } from "./posto-password-recovery-form";

export const dynamic = "force-dynamic";

export default function PostoForgotPasswordPage() {
  return <LoginPageShell
    ariaLabel="Recuperação de senha do posto"
    eyebrow="Vibe Frotas · Portal do posto"
    heading="Recupere o acesso ao seu posto."
    description="Confirme o e-mail cadastrado e volte a acompanhar as ordens de abastecimento."
    title="Esqueci minha senha"
    instruction="Informe o CNPJ do posto para receber um código de recuperação."
    helpText="A recuperação exige um e-mail verificado no primeiro acesso."
  ><PostoPasswordRecoveryForm /></LoginPageShell>;
}
