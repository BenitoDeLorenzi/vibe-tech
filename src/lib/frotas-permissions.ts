import { cache } from "react";
import { hasModuleAccess } from "@/lib/empresa-access";
import type { CurrentUserProfile } from "@/lib/auth-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type FrotasPermissionAccess = {
  canManageCadastros: boolean;
  canCreateVeiculos: boolean;
  canDeleteVeiculos: boolean;
  canCancelAbastecimento: boolean;
  canCompleteAbastecimento: boolean;
  canCreateAbastecimento: boolean;
  canCreateManutencao: boolean;
  canCancelManutencao: boolean;
  canCompleteManutencao: boolean;
  canManageAbastecimento: boolean;
  canManageManutencao: boolean;
  canManageMotoristas: boolean;
  canManageVeiculos: boolean;
  canManageVencimentos: boolean;
  canCancelUsoVeiculo: boolean;
  canCreateUsoVeiculo: boolean;
  canReturnUsoVeiculo: boolean;
  canUpdateManutencao: boolean;
  canUpdateVeiculos: boolean;
  canViewAbastecimento: boolean;
  canViewManutencao: boolean;
  canViewMotoristas: boolean;
  canViewRelatorios: boolean;
  canCreateRelatorios: boolean;
  canViewUsoVeiculo: boolean;
  canViewVeiculos: boolean;
  isFullAccess: boolean;
  keys: string[];
};

const fullAccess: FrotasPermissionAccess = {
  canManageCadastros: true,
  canCreateVeiculos: true,
  canDeleteVeiculos: true,
  canCancelAbastecimento: true,
  canCompleteAbastecimento: true,
  canCreateAbastecimento: true,
  canCreateManutencao: true,
  canCancelManutencao: true,
  canCompleteManutencao: true,
  canManageAbastecimento: true,
  canManageManutencao: true,
  canManageMotoristas: true,
  canManageVeiculos: true,
  canManageVencimentos: true,
  canCancelUsoVeiculo: true,
  canCreateUsoVeiculo: true,
  canReturnUsoVeiculo: true,
  canUpdateManutencao: true,
  canUpdateVeiculos: true,
  canViewAbastecimento: true,
  canViewManutencao: true,
  canViewMotoristas: true,
  canViewRelatorios: true,
  canCreateRelatorios: true,
  canViewUsoVeiculo: true,
  canViewVeiculos: true,
  isFullAccess: true,
  keys: ["*"],
};

const limitedAccess: FrotasPermissionAccess = {
  canManageCadastros: false,
  canCreateVeiculos: false,
  canDeleteVeiculos: false,
  canCancelAbastecimento: false,
  canCompleteAbastecimento: false,
  canCreateAbastecimento: false,
  canCreateManutencao: false,
  canCancelManutencao: false,
  canCompleteManutencao: false,
  canManageAbastecimento: false,
  canManageManutencao: false,
  canManageMotoristas: false,
  canManageVeiculos: false,
  canManageVencimentos: false,
  canCancelUsoVeiculo: false,
  canCreateUsoVeiculo: false,
  canReturnUsoVeiculo: false,
  canUpdateManutencao: false,
  canUpdateVeiculos: false,
  canViewAbastecimento: false,
  canViewManutencao: false,
  canViewMotoristas: false,
  canViewRelatorios: false,
  canCreateRelatorios: false,
  canViewUsoVeiculo: false,
  canViewVeiculos: false,
  isFullAccess: false,
  keys: [],
};

type UsuarioPermissaoRow = {
  permissoes: {
    chave: string;
  } | null;
};

export const getFrotasPermissionAccess = cache(
  async function getFrotasPermissionAccess(
    profile: CurrentUserProfile,
  ): Promise<FrotasPermissionAccess> {
    if (!(await hasModuleAccess(profile, "frotas-publicas")))
      return limitedAccess;
    if (profile.role === "bdl_admin" || profile.role === "municipal_admin") {
      return { ...fullAccess, canDeleteVeiculos: profile.role === "bdl_admin" };
    }

    if (!profile.prefeitura_id) {
      return limitedAccess;
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("usuario_permissoes")
      .select("permissoes(chave)")
      .eq("usuario_id", profile.id);

    if (error) {
      return limitedAccess;
    }

    const keys = new Set(
      ((data ?? []) as unknown as UsuarioPermissaoRow[])
        .map((item) => item.permissoes?.chave)
        .filter((key): key is string => Boolean(key)),
    );

    return {
      canCreateVeiculos: keys.has("vehicles.create"),
      canDeleteVeiculos: false,
      canCancelAbastecimento: keys.has("fuel.cancel"),
      canCompleteAbastecimento: keys.has("fuel.complete"),
      canCreateAbastecimento: keys.has("fuel.create"),
      canCreateManutencao: keys.has("maintenance.create"),
      canCancelManutencao: keys.has("maintenance.cancel"),
      canCompleteManutencao: keys.has("maintenance.complete"),
      canManageAbastecimento: keys.has("fuel.manage"),
      canManageManutencao:
        keys.has("maintenance.complete") || keys.has("maintenance.cancel"),
      canManageMotoristas: keys.has("drivers.manage"),
      canManageVencimentos: keys.has("expirations.manage"),
      canManageCadastros:
        keys.has("fuel_stations.manage") ||
        keys.has("drivers.manage") ||
        keys.has("workshops.manage") ||
        keys.has("departments.manage"),
      canManageVeiculos: keys.has("vehicles.manage"),
      canCancelUsoVeiculo: keys.has("vehicle_usage.cancel"),
      canCreateUsoVeiculo: keys.has("vehicle_usage.create"),
      canReturnUsoVeiculo: keys.has("vehicle_usage.return"),
      canUpdateManutencao: keys.has("maintenance.update"),
      canUpdateVeiculos: keys.has("vehicles.update"),
      canViewAbastecimento: hasAnyPrefix(keys, "fuel."),
      canViewManutencao: hasAnyPrefix(keys, "maintenance."),
      canViewMotoristas: hasAnyPrefix(keys, "drivers."),
      canViewRelatorios: keys.has("reports.read") || keys.has("reports.create"),
      canCreateRelatorios: keys.has("reports.create"),
      canViewUsoVeiculo: hasAnyPrefix(keys, "vehicle_usage."),
      canViewVeiculos: hasAnyPrefix(keys, "vehicles."),
      isFullAccess: false,
      keys: Array.from(keys),
    };
  },
);

function hasAnyPrefix(keys: Set<string>, prefix: string) {
  return Array.from(keys).some((key) => key.startsWith(prefix));
}

export async function hasFrotasPermission(
  profile: CurrentUserProfile,
  key: string,
) {
  if (key === "vehicles.delete" && profile.role !== "bdl_admin") return false;
  const access = await getFrotasPermissionAccess(profile);
  return access.isFullAccess || access.keys.includes(key);
}
