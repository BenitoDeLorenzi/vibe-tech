import { Headset } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { SupportCenter, SupportMobileSearch, SupportToolbar, SupportWorkspace } from "@/components/support/support-center";
import { requireRole } from "@/lib/auth-data";

export const dynamic = "force-dynamic";
export default async function AtendimentosPage() {
  const profile = await requireRole(["bdl_admin"]);
  return <SupportWorkspace><AdminShell active="atendimentos" title="Atendimentos" icon={Headset} profile={profile} actions={<SupportToolbar master />} mobileSubheader={<SupportMobileSearch />}><SupportCenter master userId={profile.id} /></AdminShell></SupportWorkspace>;
}
