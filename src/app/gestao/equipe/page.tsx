import { EquipePage } from "./equipe-page";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; limite?: string }>;
}) {
  return <EquipePage tipo="colaboradores" query={await searchParams} />;
}
