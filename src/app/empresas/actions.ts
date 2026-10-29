"use server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { requireRole } from "@/lib/auth-data";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type PrefeituraStatus } from "@/lib/prefeituras-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type PrefeituraActionState = {
  error?: string;
  success?: string;
};
type PrefeituraBrasaoUploadResult =
  | {
      brasao_path: string;
      brasao_url: string;
    }
  | {
      error: string;
    };

const allowedStatuses = new Set<PrefeituraStatus>([
  "active",
  "suspended",
  "expired",
  "cancelled",
]);
const prefeituraBrasaoBucket = "prefeituras-brasoes";
const maxPrefeituraBrasaoSize = 3 * 1024 * 1024;

export async function createPrefeitura(
  _previousState: PrefeituraActionState,
  formData: FormData,
): Promise<PrefeituraActionState> {
  await requireRole(["bdl_admin"]);
  const parsed = parseEmpresa(formData, true);
  if ("error" in parsed) return parsed;
  const supabase = createSupabaseServerClient();
  const id = randomUUID();
  const brasao = formData.get("brasao");
  let logo: { brasao_path: string; brasao_url: string } | undefined;
  if (
    brasao instanceof File &&
    brasao.size > 0 &&
    formData.get("remove_brasao") !== "true"
  ) {
    const uploaded = await uploadPrefeituraBrasao(supabase, id, brasao);
    if ("error" in uploaded) return uploaded;
    logo = uploaded;
  }
  const { error } = await supabase.from("empresas").insert({
    id,
    ...parsed.values,
    status: "active",
    ...logo,
  });
  if (error) {
    if (logo)
      await supabase.storage
        .from(prefeituraBrasaoBucket)
        .remove([logo.brasao_path]);
    return { error: formatSupabaseError(error.message) };
  }
  revalidatePath("/", "layout");
  revalidatePath("/empresas");
  return { success: "Empresa cadastrada com sucesso." };
}

export async function updatePrefeitura(
  _previousState: PrefeituraActionState,
  formData: FormData,
): Promise<PrefeituraActionState> {
  await requireRole(["bdl_admin"]);
  const id = getOptionalValue(formData, "id");
  if (!id) return { error: "Empresa não informada." };
  const parsed = parseEmpresa(formData);
  if ("error" in parsed) return parsed;
  const supabase = createSupabaseServerClient();
  // Read the stored path; never accept a storage deletion target from the form.
  const { data: current, error: readError } = await supabase
    .from("empresas")
    .select("brasao_path")
    .eq("id", id)
    .single();
  if (readError || !current)
    return {
      error:
        "Não foi possível carregar a empresa. Atualize a página e tente novamente.",
    };
  const brasao = formData.get("brasao");
  const remove = formData.get("remove_brasao") === "true";
  let logo:
    { brasao_path: string | null; brasao_url: string | null } | undefined;
  if (remove) {
    logo = { brasao_path: null, brasao_url: null };
  } else if (brasao instanceof File && brasao.size > 0) {
    const uploaded = await uploadPrefeituraBrasao(supabase, id, brasao);
    if ("error" in uploaded) return uploaded;
    logo = uploaded;
  }
  let query = supabase
    .from("empresas")
    .update({ ...parsed.values, ...logo })
    .eq("id", id);
  if (logo)
    query = current.brasao_path
      ? query.eq("brasao_path", current.brasao_path)
      : query.is("brasao_path", null);
  const { data, error } = await query.select("id");
  if (error || !data?.length) {
    if (logo?.brasao_path)
      await supabase.storage
        .from(prefeituraBrasaoBucket)
        .remove([logo.brasao_path]);
    return {
      error: error
        ? formatSupabaseError(error.message)
        : "O cadastro mudou durante a edição. Atualize a página e tente novamente.",
    };
  }
  // Only discard the previous image after the new reference has been saved.
  if (logo && current.brasao_path?.startsWith(`${id}/`)) {
    await supabase.storage
      .from(prefeituraBrasaoBucket)
      .remove([current.brasao_path]);
  }
  revalidatePath("/", "layout");
  revalidatePath("/empresas");
  return { success: "Empresa atualizada com sucesso." };
}

function parseEmpresa(formData: FormData, isCreating = false) {
  const nome = getOptionalValue(formData, "nome") ?? "";
  const nome_fantasia = getOptionalValue(formData, "nome_fantasia");
  const cnpj = getOptionalValue(formData, "cnpj") ?? "";
  const flag = formData.get("is_prefeitura");
  if (flag !== "true" && flag !== "false")
    return { error: "Informe se a empresa é uma prefeitura." };
  if (nome_fantasia && (nome_fantasia.length < 2 || nome_fantasia.length > 80))
    return { error: "Nome fantasia deve ter de 2 a 80 caracteres." };
  if (nome.length < 2 || cnpj.replace(/\D/g, "").length !== 14)
    return { error: "Informe o nome da empresa e um CNPJ com 14 dígitos." };
  const email_cobranca = getOptionalValue(formData, "email_cobranca");
  const telefone_cobranca = getOptionalValue(formData, "telefone_cobranca");
  if (email_cobranca && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_cobranca))
    return { error: "Informe um e-mail de cobrança válido." };
  if (telefone_cobranca && ![10, 11].includes(telefone_cobranca.replace(/\D/g, "").length))
    return { error: "Informe um telefone de cobrança válido." };
  if (isCreating && (!getOptionalValue(formData, "endereco_numero") || !getOptionalValue(formData, "bairro") || !email_cobranca))
    return { error: "Informe número, bairro e e-mail de cobrança." };
  return {
    values: {
      nome,
      nome_fantasia,
      cnpj,
      is_prefeitura: flag === "true",
      cidade: getOptionalValue(formData, "cidade"),
      uf: getOptionalValue(formData, "uf")?.toUpperCase(),
      cep: getOptionalValue(formData, "cep"),
      endereco: getOptionalValue(formData, "endereco"),
      endereco_numero: getOptionalValue(formData, "endereco_numero"),
      bairro: getOptionalValue(formData, "bairro"),
      endereco_complemento: getOptionalValue(formData, "endereco_complemento"),
      email_cobranca,
      telefone_cobranca,
    },
  };
}

export async function updatePrefeituraStatus(formData: FormData) {
  await requireRole(["bdl_admin"]);
  const id = getRequiredValue(formData, "id");
  const status = getRequiredValue(formData, "status") as PrefeituraStatus;

  if (!allowedStatuses.has(status)) {
    redirect("/empresas?error=Status%20inv%C3%A1lido");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("empresas")
    .update({ status })
    .eq("id", id);

  if (error) {
    redirect(`/empresas?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/empresas");
  redirect("/empresas?updated=1");
}

export async function deletePrefeitura(formData: FormData) {
  await requireRole(["bdl_admin"]);
  const id = getRequiredValue(formData, "id");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("empresas").delete().eq("id", id);

  if (error) {
    redirect(`/empresas?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/empresas");
  redirect("/empresas?deleted=1");
}

function getRequiredValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Campo obrigatorio: ${key}`);
  }

  return value.trim();
}

function getOptionalValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return value.trim();
}

async function uploadPrefeituraBrasao(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  prefeituraId: string,
  file: File,
): Promise<PrefeituraBrasaoUploadResult> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { error: "Envie uma imagem válida para o logotipo." };
  }

  if (file.size > maxPrefeituraBrasaoSize) {
    return { error: "O logotipo deve ter no máximo 3 MB." };
  }

  let image: Buffer;
  try {
    const source = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 25000000,
    });
    const metadata = await source.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
      return { error: "Formato de imagem inválido." };
    image = await source
      .rotate()
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return { error: "Não foi possível ler o logotipo. Escolha outra imagem." };
  }
  const bucketError = await ensurePrefeituraBrasaoBucket(supabase);
  if (bucketError) return { error: bucketError };
  const path = `${prefeituraId}/brasao-${randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from(prefeituraBrasaoBucket)
    .upload(path, image, {
      cacheControl: "3600",
      contentType: "image/webp",
      upsert: false,
    });

  if (uploadError) {
    return { error: formatSupabaseError(uploadError.message) };
  }

  const { data: publicUrlData } = supabase.storage
    .from(prefeituraBrasaoBucket)
    .getPublicUrl(path);

  return {
    brasao_path: path,
    brasao_url: publicUrlData.publicUrl,
  };
}

async function ensurePrefeituraBrasaoBucket(
  supabase: ReturnType<typeof createSupabaseServerClient>,
) {
  const { error } = await supabase.storage.createBucket(
    prefeituraBrasaoBucket,
    {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      fileSizeLimit: maxPrefeituraBrasaoSize,
      public: true,
    },
  );

  if (!error || error.message.toLowerCase().includes("already exists")) {
    return null;
  }

  return formatSupabaseError(error.message);
}

function formatSupabaseError(message: string) {
  if (
    message.includes("duplicate key") ||
    message.includes("prefeituras_cnpj_key") ||
    message.includes("unique")
  ) {
    return "Já existe uma empresa cadastrada com este CNPJ.";
  }

  return message;
}
