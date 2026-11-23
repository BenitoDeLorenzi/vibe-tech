import { Tags, CircleCheck, CircleMinus } from "lucide-react";
import { FormSelect } from "@/components/form-select";
import { getCategorias, getGestaoContext } from "@/lib/gestao-data";
import type { Categoria } from "@/lib/gestao-types";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CadastroForm } from "../cadastro-form";
import { GestaoShell } from "../gestao-shell";
import { GestaoShowMore } from "../gestao-show-more";
import { gestaoListLimit } from "@/lib/gestao-list-limit";
import {
  Empty,
  Field,
  inputClass,
  Panel,
  GestaoDialog,
  MetricBadge,
  ListBadge,
  SearchToolbar,
} from "../ui";
function CategoriaForm({
  unidadeId,
  categoria,
}: {
  unidadeId: string;
  categoria?: Categoria;
}) {
  return (
    <CadastroForm
      acao="categoria"
      unidadeId={unidadeId}
      label={categoria ? "Salvar alterações" : "Cadastrar categoria"}
    >
      {categoria && (
        <>
          <input type="hidden" name="id" value={categoria.id} />
          <input type="hidden" name="versao" value={categoria.versao} />
        </>
      )}
      <Field label="Nome">
        <Input
          name="nome"
          defaultValue={categoria?.nome}
          required
          minLength={2}
          maxLength={80}
          placeholder="Ex.: Cervejas artesanais"
        />
      </Field>
      <Field label="Descrição">
        <textarea
          name="descricao"
          defaultValue={categoria?.descricao}
          maxLength={500}
          rows={3}
          className={inputClass + " h-auto py-2"}
        />
      </Field>
      <Field label="Situação">
        <FormSelect
          name="ativo"
          aria-label="Situação"
          groupLabel="Situação"
          defaultValue={String(categoria?.ativo ?? true)}
          options={[
            { value: "true", label: "Ativa" },
            { value: "false", label: "Inativa" },
          ]}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        Categorias inativas permanecem nos produtos existentes, mas não podem
        ser atribuídas a outros produtos.
      </p>
    </CadastroForm>
  );
}
export default async function CategoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; limite?: string }>;
}) {
  const [{ unidade, gestor }, categorias, { q, limite }] = await Promise.all([
    getGestaoContext(),
    getCategorias(),
    searchParams,
  ]);
  const filtradas = categorias.filter(
    (c) =>
      !q ||
      (c.nome + " " + c.descricao)
        .toLocaleLowerCase("pt-BR")
        .includes(q.trim().toLocaleLowerCase("pt-BR")),
  );
  return (
    <GestaoShell
      title="Categorias"
      icon={Tags}
      actions={
        <SearchToolbar
          placeholder="Buscar categoria"
          query={q}
          clearHref="/gestao/categorias"
        >
          {gestor && unidade && (
            <GestaoDialog
              title="Nova categoria"
              label="Nova categoria"
              description="Organize os produtos da empresa."
            >
              <CategoriaForm unidadeId={unidade.id} />
            </GestaoDialog>
          )}
        </SearchToolbar>
      }
    >
      <Panel
        title="Categorias cadastradas"
        description="Categorias compartilhadas entre as unidades da empresa."
        icon={Tags}
        metrics={
          <>
            <MetricBadge
              label="Categorias"
              icon={Tags}
              value={categorias.length}
            />
            <MetricBadge
              label="Ativas"
              icon={CircleCheck}
              tone="success"
              value={categorias.filter((c) => c.ativo).length}
            />
          </>
        }
      >
        {filtradas.length ? (
          <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Situação</TableHead>
                  {gestor && (
                    <TableHead className="w-[128px] text-right">
                      Ações
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.slice(0, gestaoListLimit(limite)).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="max-w-md whitespace-normal text-muted-foreground">
                      {c.descricao || "—"}
                    </TableCell>
                    <TableCell>
                      <ListBadge
                        icon={c.ativo ? CircleCheck : CircleMinus}
                        tone={c.ativo ? "success" : "neutral"}
                      >
                        {c.ativo ? "Ativa" : "Inativa"}
                      </ListBadge>
                    </TableCell>
                    {gestor && unidade && (
                      <TableCell className="text-right">
                        <GestaoDialog
                          editing
                          title="Editar categoria"
                          label={"Editar " + c.nome}
                          description="A alteração vale para todas as unidades desta empresa."
                        >
                          <CategoriaForm unidadeId={unidade.id} categoria={c} />
                        </GestaoDialog>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <GestaoShowMore shown={Math.min(gestaoListLimit(limite), filtradas.length)} total={filtradas.length} />
          </>
        ) : (
          <Empty
            title="Nenhuma categoria encontrada"
            description={
              unidade
                ? "Ajuste a busca ou use Nova categoria."
                : "Selecione uma empresa com licença vigente."
            }
          />
        )}
      </Panel>
    </GestaoShell>
  );
}
