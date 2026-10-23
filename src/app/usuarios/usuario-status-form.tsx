"use client";

import { useFormStatus } from "react-dom";
import { Loader2, UserRoundCheck, UserRoundX } from "lucide-react";
import { FormDialogCancel } from "@/components/form-dialog-cancel";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { setUsuarioAtivo } from "./actions";

export function UsuarioStatusForm({ id, ativo }: { id: string; ativo: boolean }) {
  return (
    <form action={setUsuarioAtivo}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativo" value={String(!ativo)} />
      <StatusButton ativo={ativo} />
    </form>
  );
}

function StatusButton({ ativo }: { ativo: boolean }) {
  const { pending } = useFormStatus();
  const Icon = ativo ? UserRoundX : UserRoundCheck;
  return (
    <DialogFooter>
      <FormDialogCancel disabled={pending} />
      <Button type="submit" disabled={pending} className="gap-2">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
        {pending ? "Salvando..." : ativo ? "Inativar usuário" : "Ativar usuário"}
      </Button>
    </DialogFooter>
  );
}
