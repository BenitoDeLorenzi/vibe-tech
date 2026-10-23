"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BadgeCheck, ChevronRight, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { mask } from "remask";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import type { CurrentUserProfile } from "@/lib/auth-data";
import type { PortalModulo } from "@/lib/portal-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DadosPerfilForm,
  FotoPerfilForm,
  SenhaPerfilForm,
} from "./perfil-forms";
import { confirmarCodigoVerificacaoPerfil, consultarCodigoVerificacaoPerfil, enviarCodigoVerificacaoPerfil, getPerfilAcessos } from "./actions";

export function PerfilDialog({
  profile,
  open,
  onOpenChange,
}: {
  profile: CurrentUserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [modules, setModules] = useState<PortalModulo[] | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("dados");
  const [verificationStep, setVerificationStep] = useState(false);
  const [locallyVerifiedEmail, setLocallyVerifiedEmail] = useState<string | null>(null);
  const emailVerified = Boolean(profile.email_contato_verificado_em) || locallyVerifiedEmail === profile.email_contato;
  const [code, setCode] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const router = useRouter();
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setVerificationStep(false);
      setVerificationError("");
      setVerificationMessage("");
      setCode("");
    }
    onOpenChange(nextOpen);
  }
  async function sendVerificationCode() {
    setActiveTab("dados");
    setVerificationPending(true);
    setVerificationError("");
    try {
      const result = await enviarCodigoVerificacaoPerfil();
      if (result.error) setVerificationError(result.error);
      else {
        setActiveTab("dados");
        setVerificationStep(true);
        setVerificationMessage(result.success ?? "Código enviado.");
      }
    } catch {
      setVerificationError("Não foi possível enviar o código. Tente novamente.");
    } finally {
      setVerificationPending(false);
    }
  }
  async function confirmVerificationCode() {
    setVerificationPending(true);
    setVerificationError("");
    try {
      const result = await confirmarCodigoVerificacaoPerfil(code);
      if (result.error) setVerificationError(result.error);
      else {
        setLocallyVerifiedEmail(profile.email_contato ?? null);
        setVerificationStep(false);
        setCode("");
        setVerificationMessage(result.success ?? "E-mail verificado.");
        router.refresh();
      }
    } catch {
      setVerificationError("Não foi possível confirmar o código. Tente novamente.");
    } finally {
      setVerificationPending(false);
    }
  }
  useEffect(() => {
    if (!open) return;
    let active = true;
    getPerfilAcessos()
      .then((data) => {
        if (active) {
          setModules(data);
          setError("");
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível carregar seus módulos. Feche e abra o perfil para tentar novamente.",
          );
      });
    return () => {
      active = false;
    };
  }, [open]);
  useEffect(() => {
    if (!open || !profile.email_contato || emailVerified) return;
    let active = true;
    consultarCodigoVerificacaoPerfil()
      .then(({ pending }) => {
        if (active && pending) {
          setActiveTab("dados");
          setVerificationStep(true);
          setVerificationMessage("Você já tem um código válido. Digite-o abaixo para confirmar seu e-mail.");
        }
      })
      .catch(() => {
        if (active) setVerificationError("Não foi possível consultar o código. Tente novamente.");
      });
    return () => { active = false; };
  }, [open, profile.email_contato, emailVerified]);
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5 text-left">
          <DialogTitle>Meu perfil</DialogTitle>
          <DialogDescription>
            Gerencie seus dados pessoais, segurança e acessos.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-0 gap-0">
          <TabsList className="mx-5 mt-4 h-10 w-[calc(100%-2.5rem)] shrink-0 sm:mx-6 sm:w-[calc(100%-3rem)]">
            <TabsTrigger value="dados" className="flex-1">
              <UserRound className="size-4" /> Dados pessoais
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="flex-1">
              <KeyRound className="size-4" /> Segurança
            </TabsTrigger>
            <TabsTrigger value="acesso" className="flex-1">
              <ShieldCheck className="size-4" /> Meu acesso
            </TabsTrigger>
          </TabsList>
          <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
            <TabsContent value="dados" className="space-y-6">
              <div className="grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center sm:gap-6 sm:p-5">
                <FotoPerfilForm nome={profile.nome} avatarUrl={profile.avatar_url ?? null} />
                <div className="min-w-0">
                  <h3 className="mb-3 text-sm font-semibold">Informações pessoais</h3>
                  <DadosPerfilForm nome={profile.nome} telefone={profile.telefone ?? ""} />
                </div>
              </div>
              <div className="space-y-3 border-t pt-5">
                <h3 className="text-sm font-semibold">Dados da conta</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">CPF / login</p>
                    <p className="mt-1 text-sm font-medium">{profile.cpf && profile.cpf.replace(/\D/g, "").length === 11 ? mask(profile.cpf.replace(/\D/g, ""), "999.999.999-99") : profile.cpf ?? profile.username ?? "Não informado"}</p>
                  </div>
                  <div className="min-w-0 rounded-lg border p-3">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="size-3.5" /> E-mail de recuperação</p>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-sm font-medium" title={profile.email_contato ?? undefined}>{profile.email_contato ?? "Não cadastrado"}</p>
                      {profile.email_contato ? (
                        <Tooltip>
                          <TooltipTrigger render={<button type="button" className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={emailVerified ? "E-mail verificado" : "E-mail não verificado"} />}>
                            <BadgeCheck className={`size-4 ${emailVerified ? "text-emerald-600" : "text-muted-foreground"}`} />
                          </TooltipTrigger>
                          <TooltipContent>{emailVerified ? "E-mail verificado" : "E-mail ainda não verificado"}</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Seu acesso continua pelo CPF. Apenas o Master pode alterar o e-mail da conta.</p>
              </div>
              {profile.email_contato && !emailVerified && verificationStep ? (
                <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                  <div>
                    <h3 className="text-sm font-semibold">Confirme seu e-mail</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Digite o código de seis dígitos enviado para {profile.email_contato}. Ele vence em 10 minutos.</p>
                  </div>
                  <InputOTP maxLength={6} pattern="^[0-9]+$" inputMode="numeric" autoComplete="one-time-code" aria-label="Código de verificação" disabled={verificationPending} value={code} onChange={setCode}>
                    <InputOTPGroup>{Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} className="size-10 text-base" />)}</InputOTPGroup>
                  </InputOTP>
                  <Button type="button" variant="link" size="sm" className="h-auto px-0" disabled={verificationPending} onClick={sendVerificationCode}>Reenviar código</Button>
                </div>
              ) : null}
              {verificationMessage ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{verificationMessage}</p> : null}
              {verificationError ? <p role="alert" className="text-sm text-destructive">{verificationError}</p> : null}
            </TabsContent>
            <TabsContent value="seguranca" className="space-y-4">
              <div><h3 className="text-sm font-semibold">Alterar senha</h3><p className="mt-1 text-xs text-muted-foreground">Use uma senha exclusiva para proteger seu acesso.</p></div>
              <SenhaPerfilForm />
            </TabsContent>
            <TabsContent value="acesso" className="space-y-5">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <dt className="text-muted-foreground">Empresa</dt>
                  <dd className="mt-1 font-medium">
                    {profile.prefeitura_nome ??
                      (profile.role === "bdl_admin"
                        ? "Vibe Tech"
                        : "Sem empresa vinculada")}
                  </dd>
                </div>
                <div className="rounded-lg border p-4">
                  <dt className="text-muted-foreground">Tipo de usuário</dt>
                  <dd className="mt-1 font-medium">
                    {profile.role === "bdl_admin"
                      ? "Master"
                      : profile.role === "municipal_admin"
                        ? "Administrador"
                        : "Usuário"}
                  </dd>
                </div>
              </dl>
              <div className="border-t pt-4">
                <h3 className="mb-3 text-sm font-semibold">
                  Módulos disponíveis
                </h3>
                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : modules === null ? (
                  <p className="text-sm text-muted-foreground">
                    Carregando acessos…
                  </p>
                ) : modules.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {modules.map((m) => (
                      <Link
                        key={m.id}
                        href={m.href}
                        onClick={() => handleOpenChange(false)}
                        className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted"
                      >
                        {m.label}<ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum módulo liberado.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Empresa e permissões são gerenciadas pelo administrador.
              </p>
            </TabsContent>
          </div>
        </Tabs>
        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none bg-background px-5 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          {profile.email_contato && !emailVerified ? (
            <Button type="button" variant="secondary" disabled={verificationPending || (verificationStep && code.length !== 6)} onClick={verificationStep ? confirmVerificationCode : sendVerificationCode}>
              {verificationPending ? "Aguarde…" : verificationStep ? "Confirmar código" : "Verificar e-mail"}
            </Button>
          ) : null}
          {activeTab === "dados" ? <Button type="submit" form="dados-perfil-form">Salvar dados</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
