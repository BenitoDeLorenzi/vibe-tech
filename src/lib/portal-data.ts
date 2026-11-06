import type { CurrentUserProfile } from "@/lib/auth-data";
import { getUserModules } from "@/lib/empresa-access";
export type PortalModulo = {
  description: string;
  highlights: string[];
  href: string;
  id: string;
  label: string;
  slug: string;
};
type ModuloRow = { id: string; nome: string; slug: string };
export async function getPortalModules(
  profile: CurrentUserProfile,
): Promise<PortalModulo[]> {
  const modules = (await getUserModules(profile)).map(mapModuloToPortalItem);
  return profile.role === "bdl_admin"
    ? [
        {
          description: "Gestão da Vibe Tech, empresas, licenças e usuários.",
          highlights: ["Empresas", "Licenças", "Cobranças"],
          href: "/",
          id: "bdl-admin",
          label: "Painel Vibe Tech",
          slug: "bdl-admin",
        },
        ...modules,
      ]
    : modules;
}
function mapModuloToPortalItem(modulo: ModuloRow): PortalModulo {
  if (modulo.slug === "gestao-estabelecimentos") {
    return {
      description: "Organize a rotina e os resultados do estabelecimento.",
      highlights: ["Produtos", "Estoque", "Fechamentos"],
      href: "/gestao",
      id: modulo.id,
      label: modulo.nome,
      slug: modulo.slug,
    };
  }
  if (modulo.slug === "frotas-publicas") {
    return {
      description: "Controle a operação diária e os custos da frota.",
      highlights: ["Veículos", "Abastecimento", "Manutenção"],
      href: "/frotas",
      id: modulo.id,
      label: modulo.nome,
      slug: modulo.slug,
    };
  }

  return {
    description: "Módulo habilitado para acesso.",
    highlights: [],
    href: "#",
    id: modulo.id,
    label: modulo.nome,
    slug: modulo.slug,
  };
}
