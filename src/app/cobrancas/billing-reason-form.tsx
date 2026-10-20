"use client";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { changeBillingStatus } from "@/app/licencas/actions";
import { FormDialogCancel } from "@/components/form-dialog-cancel";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function BillingReasonForm({
  id,
  receipt,
}: {
  id: string;
  receipt?: string;
}) {
  const [state, action, pending] = useActionState(changeBillingStatus, {});
  const form = useForm<{ motivo: string }>();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      router.refresh();
      ref.current
        ?.closest('[data-slot="dialog-content"]')
        ?.querySelector<HTMLElement>('[data-slot="dialog-close"]')
        ?.click();
    }
  }, [state.success, router]);
  return (
    <form
      ref={ref}
      noValidate
      onSubmit={form.handleSubmit((v) => {
        const d = new FormData();
        d.set("id", id);
        d.set("acao", receipt ? "reverse" : "cancel");
        d.set("recebimento_id", receipt ?? "");
        d.set("motivo", v.motivo);
        startTransition(() => action(d));
      })}
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">
        {receipt
          ? "O recebimento continuará no histórico como estornado e o saldo será reaberto."
          : "A cobrança será cancelada, mantendo seu histórico. Esta ação não altera a licença."}
      </p>
      <label className="block space-y-2 text-sm">
        Justificativa
        <Input
          {...form.register("motivo", {
            required: "Informe o motivo.",
            minLength: { value: 3, message: "Descreva o motivo." },
          })}
          aria-invalid={!!form.formState.errors.motivo}
          disabled={pending}
        />
      </label>
      {form.formState.errors.motivo && (
        <p className="text-sm text-destructive">
          {form.formState.errors.motivo.message}
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <FormDialogCancel disabled={pending} />
        <Button variant="destructive" disabled={pending}>
          {pending
            ? "Salvando..."
            : receipt
              ? "Estornar recebimento"
              : "Cancelar cobrança"}
        </Button>
      </DialogFooter>
    </form>
  );
}
