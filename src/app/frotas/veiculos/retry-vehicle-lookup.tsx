"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function RetryVehicleLookup({ vehicleId, companyId, placa, compact = false }: {
  vehicleId: string;
  companyId: string;
  placa: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/frotas/veiculos/consulta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", vehicleId, prefeituraId: companyId }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível iniciar a nova tentativa.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Não foi possível confirmar o envio. Verifique o status do veículo antes de tentar novamente.");
    } finally {
      setPending(false);
    }
  }

  return <Dialog open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); if (!value) setError(null); } }}>
    <Tooltip>
      <TooltipTrigger render={<DialogTrigger render={<Button variant="outline" size={compact ? "icon-sm" : "default"} aria-label={`Tentar novamente a consulta do veículo ${placa}`} />} />}>
        <RotateCcw className="size-4" />
        {!compact && "Tentar novamente"}
      </TooltipTrigger>
      <TooltipContent>Tentar novamente a consulta</TooltipContent>
    </Tooltip>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Nova consulta do veículo</DialogTitle>
        <DialogDescription>
          Vamos consultar novamente a placa {placa}. A tentativa anterior ficará no histórico. Esta ação pode consumir um novo crédito de consulta.
        </DialogDescription>
      </DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancelar</Button>
        <Button type="button" disabled={pending} onClick={() => void retry()}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          Iniciar nova tentativa
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
