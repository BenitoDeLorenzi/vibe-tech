"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { SidebarIdentity } from "@/components/sidebar-identity";

import type { CurrentUserProfile } from "@/lib/auth-data";
import type { FrotaPrefeituraOption } from "@/lib/frotas-data";

type FrotasPrefeituraContextProps = {
  prefeituras: FrotaPrefeituraOption[];
  profile: CurrentUserProfile;
  selectedPrefeituraId?: string;
};

export function FrotasPrefeituraContext({
  prefeituras,
  profile,
  selectedPrefeituraId,
}: FrotasPrefeituraContextProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = profile.role === "bdl_admin";
  const prefeitura = prefeituras.find(
    (item) => item.id === (selectedPrefeituraId ?? profile.prefeitura_id),
  );
  const prefeituraNome =
    prefeitura?.nome ?? profile.prefeitura_nome ?? "Empresa";

  function updatePrefeitura(prefeituraId: string | null) {
    const query = new URLSearchParams(searchParams.toString());

    if (prefeituraId) {
      query.set("prefeitura", prefeituraId);
    } else {
      query.delete("prefeitura");
    }

    const queryString = query.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ""}`);
  }

  return (
    <div className="space-y-1">
      <Link href="/frotas" className="flex h-12 items-center gap-2 rounded-lg px-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0">
        <Image src="/brand/vibe-tech-icon.png" alt="Vibe Frotas" width={32} height={32} className="size-8 shrink-0 rounded-lg object-contain" />
        <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">Vibe Frotas</span>
      </Link>
    <SidebarIdentity
      name={
        prefeitura?.nome_fantasia ||
        prefeitura?.nome ||
        (isAdmin
          ? "Selecione uma empresa"
          : profile.prefeitura_nome_fantasia || prefeituraNome)
      }
      logoUrl={
        prefeitura?.brasao_url ??
        (!isAdmin ? profile.prefeitura_brasao_url : null)
      }
      options={
        isAdmin
          ? prefeituras.map((p) => ({
              id: p.id,
              name: p.nome_fantasia || p.nome,
              logoUrl: p.brasao_url,
            }))
          : undefined
      }
      selectedId={prefeitura?.id}
      onSelect={isAdmin ? updatePrefeitura : undefined}
    />
    </div>
  );
}
