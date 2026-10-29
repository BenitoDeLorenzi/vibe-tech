"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FormDialogCancel } from "@/components/form-dialog-cancel";
import { Textarea } from "@/components/ui/textarea";
import { cancelInterBillingAction } from "./inter-actions";

export function InterCancelForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(cancelInterBillingAction, {});
  const form = useForm<{ motivo: string }>();
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!state.success) return;
    toast.success(state.success);
    router.refresh();
    ref.current?.closest('[data-slot="dialog-content"]')?.querySelector<HTMLElement>('[data-slot="dialog-close"]')?.click();
  }, [state.success, router]);
  return <form ref={ref} noValidate className="space-y-4" onSubmit={form.handleSubmit(values => {
    const data = new FormData();
    data.set("inter_id", id);
    data.set("motivo", values.motivo.trim());
    startTransition(() => action(data));
  })}>
    <p className="text-sm text-muted-foreground">O pedido será enviado ao Inter. A mensalidade voltará a permitir ajuste ou nova emissão somente após o banco confirmar a baixa do boleto.</p>
    <label className="block space-y-2 text-sm font-medium">Justificativa
      <Textarea {...form.register("motivo", { required: "Informe a justificativa.", minLength: { value: 3, message: "Descreva o motivo da baixa." } })} aria-invalid={!!form.formState.errors.motivo} disabled={pending} placeholder="Ex.: correção do valor da mensalidade" />
    </label>
    {form.formState.errors.motivo && <p role="alert" className="text-sm text-destructive">{form.formState.errors.motivo.message}</p>}
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <DialogFooter><FormDialogCancel disabled={pending} /><Button type="submit" variant="destructive" disabled={pending}>{pending ? "Enviando..." : "Confirmar baixa do boleto"}</Button></DialogFooter>
  </form>;
}
