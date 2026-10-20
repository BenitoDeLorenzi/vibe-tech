"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { vehicleSecretariaOptions } from "./actions";

const NONE_SECRETARIA = "__sem_secretaria__";

export function SecretariaSelect({
  empresaId,
  value,
  onChange,
  disabled,
}: {
  empresaId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof vehicleSecretariaOptions>
  > | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    vehicleSecretariaOptions(empresaId)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch(() => {
        if (active)
          setResult({ error: "Não foi possível carregar as secretarias." });
      });
    return () => {
      active = false;
    };
  }, [empresaId, retry]);
  const items = [
    { value: NONE_SECRETARIA, label: "Sem secretaria" },
    ...(result?.items ?? []).map((s) => ({ value: s.id, label: s.nome })),
  ];
  return (
    <Field>
      <FieldLabel htmlFor="veiculo-secretaria">
        Secretaria
      </FieldLabel>
      <Select
        items={items}
        value={value || NONE_SECRETARIA}
        onValueChange={(v) => onChange(!v || v === NONE_SECRETARIA ? "" : v)}
        disabled={disabled || !result || Boolean(result.error)}
      >
        <SelectTrigger id="veiculo-secretaria" className="w-full">
          <SelectValue
            placeholder={!result ? "Carregando secretarias…" : "Sem secretaria"}
          />
        </SelectTrigger>
        <SelectContent align="center" alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectLabel>Secretarias da prefeitura</SelectLabel>
            {items.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {result?.error ? (
        <div className="flex items-center gap-2">
          <p role="alert" className="text-sm text-destructive">
            {result.error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              setResult(null);
              setRetry((n) => n + 1);
            }}
          >
            Tentar novamente
          </Button>
        </div>
      ) : result && !result.items?.length ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma secretaria cadastrada nesta prefeitura. O vínculo pode ser
          feito depois.
        </p>
      ) : null}
    </Field>
  );
}
