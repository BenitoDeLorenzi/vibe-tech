import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth-data";
import { getInterAccessToken } from "@/lib/inter-client";

export const runtime = "nodejs";

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile?.primeiro_acesso_concluido_em)
    return NextResponse.json(
      { error: "Entre novamente para continuar." },
      { status: 401 },
    );
  if (profile.role !== "bdl_admin")
    return NextResponse.json(
      { error: "Acesso não autorizado." },
      { status: 403 },
    );

  try {
    await getInterAccessToken();
    return NextResponse.json({ connected: true });
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha na conexão com o Inter.",
      },
      { status: 503 },
    );
  }
}
