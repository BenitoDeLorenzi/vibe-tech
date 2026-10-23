import { createSupabaseServerClient } from "@/lib/supabase-server";

export const CONTACT_EMAIL_IN_USE =
  "Este e-mail já está vinculado a outra conta. Informe outro endereço ou procure o Master.";

export function isContactEmailUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

export async function isContactEmailInUse(email: string, userId: string) {
  // Escape LIKE metacharacters so addresses containing underscores remain exact matches.
  const pattern = email.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await createSupabaseServerClient()
    .from("perfis")
    .select("id")
    .ilike("email_contato", pattern)
    .is("excluido_em", null)
    .neq("id", userId)
    .limit(1);

  if (error) throw new Error("Não foi possível verificar a disponibilidade do e-mail.");
  return Boolean(data?.length);
}
