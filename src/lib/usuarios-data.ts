import { getEmpresaLicensedModules } from "@/lib/empresa-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type UsuarioRole = "bdl_admin" | "municipal_admin" | "municipal_user";

export type Usuario = {
  ativo: boolean;
  cpf: string | null;
  created_at: string;
  email: string | null;
  email_contato: string | null;
  email_contato_verificado_em: string | null;
  id: string;
  nome: string;
  prefeitura_id: string | null;
  prefeitura_nome: string | null;
  primeiro_acesso_concluido_em: string | null;
  role: UsuarioRole;
  senha_inicial_alterada_em: string | null;
  username: string | null;
};

type UsuarioRow = {
  ativo: boolean;
  cpf: string | null;
  created_at: string;
  email: string | null;
  email_contato: string | null;
  email_contato_verificado_em: string | null;
  id: string;
  nome: string;
  prefeitura_id: string | null;
  primeiro_acesso_concluido_em: string | null;
  prefeituras: {
    nome: string;
  } | null;
  role: UsuarioRole;
  senha_inicial_alterada_em: string | null;
  username: string | null;
};

export type UsuarioPrefeituraOption = {
  id: string;
  nome: string;
};

export type UsuarioPermissao = {
  chave: string;
  descricao: string | null;
  id: string;
  nome: string;
  selecionada: boolean;
};

export type UsuarioModuloAcesso = {
  id: string;
  nome: string;
  permissoes: UsuarioPermissao[];
  selecionado: boolean;
  slug: string;
};

type LicencaModuloRow = {
  modulo_id: string;
  modulos: {
    id: string;
    nome: string;
    slug: string;
  } | null;
};

type PermissaoRow = {
  chave: string;
  descricao: string | null;
  id: string;
  modulo_id: string;
  nome: string;
};

type UsuarioModuloRow = {
  modulo_id: string;
};

type UsuarioPermissaoRow = {
  permissao_id: string;
};

export async function getUsuarios(params?: {
  prefeituraId?: string;
  query?: string;
  role?: string;
  status?: string;
}) {
  const supabase = createSupabaseServerClient();
  const query = buildUsuariosQuery(supabase, params, true);

  const { data, error } = await query;

  if (error) {
    if (isMissingProfileAccessColumnError(error.message)) {
      const fallbackResult = await buildUsuariosQuery(supabase, params, false);

      if (fallbackResult.error) {
        throw new Error(fallbackResult.error.message);
      }

      return mapUsuariosRows(
        (fallbackResult.data ?? []) as unknown as UsuarioRow[],
      );
    }

    throw new Error(error.message);
  }

  const rows = mapUsuariosRows((data ?? []) as unknown as UsuarioRow[]);

  if (!params?.query) {
    return rows;
  }

  const normalizedQuery = params.query.toLowerCase();
  return rows.filter((usuario) =>
    [
      usuario.nome,
      usuario.cpf,
      formatCpf(usuario.cpf),
      usuario.email,
      usuario.username,
      usuario.prefeitura_nome,
      formatUsuarioRole(usuario.role),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery),
  );
}

function buildUsuariosQuery(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  params:
    | {
        prefeituraId?: string;
        query?: string;
        role?: string;
        status?: string;
      }
    | undefined,
  includeAccessFields: boolean,
) {
  const select = includeAccessFields
    ? "id,nome,email,email_contato,email_contato_verificado_em,primeiro_acesso_concluido_em,senha_inicial_alterada_em,username,cpf,role,prefeitura_id,ativo,created_at,prefeituras:empresas!perfis_prefeitura_id_fkey(nome)"
    : "id,nome,role,prefeitura_id,created_at,prefeituras:empresas!perfis_prefeitura_id_fkey(nome)";
  let query = supabase.from("perfis").select(select).order("created_at", {
    ascending: false,
  }).is("excluido_em", null);

  if (params?.role && params.role !== "all") {
    query = query.eq("role", params.role);
  }

  if (includeAccessFields && params?.status === "active") {
    query = query.eq("ativo", true);
  }

  if (includeAccessFields && params?.status === "inactive") {
    query = query.eq("ativo", false);
  }

  if (params?.prefeituraId) {
    query = query.eq("prefeitura_id", params.prefeituraId);
  }

  return query;
}

function mapUsuariosRows(rows: UsuarioRow[]) {
  return rows.map((usuario) => ({
    ativo: usuario.ativo ?? true,
    cpf: usuario.cpf ?? null,
    created_at: usuario.created_at,
    email: usuario.email ?? null,
    email_contato: usuario.email_contato ?? null,
    email_contato_verificado_em: usuario.email_contato_verificado_em ?? null,
    id: usuario.id,
    nome: usuario.nome,
    prefeitura_id: usuario.prefeitura_id,
    prefeitura_nome: usuario.prefeituras?.nome ?? null,
    primeiro_acesso_concluido_em: usuario.primeiro_acesso_concluido_em ?? null,
    role: usuario.role,
    senha_inicial_alterada_em: usuario.senha_inicial_alterada_em ?? null,
    username: usuario.username ?? null,
  }));
}

export async function getUsuarioFormOptions() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("id,nome")
    .eq("status", "active")
    .order("nome");

  if (error) {
    throw new Error(error.message);
  }

  return {
    prefeituras: (data ?? []) as UsuarioPrefeituraOption[],
  };
}

export async function getUsuariosAccessMap(usuarios: Usuario[]) {
  const municipalUsers = usuarios.filter((usuario) => usuario.prefeitura_id);
  const entries = await Promise.all(
    municipalUsers.map(async (usuario) => [
      usuario.id,
      await getUsuarioAccessOptions(usuario),
    ]),
  );

  return Object.fromEntries(entries) as Record<string, UsuarioModuloAcesso[]>;
}

export async function getUsuarioAccessOptions(usuario: Usuario) {
  if (!usuario.prefeitura_id) {
    return [];
  }

  const supabase = createSupabaseServerClient();
  const [licencasResult, usuarioModulosResult, usuarioPermissoesResult] =
    await Promise.all([
      supabase
        .from("licencas")
        .select("modulo_id,modulos(id,nome,slug)")
        .eq("prefeitura_id", usuario.prefeitura_id)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("usuario_modulos")
        .select("modulo_id")
        .eq("usuario_id", usuario.id),
      supabase
        .from("usuario_permissoes")
        .select("permissao_id")
        .eq("usuario_id", usuario.id),
    ]);

  if (licencasResult.error) {
    if (isMissingPermissionTableError(licencasResult.error.message)) {
      return [];
    }

    throw new Error(licencasResult.error.message);
  }

  if (usuarioModulosResult.error) {
    if (isMissingPermissionTableError(usuarioModulosResult.error.message)) {
      return [];
    }

    throw new Error(usuarioModulosResult.error.message);
  }

  if (usuarioPermissoesResult.error) {
    if (isMissingPermissionTableError(usuarioPermissoesResult.error.message)) {
      return [];
    }

    throw new Error(usuarioPermissoesResult.error.message);
  }

  const licensedIds = new Set(
    (await getEmpresaLicensedModules(usuario.prefeitura_id)).map((m) => m.id),
  );
  const licencas = (
    (licencasResult.data ?? []) as unknown as LicencaModuloRow[]
  ).filter((l) => licensedIds.has(l.modulo_id));
  const moduloIds = licencas
    .map((licenca) => licenca.modulo_id)
    .filter((id): id is string => Boolean(id));

  if (!moduloIds.length) {
    return [];
  }

  const permissoesResult = await supabase
    .from("permissoes")
    .select("id,modulo_id,chave,nome,descricao")
    .in("modulo_id", moduloIds)
    .order("chave");

  if (permissoesResult.error) {
    if (isMissingPermissionTableError(permissoesResult.error.message)) {
      return [];
    }

    throw new Error(permissoesResult.error.message);
  }

  const selectedModuloIds = new Set(
    ((usuarioModulosResult.data ?? []) as UsuarioModuloRow[]).map(
      (item) => item.modulo_id,
    ),
  );
  const selectedPermissaoIds = new Set(
    ((usuarioPermissoesResult.data ?? []) as UsuarioPermissaoRow[]).map(
      (item) => item.permissao_id,
    ),
  );
  const permissoes = (permissoesResult.data ?? []) as PermissaoRow[];
  const allowedPermissionKeys = getAllowedPermissionKeys(usuario.role);

  return licencas
    .filter((licenca) => licenca.modulos)
    .map((licenca) => ({
      id: licenca.modulo_id,
      nome: licenca.modulos?.nome ?? "-",
      permissoes: permissoes
        .filter((permissao) => permissao.modulo_id === licenca.modulo_id)
        .filter((permissao) => allowedPermissionKeys.has(permissao.chave))
        .map((permissao) => ({
          chave: permissao.chave,
          descricao: permissao.descricao,
          id: permissao.id,
          nome: permissao.nome,
          selecionada: selectedPermissaoIds.has(permissao.id),
        })),
      selecionado: selectedModuloIds.has(licenca.modulo_id),
      slug: licenca.modulos?.slug ?? "-",
    }));
}

function getAllowedPermissionKeys(role: UsuarioRole) {
  if (role === "municipal_admin" || role === "municipal_user") {
    return new Set([
      "gestao.manage",
      "vehicles.create",
      "vehicles.update",
      "vehicles.manage",
      "vehicles.read",
      "expirations.manage",
      "expirations.read",
      "maintenance.create",
      "maintenance.update",
      "maintenance.complete",
      "maintenance.cancel",
      "maintenance.read",
      "fuel.create",
      "fuel.complete",
      "fuel.cancel",
      "fuel.manage",
      "fuel.read",
      "fuel_stations.manage",
      "fuel_stations.read",
      "drivers.manage",
      "drivers.read",
      "departments.read",
      "departments.manage",
      "workshops.read",
      "workshops.manage",

      "reports.read",
      "reports.create",
      "vehicle_usage.read",
      "vehicle_usage.create",
      "vehicle_usage.return",
      "vehicle_usage.cancel",
    ]);
  }

  return new Set<string>();
}

export function formatUsuarioRole(role: UsuarioRole) {
  const labels: Record<UsuarioRole, string> = {
    bdl_admin: "Master",
    municipal_admin: "Administrador",
    municipal_user: "Usuário",
  };

  return labels[role];
}

export type UsuarioStatus = "inactive" | "first_access" | "email_pending" | "active";

export function getUsuarioStatus(usuario: Pick<Usuario, "ativo" | "primeiro_acesso_concluido_em" | "email_contato_verificado_em">): UsuarioStatus {
  if (!usuario.ativo) return "inactive";
  if (!usuario.primeiro_acesso_concluido_em) return "first_access";
  if (!usuario.email_contato_verificado_em) return "email_pending";
  return "active";
}

export function formatUsuarioStatus(status: UsuarioStatus) {
  const labels: Record<UsuarioStatus, string> = {
    inactive: "Inativo",
    first_access: "Aguardando primeiro acesso",
    email_pending: "E-mail pendente",
    active: "Ativo",
  };
  return labels[status];
}

export function formatCpf(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (digits.length !== 11) {
    return value ?? "-";
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function isMissingProfileAccessColumnError(message: string) {
  return (
    message.includes("perfis.email") ||
    message.includes("perfis.username") ||
    message.includes("perfis.cpf") ||
    message.includes("perfis.ativo") ||
    message.includes("perfis.primeiro_acesso_concluido_em") ||
    message.includes("perfis.senha_inicial_alterada_em") ||
    message.includes("perfis.email_contato_verificado_em")
  );
}

function isMissingPermissionTableError(message: string) {
  return (
    message.includes("permissoes") ||
    message.includes("usuario_modulos") ||
    message.includes("usuario_permissoes")
  );
}
