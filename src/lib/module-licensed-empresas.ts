import type { SupabaseClient } from "@supabase/supabase-js";

export async function listarEmpresasLicenciadas(
  db: SupabaseClient,
  slug: string,
  today: string,
) {
  const empresas = new Map<
    string,
    {
      id: string;
      nome: string;
      nome_fantasia: string | null;
      brasao_url: string | null;
      is_prefeitura: boolean;
    }
  >();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("licencas")
      .select(
        "id,empresas!inner(id,nome,nome_fantasia,brasao_url,is_prefeitura,status),modulos!inner(slug,ativo)",
      )
      .eq("status", "active")
      .lte("inicio", today)
      .gte("fim", today)
      .eq("empresas.status", "active")
      .eq("modulos.slug", slug)
      .eq("modulos.ativo", true)
      .order("id")
      .range(offset, offset + 499);
    if (error)
      throw new Error(
        "Não foi possível carregar as empresas licenciadas para este módulo.",
      );
    for (const row of data) {
      const empresa = row.empresas as unknown as {
        id: string;
        nome: string;
        nome_fantasia: string | null;
        brasao_url: string | null;
        is_prefeitura: boolean;
      };
      empresas.set(empresa.id, empresa);
    }
    if (data.length < 500) break;
  }
  return [...empresas.values()].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
}
