import Link from "next/link";
import { forbidden } from "next/navigation";
import { ArrowLeft, Plus, RefreshCw } from "lucide-react";
import { FrotasShell } from "@/app/frotas/frotas-shell";
import { VehicleUpdatesPanel } from "@/app/frotas/veiculos/atualizacoes/vehicle-updates-panel";
import { buttonVariants } from "@/components/ui/button";
import { requireUserProfile } from "@/lib/auth-data";
import { getModuleLicensedEmpresas } from "@/lib/empresa-access";
import { getFrotasPermissionAccess } from "@/lib/frotas-permissions";
import { getVehicleUpdateRuns, currentCompetencia } from "@/lib/frota-monthly-updates";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function VehicleUpdatesPage({ searchParams }: { searchParams: Promise<{ prefeitura?: string; novo?: string; simulacao?: string }> }) {
  const profile = await requireUserProfile();
  const access = await getFrotasPermissionAccess(profile);
  if (!access.canViewVeiculos) forbidden();
  const companies = await getModuleLicensedEmpresas("frotas-publicas");
  const params = await searchParams;
  const simulation = profile.role === "bdl_admin" && params.simulacao === "100";
  const selectedCompanyId = profile.role === "bdl_admin"
    ? companies.some((company) => company.id === params.prefeitura) ? params.prefeitura : companies[0]?.id
    : profile.prefeitura_id ?? undefined;
  if (selectedCompanyId && !companies.some((company) => company.id === selectedCompanyId)) forbidden();
  const db = createSupabaseServerClient();
  const [storedRuns, vehicleCount] = await Promise.all([
    selectedCompanyId && !simulation ? getVehicleUpdateRuns(selectedCompanyId) : Promise.resolve([]),
    selectedCompanyId && !simulation ? db.from("frota_veiculos").select("id", { count: "exact", head: true }).eq("prefeitura_id", selectedCompanyId) : Promise.resolve({ count: 0, error: null }),
  ]);
  if (vehicleCount.error) throw new Error("Não foi possível contar os veículos.");
  const competencia = currentCompetencia();
  const runs = simulation ? [{ id: "simulation-100", competencia, status: "processing", createdAt: new Date().toISOString(), completedAt: null, total: 100, success: 37, error: 3, pending: 60 }] : storedRuns;
  const company = companies.find((item) => item.id === selectedCompanyId);
  const backHref = `/frotas/veiculos${selectedCompanyId ? `?prefeitura=${selectedCompanyId}` : ""}`;
  const canStart = !simulation && access.canManageVeiculos && Boolean(vehicleCount.count) && !runs.some((run) => run.competencia === competencia);
  const newHref = `/frotas/veiculos/atualizacoes?${new URLSearchParams({ ...(selectedCompanyId ? { prefeitura: selectedCompanyId } : {}), novo: "1" })}`;
  return <FrotasShell active="veiculos" icon={RefreshCw} title="Atualizações de veículos"
    profile={profile} prefeituras={companies} selectedPrefeituraId={selectedCompanyId}
    actions={<div className="flex items-center justify-end gap-2"><Link href={backHref} className={buttonVariants({ variant: "outline", className: "h-9 gap-2" })}><ArrowLeft className="size-4" />Voltar</Link>{canStart && <Link href={newHref} className={buttonVariants({ className: "h-9 gap-2" })}><Plus className="size-4" />Nova atualização</Link>}</div>}>
    <VehicleUpdatesPanel companyId={selectedCompanyId} companyName={company?.nome_fantasia || company?.nome || "Empresa"}
      competencia={competencia} initialRuns={runs} vehicleCount={simulation ? 100 : vehicleCount.count ?? 0}
      canManage={access.canManageVeiculos && !simulation} simulation={simulation} />
  </FrotasShell>;
}
