"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FormDialogCancel } from "@/components/form-dialog-cancel";
import { Textarea } from "@/components/ui/textarea";
import { cancelLicenca } from "./actions";

export function CancelLicencaForm({ id, futureCount }: { id: string; futureCount: number }) {
  const [state, action, pending] = useActionState(cancelLicenca, {});
  const form = useForm<{ motivo: string }>();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.success) return;
    toast.success(state.success);
    router.refresh();
    ref.current?.closest('[data-slot="dialog-content"]')?.querySelector<HTMLElement>('[data-slot="dialog-close"]')?.click();
  }, [state.success, router]);

  return <form ref={ref} noValidate className="space-y-4" onSubmit={form.handleSubmit(({ motivo }) => {
    const data = new FormData();
    data.set("id", id);
    data.set("motivo", motivo);
    startTransition(() => action(data));
  })}>
    <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
      O acesso ao módulo será encerrado. {futureCount} mensalidade(s) futura(s) sem recebimento serão canceladas. Cobranças do mês atual e recebimentos anteriores permanecem no histórico.
    </div>
    <p className="text-sm text-muted-foreground">Se houver boleto ativo ou pendente, dê baixa nele e aguarde a confirmação do Inter antes de concluir.</p>
    <label className="block space-y-2 text-sm font-medium">Justificativa
      <Textarea {...form.register("motivo", { required: "Informe a justificativa.", minLength: { value: 3, message: "Descreva o motivo." } })} disabled={pending} aria-invalid={!!form.formState.errors.motivo} placeholder="Descreva o motivo do cancelamento" />
    </label>
    {form.formState.errors.motivo && <p className="text-sm text-destructive">{form.formState.errors.motivo.message}</p>}
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <DialogFooter><FormDialogCancel disabled={pending} /><Button type="submit" variant="destructive" disabled={pending}>{pending ? "Cancelando..." : "Cancelar licença"}</Button></DialogFooter>
  </form>;
}
