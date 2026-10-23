import { LoginPageShell } from "@/components/login-page-shell";
import { PasswordRecoveryForm } from "./password-recovery-form";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <LoginPageShell
      ariaLabel="Recuperação de senha"
      eyebrow="Segurança da conta · Vibe Tech"
      heading="Volte ao seu acesso com segurança."
      description="Confirme sua identidade pelo e-mail verificado e crie uma nova senha para continuar."
      title="Esqueci minha senha"
      instruction="Informe o CPF da sua conta para receber um código de recuperação."
      helpText="Se você ainda não verificou seu e-mail, procure o Master responsável pela sua conta."
    >
      <PasswordRecoveryForm />
    </LoginPageShell>
  );
}
