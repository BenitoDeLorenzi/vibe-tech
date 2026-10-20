"use client";

import { FormDialogCancel } from "@/components/form-dialog-cancel";

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Fuel,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldPlus,
  UserRoundCog,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { type Usuario, type UsuarioModuloAcesso } from "@/lib/usuarios-data";
import { cn } from "@/lib/utils";
import { updateUsuarioAcessos } from "./actions";

type UsuarioAcessosFormProps = {
  acessos: UsuarioModuloAcesso[];
  usuario: Usuario;
};

type PermissionGroup = {
  description: string;
  icon: LucideIcon;
  keys: string[];
  label: string;
};

const permissionGroups = [
  {
    description: "Fechamentos e controle de estoque do estabelecimento.",
    icon: ClipboardCheck,
    label: "Vibe Gestão",
    keys: ["gestao.manage"],
  },
  {
    description: "Cadastro, consulta e gestão dos veículos da frota.",
    icon: Car,
    label: "Veículos",
    keys: [
      "vehicles.read",
      "vehicles.create",
      "vehicles.update",
      "vehicles.manage",
      "vehicles.delete",
    ],
  },
  {
    description: "Controle de IPVA, licenciamento, seguro e pagamentos.",
    icon: ShieldCheck,
    label: "Débitos",
    keys: ["expirations.manage", "expirations.read"],
  },
  {
    description: "Registro de retirada, devolução e cancelamento de uso.",
    icon: KeyRound,
    label: "Uso do Veículo",
    keys: [
      "vehicle_usage.read",
      "vehicle_usage.create",
      "vehicle_usage.return",
      "vehicle_usage.cancel",
    ],
  },
  {
    description: "Registro, edição, conclusão e histórico de manutenção.",
    icon: Wrench,
    label: "Manutenção",
    keys: [
      "maintenance.read",
      "maintenance.create",
      "maintenance.update",
      "maintenance.complete",
      "maintenance.cancel",
    ],
  },
  {
    description: "Emissão, consulta, cancelamento e conclusão de ordens.",
    icon: Fuel,
    label: "Abastecimento",
    keys: [
      "fuel.read",
      "fuel.create",
      "fuel.complete",
      "fuel.cancel",
      "fuel.manage",
    ],
  },
  {
    description: "Cadastro e gestão dos postos de combustível credenciados.",
    icon: BadgeCheck,
    label: "Postos",
    keys: ["fuel_stations.read", "fuel_stations.manage"],
  },
  {
    description: "Cadastro e gestão dos motoristas vinculados à frota.",
    icon: UserRoundCog,
    label: "Motoristas",
    keys: ["drivers.read", "drivers.manage"],
  },
  {
    description: "Cadastro e gestão das oficinas da empresa.",
    icon: BadgeCheck,
    label: "Oficinas",
    keys: ["workshops.read", "workshops.manage"],
  },
  {
    description:
      "Cadastro e edição de secretarias em prefeituras. Exclusão somente pelo Master.",
    icon: BadgeCheck,
    label: "Secretarias",
    keys: ["departments.read", "departments.manage"],
  },
] satisfies PermissionGroup[];

const groupedPermissionKeys = new Set(
  permissionGroups.flatMap((group) => group.keys),
);

export function UsuarioAcessosForm({
  acessos,
  usuario,
}: UsuarioAcessosFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(updateUsuarioAcessos, {});
  const initialModuloIds = useMemo(
    () =>
      acessos.filter((modulo) => modulo.selecionado).map((modulo) => modulo.id),
    [acessos],
  );
  const initialPermissaoIds = useMemo(
    () =>
      acessos.flatMap((modulo) =>
        modulo.permissoes
          .filter((permissao) => permissao.selecionada)
          .map((permissao) => permissao.id),
      ),
    [acessos],
  );
  const [selectedModuloIds, setSelectedModuloIds] = useState(initialModuloIds);
  const [selectedPermissaoIds, setSelectedPermissaoIds] =
    useState(initialPermissaoIds);

  useEffect(() => {
    if (state.success) {
      toast.success(state.success, {
        id: "usuario-acessos-success",
      });
      router.refresh();
      closeParentDialog(formRef.current);
    }
  }, [router, state.success]);

  function submitForm() {
    const formData = new FormData();

    formData.set("usuario_id", usuario.id);
    formData.set("prefeitura_id", usuario.prefeitura_id ?? "");

    for (const moduloId of selectedModuloIds) {
      formData.append("modulo_id", moduloId);
    }

    for (const permissaoId of selectedPermissaoIds) {
      formData.append("permissao_id", permissaoId);
    }

    startTransition(() => {
      formAction(formData);
    });
  }

  function togglePermissao(modulo: UsuarioModuloAcesso, permissaoId: string) {
    const permissaoSelected = selectedPermissaoIds.includes(permissaoId);

    if (permissaoSelected) {
      const moduloPermissaoIds = new Set(
        modulo.permissoes.map((permissao) => permissao.id),
      );

      setSelectedPermissaoIds((current) => {
        const next = current.filter((id) => id !== permissaoId);
        const hasModulePermission = next.some((id) =>
          moduloPermissaoIds.has(id),
        );

        if (!hasModulePermission) {
          setSelectedModuloIds((currentModules) =>
            currentModules.filter((id) => id !== modulo.id),
          );
        }

        return next;
      });
      return;
    }

    setSelectedModuloIds((current) =>
      Array.from(new Set([...current, modulo.id])),
    );
    setSelectedPermissaoIds((current) =>
      Array.from(new Set([...current, permissaoId])),
    );
  }

  function selectAllModulePermissions(modulo: UsuarioModuloAcesso) {
    setSelectedModuloIds((current) =>
      Array.from(new Set([...current, modulo.id])),
    );
    setSelectedPermissaoIds((current) =>
      Array.from(
        new Set([
          ...current,
          ...modulo.permissoes.map((permissao) => permissao.id),
        ]),
      ),
    );
  }

  function clearModulePermissions(modulo: UsuarioModuloAcesso) {
    const moduloPermissaoIds = new Set(
      modulo.permissoes.map((permissao) => permissao.id),
    );

    setSelectedModuloIds((current) => current.filter((id) => id !== modulo.id));
    setSelectedPermissaoIds((current) =>
      current.filter((id) => !moduloPermissaoIds.has(id)),
    );
  }

  if (!usuario.prefeitura_id) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        Usuários Master têm acesso global ao painel Vibe Tech e não usam
        permissões por empresa.
      </div>
    );
  }

  if (usuario.role === "municipal_admin") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <ShieldPlus className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold">
                Acesso de administrador da empresa
              </div>
              <p className="mt-1 text-sm text-emerald-800/80">
                Administradores da empresa acessam todos os módulos com licença
                vigente da empresa e todas as ações disponíveis dentro deles.
              </p>
            </div>
          </div>
        </div>

        {acessos.length ? (
          <div className="grid gap-3">
            {acessos.map((modulo) => (
              <div
                key={modulo.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{modulo.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {modulo.permissoes.length} permissão(ões) incluídas no
                    acesso total
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                >
                  <BadgeCheck className="size-3.5" />
                  Total
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            Nenhum módulo licenciado foi encontrado para esta empresa.
          </div>
        )}
      </div>
    );
  }

  return (
    <form ref={formRef} action={submitForm} className="space-y-4">
      {state.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      {acessos.length ? (
        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          {acessos.map((modulo) => {
            const selectedCount = modulo.permissoes.filter((permissao) =>
              selectedPermissaoIds.includes(permissao.id),
            ).length;
            const moduloSelected =
              selectedModuloIds.includes(modulo.id) || selectedCount > 0;
            const isFullAccess = selectedCount === modulo.permissoes.length;

            return (
              <div
                key={modulo.id}
                className={cn(
                  "overflow-hidden rounded-lg border transition-colors",
                  moduloSelected && "border-primary/50 bg-primary/5",
                )}
              >
                <div className="flex flex-col gap-3 border-b bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{modulo.nome}</div>
                      <Badge variant="outline" className="h-6">
                        {selectedCount}/{modulo.permissoes.length}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Escolha o que este usuário poderá acessar dentro do
                      módulo.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={isFullAccess ? "default" : "outline"}
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => selectAllModulePermissions(modulo)}
                      disabled={pending}
                    >
                      <ShieldCheck className="size-4" />
                      Acesso total
                    </Button>
                    {moduloSelected ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => clearModulePermissions(modulo)}
                        disabled={pending}
                      >
                        Limpar
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 p-3">
                  {[...permissionGroups, getOtherPermissionsGroup(modulo)].map(
                    (group) => {
                      const groupPermissions = modulo.permissoes.filter(
                        (permissao) => group.keys.includes(permissao.chave),
                      );

                      if (!groupPermissions.length) {
                        return null;
                      }

                      const groupSelectedCount = groupPermissions.filter(
                        (permissao) =>
                          selectedPermissaoIds.includes(permissao.id),
                      ).length;
                      const GroupIcon = group.icon;

                      return (
                        <div
                          key={group.label}
                          className="rounded-lg border bg-background p-3"
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                                <GroupIcon className="size-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium">{group.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {group.description}
                                </div>
                              </div>
                            </div>
                            <Badge variant="outline" className="h-6 shrink-0">
                              {groupSelectedCount}/{groupPermissions.length}
                            </Badge>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            {groupPermissions.map((permissao) => {
                              const permissaoSelected =
                                selectedPermissaoIds.includes(permissao.id);

                              return (
                                <button
                                  key={permissao.id}
                                  type="button"
                                  className={cn(
                                    "flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60",
                                    permissaoSelected &&
                                      "border-primary/50 bg-primary/5",
                                  )}
                                  onClick={() =>
                                    togglePermissao(modulo, permissao.id)
                                  }
                                  disabled={pending}
                                >
                                  <Checkbox
                                    checked={permissaoSelected}
                                    tabIndex={-1}
                                    aria-hidden="true"
                                    disabled={pending}
                                  />
                                  <span className="min-w-0">
                                    <span className="block text-sm font-medium text-foreground">
                                      {permissao.nome}
                                    </span>
                                    {permissao.descricao ? (
                                      <span className="block line-clamp-2 text-xs text-muted-foreground">
                                        {permissao.descricao}
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          Nenhum módulo licenciado foi encontrado para esta empresa.
        </div>
      )}

      <DialogFooter>
        <FormDialogCancel disabled={pending} />
        <Button type="submit" className="gap-2" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {pending ? "Salvando..." : "Salvar permissões"}
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

function getOtherPermissionsGroup(
  modulo: UsuarioModuloAcesso,
): PermissionGroup {
  return {
    description: "Permissões específicas deste módulo.",
    icon: ShieldCheck,
    keys: modulo.permissoes
      .map((permissao) => permissao.chave)
      .filter((chave) => !groupedPermissionKeys.has(chave)),
    label: "Outras permissões",
  };
}
