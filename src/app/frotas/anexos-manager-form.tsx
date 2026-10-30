"use client";
import { ListDeleteButton } from "@/components/list-delete-button";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import {
  AlertCircle,
  ExternalLink,
  Download,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type FrotaAnexo } from "@/lib/frotas-data";
import {
  addManutencaoAnexos,
  addVeiculoAnexos,
  deleteManutencaoAnexo,
  deleteVeiculoAnexo,
  type FrotaActionState,
} from "./actions";

type PdfDocument = { url: string; downloadUrl: string; createdAt: string };

type AnexosManagerFormProps = {
  pdfDocument?: PdfDocument;
  anexos: FrotaAnexo[];
  ownerId: string;
  ownerLabel: string;
  type: "manutencao" | "veiculo";
};

type AnexosFormValues = {
  anexos: FileList | null;
};

const uploadActions = {
  manutencao: addManutencaoAnexos,
  veiculo: addVeiculoAnexos,
};

const deleteActions = {
  manutencao: deleteManutencaoAnexo,
  veiculo: deleteVeiculoAnexo,
};

export function AnexosManagerForm({
  pdfDocument,
  anexos,
  ownerId,
  ownerLabel,
  type,
}: AnexosManagerFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, actionPending] = useActionState(
    uploadActions[type],
    {}
  );
  const form = useForm<AnexosFormValues>({
    defaultValues: {
      anexos: null,
    },
  });

  useEffect(() => {
    if (state.success) {
      toast.success(state.success, {
        id: `anexos-upload-${type}-${ownerId}`,
      });
      router.refresh();
      form.reset({ anexos: null });
      formRef.current?.reset();
    }
  }, [form, ownerId, router, state.success, type]);

  function submitForm(values: AnexosFormValues) {
    const formData = new FormData();
    formData.set("id", ownerId);

    Array.from(values.anexos ?? []).forEach((file) => {
      formData.append("anexos", file);
    });

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <div className="space-y-4">
      <AnexosList anexos={anexos} type={type} canDelete pdfDocument={pdfDocument} />

      <form
        ref={formRef}
        aria-label={`Adicionar documentos de ${ownerLabel}`}
        onSubmit={form.handleSubmit(submitForm)}
        className="space-y-3 rounded-lg border bg-muted/20 p-3"
        noValidate
      >
        {state.error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        ) : null}

        <fieldset
          disabled={actionPending}
          className="grid gap-3 disabled:opacity-70 sm:grid-cols-[1fr_auto]"
        >
          <Controller
            control={form.control}
            name="anexos"
            rules={{
              validate: (files) =>
                files?.length ? true : "Selecione ao menos um documento.",
            }}
            render={({ field: { onChange, ref }, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`anexos-${type}-${ownerId}`}>
                  Novo documento
                </FieldLabel>
                <Input
                  id={`anexos-${type}-${ownerId}`}
                  ref={ref}
                  type="file"
                  multiple
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  aria-invalid={fieldState.invalid}
                  onChange={(event) => onChange(event.target.files)}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <div className="flex items-end">
            <Button type="submit" className="w-full gap-2" disabled={actionPending}>
              {actionPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {actionPending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}

export function AnexosList({ anexos, type = "veiculo", canDelete = false, pdfDocument }: { anexos: FrotaAnexo[]; type?: "manutencao" | "veiculo"; canDelete?: boolean; pdfDocument?: PdfDocument }) {
  return <div className="vehicle-detail-mobile-table vehicle-detail-attachments overflow-hidden rounded-lg border"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead>Documento</TableHead><TableHead>Tipo</TableHead><TableHead>Tamanho</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>
    {pdfDocument ? <TableRow><TableCell><div className="flex items-center gap-2 font-medium"><FileText className="size-4 text-muted-foreground" />Consulta Detran/SC</div></TableCell><TableCell>PDF</TableCell><TableCell>-</TableCell><TableCell>{formatDate(pdfDocument.createdAt)}</TableCell><TableCell><div className="flex justify-end gap-1"><a href={pdfDocument.url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Visualizar consulta Detran/SC"><ExternalLink className="size-4" /></a><a href={pdfDocument.downloadUrl} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Baixar consulta Detran/SC"><Download className="size-4" /></a></div></TableCell></TableRow> : null}
    {anexos.map((anexo) => <TableRow key={anexo.id}><TableCell className="max-w-[420px] whitespace-normal font-medium">{anexo.file_name}</TableCell><TableCell>{anexo.file_type === "application/pdf" ? "PDF" : anexo.file_type?.startsWith("image/") ? "Imagem" : "Documento"}</TableCell><TableCell>{formatFileSize(anexo.file_size)}</TableCell><TableCell>{anexo.created_at ? formatDate(anexo.created_at) : "-"}</TableCell><TableCell><div className="flex justify-end gap-1">{anexo.signed_url ? <a href={anexo.signed_url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={"Abrir " + anexo.file_name}><ExternalLink className="size-4" /></a> : null}{canDelete ? <DeleteAnexoButton anexoId={anexo.id} type={type} /> : null}</div></TableCell></TableRow>)}
    {!anexos.length && !pdfDocument ? <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">Nenhum documento anexado.</TableCell></TableRow> : null}
  </TableBody></Table></div>;
}

function DeleteAnexoButton({
  anexoId,
  type,
}: {
  anexoId: string;
  type: "manutencao" | "veiculo";
}) {
  const router = useRouter();
  const [state, formAction, actionPending] = useActionState<
    FrotaActionState,
    FormData
  >(deleteActions[type], {});

  useEffect(() => {
    if (state.success) {
      toast.success(state.success, {
        id: `anexos-delete-${type}-${anexoId}`,
      });
      router.refresh();
    }
  }, [anexoId, router, state.success, type]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={anexoId} />
      <ListDeleteButton
        type="submit"
        disabled={actionPending}
        aria-label="Remover documento"
      >
        {actionPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </ListDeleteButton>
      {state.error ? (
        <Badge variant="destructive" className="mt-2">
          {state.error}
        </Badge>
      ) : null}
    </form>
  );
}

function formatFileSize(value: number | null) {
  if (!value) {
    return "-";
  }

  if (value < 1024 * 1024) {
    return `${Math.ceil(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}
