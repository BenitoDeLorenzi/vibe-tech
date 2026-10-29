"use client";

import { SecretariaSelect } from "./secretarias/secretaria-select";
import { FormDialogCancel } from "@/components/form-dialog-cancel";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Search, TriangleAlert } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { PrefeituraCombobox } from "@/components/prefeitura-combobox";
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FrotaPrefeituraOption } from "@/lib/frotas-data";
import { VeiculoForm } from "./veiculo-form";

type LookupValues = {
  secretariaId: string;
  placa: string;
  renavam: string;
  prefeituraId: string | null;
};
const OLD_SESSION_KEY = "vibe-frotas-pending-vehicle-lookup";

export function VeiculoCadastroDialog({
  prefeituras,
  selectedPrefeituraId,
  showPrefeituraField = true,
  triggerLabel = "Novo veículo",
}: {
  prefeituras: FrotaPrefeituraOption[];
  selectedPrefeituraId?: string;
  showPrefeituraField?: boolean;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const legacy = useRef<{
    placa: string;
    renavam: string;
    token?: string;
  } | null>(null);
  const form = useForm<LookupValues>({
    defaultValues: {
      secretariaId: "",
      placa: "",
      renavam: "",
      prefeituraId: selectedPrefeituraId ?? null,
    },
  });

  const empresaId = useWatch({ control: form.control, name: "prefeituraId" });
  const isPrefeitura = prefeituras.some(
    (e) => e.id === empresaId && e.is_prefeitura,
  );

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(OLD_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed.placa === "string" &&
          typeof parsed.renavam === "string"
        ) {
          legacy.current = parsed;
          form.reset({
            secretariaId: "",
            placa: parsed.placa,
            renavam: parsed.renavam,
            prefeituraId: selectedPrefeituraId ?? null,
          });
        }
      }
    } catch {
      sessionStorage.removeItem(OLD_SESSION_KEY);
    }
  }, [form, selectedPrefeituraId]);

  async function submit(values: LookupValues) {
    setPending(true);
    setError(null);
    try {
      const legacyToken =
        legacy.current?.placa === values.placa &&
        legacy.current.renavam === values.renavam
          ? legacy.current.token
          : undefined;
      const response = await fetch("/api/frotas/veiculos/consulta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          secretariaId: isPrefeitura ? values.secretariaId : "",
          legacyToken,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const result = (await response.json()) as {
        vehicleId?: string;
        error?: string;
      };
      if (!response.ok || !result.vehicleId) {
        setError(
          result.error ??
            "Não foi possível iniciar o cadastro. Tente novamente.",
        );
        return;
      }
      sessionStorage.removeItem(OLD_SESSION_KEY);
      legacy.current = null;
      setOpen(false);
      form.reset({
        secretariaId: "",
        placa: "",
        renavam: "",
        prefeituraId: values.prefeituraId,
      });
      // Show the pending vehicle even if the previous list was filtered to active vehicles.
      router.replace(
        `/frotas/veiculos?prefeitura=${encodeURIComponent(values.prefeituraId ?? selectedPrefeituraId ?? "")}`,
      );
      router.refresh();
    } catch {
      setError(
        "Não foi possível confirmar o envio. Verifique a lista antes de tentar novamente; o cadastro pode já ter sido criado.",
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value && !pending) {
          setManual(false);
          setError(null);
        }
      }}
    >
      <DialogTrigger
        className={buttonVariants({ className: "h-9 shrink-0 gap-2" })}
      >
        <Plus className="size-4" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent
        className={
          manual ? "max-h-[92vh] overflow-y-auto sm:max-w-5xl" : "sm:max-w-lg"
        }
      >
        <DialogHeader>
          <DialogTitle>
            {manual ? "Cadastrar veículo" : "Consultar veículo"}
          </DialogTitle>
          <DialogDescription>
            {manual
              ? "Preencha os dados cadastrais e operacionais do veículo."
              : "Informe placa e Renavam. O veículo aparecerá na lista enquanto aguardamos o retorno do Detran/SC."}
          </DialogDescription>
        </DialogHeader>
        {manual ? (
          <VeiculoForm
            prefeituras={prefeituras}
            selectedPrefeituraId={
              form.getValues("prefeituraId") ?? selectedPrefeituraId
            }
            showPrefeituraField={showPrefeituraField}
            initialValues={{
              secretaria_id: form.getValues("secretariaId"),
              placa: form.getValues("placa"),
              renavam: form.getValues("renavam"),
            }}
            onBack={() => setManual(false)}
          />
        ) : (
          <form
            onSubmit={(event) => {
              void form.handleSubmit(submit)(event);
            }}
            className="space-y-5"
            noValidate
          >
            {error ? (
              <div
                className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {error}
              </div>
            ) : null}
            <FieldGroup className="gap-4">
              {showPrefeituraField ? (
                <Controller
                  control={form.control}
                  name="prefeituraId"
                  rules={{ required: "Selecione a empresa." }}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="consulta-empresa">
                        Empresa
                      </FieldLabel>
                      <PrefeituraCombobox
                        id="consulta-empresa"
                        prefeituras={prefeituras}
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          form.setValue("secretariaId", "");
                        }}
                        disabled={pending}
                        invalid={fieldState.invalid}
                        placeholder="Pesquisar empresa"
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              ) : null}
              {isPrefeitura && empresaId && (
                <Controller
                  control={form.control}
                  name="secretariaId"
                  rules={{ required: "Selecione a secretaria do veículo." }}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <SecretariaSelect
                        key={empresaId}
                        empresaId={empresaId}
                        value={field.value}
                        onChange={field.onChange}
                        disabled={pending}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  control={form.control}
                  name="placa"
                  rules={{
                    required: "Informe a placa.",
                    pattern: {
                      value: /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/,
                      message: "Informe uma placa brasileira válida.",
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="consulta-placa">Placa</FieldLabel>
                      <Input
                        {...field}
                        id="consulta-placa"
                        disabled={pending}
                        maxLength={7}
                        autoComplete="off"
                        autoCapitalize="characters"
                        placeholder="ABC1D23"
                        aria-invalid={fieldState.invalid}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, "")
                              .slice(0, 7),
                          )
                        }
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="renavam"
                  rules={{
                    required: "Informe o Renavam.",
                    pattern: {
                      value: /^\d{11}$/,
                      message: "Informe 11 dígitos.",
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="consulta-renavam">
                        Renavam
                      </FieldLabel>
                      <Input
                        {...field}
                        id="consulta-renavam"
                        disabled={pending}
                        maxLength={11}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="11 dígitos"
                        aria-invalid={fieldState.invalid}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value.replace(/\D/g, "").slice(0, 11),
                          )
                        }
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </div>
            </FieldGroup>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="sm:mr-auto"
                disabled={pending}
                onClick={() => setManual(true)}
              >
                Cadastrar manualmente
              </Button>
              <FormDialogCancel disabled={pending} />
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                {pending ? "Enviando…" : "Iniciar consulta"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
