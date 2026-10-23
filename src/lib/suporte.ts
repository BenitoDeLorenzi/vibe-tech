import "server-only";
import { getCurrentUserProfile } from "@/lib/auth-data";
import { getModuleLicensedEmpresas, hasModuleAccess } from "@/lib/empresa-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const supportBucket = "suporte-anexos";
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function getSupportScope(params: URLSearchParams) {
  const profile = await getCurrentUserProfile();
  if (!profile?.primeiro_acesso_concluido_em) return null;
  const master = params.get("mode") === "master";
  if (master) return profile.role === "bdl_admin" ? { profile, master, empresa: null } : null;
  if (!(await hasModuleAccess(profile, "frotas-publicas"))) return null;
  const requested = params.get("empresa");
  const empresa = profile.role === "bdl_admin" ? requested : profile.prefeitura_id;
  if (!empresa || (requested && empresa !== requested)) return null;
  const licensed = await getModuleLicensedEmpresas("frotas-publicas");
  if (!licensed.some(item => item.id === empresa)) return null;
  return { profile, master, empresa };
}
export type SupportScope = NonNullable<Awaited<ReturnType<typeof getSupportScope>>>;

export async function getSupportTicket(scope: SupportScope, id: string) {
  if (!isUuid(id)) return null;
  let query = createSupabaseServerClient().from("suporte_conversas")
    .select("id,empresa_id,usuario_id,solicitante_nome,assunto,origem,status,created_at,updated_at,empresas(nome),perfis!suporte_conversas_usuario_id_fkey(nome)").eq("id", id);
  if (!scope.master) query = query.eq("usuario_id", scope.profile.id).eq("empresa_id", scope.empresa);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("Não foi possível carregar o atendimento.", { cause: error.code });
  return data;
}

export function supportRpcScope(scope: SupportScope) {
  return { p_usuario: scope.profile.id, p_master: scope.master, p_empresa: scope.empresa };
}
