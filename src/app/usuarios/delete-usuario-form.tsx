"use client";

import { FormDialogCancel } from "@/components/form-dialog-cancel";

import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { deleteUsuario } from "./actions";

type DeleteUsuarioFormProps = {
  id: string;
};

export function DeleteUsuarioForm({ id }: DeleteUsuarioFormProps) {
  return (
    <form action={deleteUsuario}>
      <input type="hidden" name="id" value={id} />
      <DeleteButton />
    </form>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();

  return (
    <DialogFooter>
      <FormDialogCancel disabled={pending} />
      <Button
        type="submit"
        variant="destructive"
        className="gap-2"
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
        {pending ? "Excluindo..." : "Excluir usuário"}
      </Button>
    </DialogFooter>
  );
}
