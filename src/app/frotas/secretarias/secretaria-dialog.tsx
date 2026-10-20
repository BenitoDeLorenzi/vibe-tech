"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FormDialogCancel } from "@/components/form-dialog-cancel";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Secretaria } from "@/lib/secretarias-data";
import { deleteSecretaria, saveSecretaria } from "./actions";

export function SecretariaDialog({
  empresaId,
  secretaria,
  deleting = false,
}: {
  empresaId: string;
  secretaria?: Secretaria;
  deleting?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const form = useForm({ defaultValues: { nome: secretaria?.nome ?? "" } });
  const pending = form.formState.isSubmitting;
  const title = deleting
    ? "Excluir secretaria"
    : secretaria
      ? "Editar secretaria"
      : "Nova secretaria";
  const trigger = (
    <DialogTrigger
      aria-label={title}
      className={buttonVariants({
        variant: deleting ? "destructive" : secretaria ? "ghost" : "default",
        size: secretaria ? "icon-sm" : "default",
        className: secretaria ? undefined : "h-9 shrink-0 gap-2",
      })}
    >
      {deleting ? (
        <Trash2 className="size-4" />
      ) : secretaria ? (
        <Pencil className="size-4" />
      ) : (
        <>
          <Plus className="size-4" />
          Nova secretaria
        </>
      )}
    </DialogTrigger>
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (pending) return;
        setOpen(value);
        if (value) {
          form.reset({ nome: secretaria?.nome ?? "" });
          setError("");
        }
      }}
    >
      {secretaria ? (
        <Tooltip>
          <TooltipTrigger render={trigger} />
          <TooltipContent>{title}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {deleting
              ? `Excluir a secretaria ${secretaria?.nome}? Secretarias com veículos vinculados não podem ser excluídas.`
              : "Informe o nome da secretaria desta prefeitura."}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit(async ({ nome }) => {
            setError("");
            const data = new FormData();
            data.set("prefeitura_id", empresaId);
            data.set("nome", nome);
            if (secretaria) data.set("id", secretaria.id);
            try {
              const result = await (
                deleting ? deleteSecretaria : saveSecretaria
              )({}, data);
              if (result.error) {
                setError(result.error);
                return;
              }
              toast.success(result.success);
              setOpen(false);
              router.refresh();
            } catch {
              setError(
                "Não foi possível concluir a operação. Tente novamente.",
              );
            }
          })}
        >
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {!deleting && (
            <Field data-invalid={Boolean(form.formState.errors.nome)}>
              <FieldLabel htmlFor="secretaria-nome">
                Nome da secretaria
              </FieldLabel>
              <Input
                id="secretaria-nome"
                disabled={pending}
                maxLength={120}
                aria-invalid={Boolean(form.formState.errors.nome)}
                {...form.register("nome", {
                  validate: (value) =>
                    value.trim().length >= 2 ||
                    "Informe pelo menos 2 caracteres.",
                  maxLength: { value: 120, message: "Use até 120 caracteres." },
                })}
              />
              <FieldError errors={[form.formState.errors.nome]} />
            </Field>
          )}
          <DialogFooter>
            <FormDialogCancel disabled={pending} />
            <Button
              type="submit"
              disabled={pending}
              variant={deleting ? "destructive" : "default"}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending
                ? "Salvando…"
                : deleting
                  ? "Excluir secretaria"
                  : "Salvar secretaria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
