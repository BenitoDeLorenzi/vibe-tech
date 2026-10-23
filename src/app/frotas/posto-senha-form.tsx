"use client";

import { FormDialogCancel } from "@/components/form-dialog-cancel";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { resetPostoCredenciadoSenha } from "./actions";

type PostoSenhaFormProps = {
  postoId: string;
  postoNome: string;
};

export function PostoSenhaForm({ postoId, postoNome }: PostoSenhaFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, actionPending] = useActionState(
    resetPostoCredenciadoSenha,
    {}
  );

  useEffect(() => {
    if (state.success) {
      toast.success(state.success, {
        id: `posto-password-${postoId}`,
      });
      router.refresh();
      closeParentDialog(formRef.current);
      formRef.current?.reset();
    }
  }, [postoId, router, state.success]);

  function submitForm(formData: FormData) {
    formData.set("id", postoId);

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form ref={formRef} action={submitForm} className="space-y-4">
      {state.error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <fieldset disabled={actionPending} className="disabled:opacity-70">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`posto-senha-${postoId}`}>
              Nova senha provisória para {postoNome}
            </FieldLabel>
            <Input
              id={`posto-senha-${postoId}`}
              name="senha"
              type="password"
              minLength={6}
              required
            />
            <FieldError />
          </Field>
        </FieldGroup>
      </fieldset>

      <DialogFooter>
        <FormDialogCancel disabled={actionPending} />
        <Button type="submit" className="gap-2" disabled={actionPending}>
          {actionPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {actionPending ? "Redefinindo..." : "Definir senha provisória"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function closeParentDialog(formElement: HTMLFormElement | null) {
  const closeButton = formElement
    ?.closest('[data-slot="dialog-content"]')
    ?.querySelector<HTMLElement>('[data-slot="dialog-close"]');

  closeButton?.click();
}
