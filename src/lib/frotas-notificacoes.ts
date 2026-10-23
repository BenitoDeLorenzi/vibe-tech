import "server-only";
import { getCurrentUserProfile } from "@/lib/auth-data";
import { getModuleLicensedEmpresas, hasModuleAccess } from "@/lib/empresa-access";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";

export async function getNotificationScope(empresa: string | null) {
  const profile = await getCurrentUserProfile();
  if (!profile?.primeiro_acesso_concluido_em) return null;
  if (!(await hasModuleAccess(profile, "frotas-publicas"))) return null;
  const access = await getFrotasPermissionAccess(profile);
  const tipos = [
    "suporte",
    ...(access.canViewAbastecimento ? ["abastecimento"] : []),
    ...(access.canViewManutencao ? ["manutencao"] : []),
    ...(access.canViewUsoVeiculo ? ["uso_veiculo"] : []),
  ];
  const empresas = await getModuleLicensedEmpresas("frotas-publicas");
  const empresaId = profile.role === "bdl_admin" ? empresa : profile.prefeitura_id;
  if (!empresaId || !empresas.some(item => item.id === empresaId)) return null;
  if (empresa && empresa !== empresaId) return null;
  return { empresaId, usuarioId: profile.id, tipos };
}
