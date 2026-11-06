import { NextResponse } from "next/server";
import { resumePendingVehicleUpdates } from "@/lib/frota-monthly-updates";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return new NextResponse("Não autorizado.", { status: 401 });
  try { return NextResponse.json({ resumed: await resumePendingVehicleUpdates() }); }
  catch (error) {
    console.error("Falha ao retomar atualizações de veículos", error);
    return NextResponse.json({ error: "Falha ao retomar atualizações." }, { status: 500 });
  }
}
