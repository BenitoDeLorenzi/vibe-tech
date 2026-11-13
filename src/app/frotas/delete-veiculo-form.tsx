"use client";

import { useFormStatus } from "react-dom";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { deleteVeiculo } from "./actions";

type DeleteVeiculoFormProps = {
  id: string;
};

export function DeleteVeiculoForm({ id }: DeleteVeiculoFormProps) {
  return (
    <form action={deleteVeiculo} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div>
          <div className="font-medium">Exclusão definitiva</div>
          <p className="mt-1 text-destructive/90">
            O cadastro e seus dados operacionais serão apagados, incluindo
            débitos, pagamentos, manutenções, anexos e foto. O histórico das
            consultas automáticas será preservado para diagnóstico.
          </p>
        </div>
      </div>
      <DialogFooter>
        <SubmitButton />
      </DialogFooter>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="destructive" className="gap-2" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
      {pending ? "Excluindo..." : "Excluir veículo"}
    </Button>
  );
}
