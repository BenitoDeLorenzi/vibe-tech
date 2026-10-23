"use server";

import { validateVehicleSecretaria } from "@/lib/secretarias-data";
import { updatePostoStatus } from "./cadastro-actions";
import { pbkdf2Sync, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUserProfile, requireUserProfile } from "@/lib/auth-data";
import { type FrotaAbastecimento, type VeiculoStatus } from "@/lib/frotas-data";
import { hasFrotasPermission } from "@/lib/frotas-permissions";
import { getPostoSession } from "@/lib/posto-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type FrotaActionState = {
  abastecimento?: FrotaAbastecimento;
  error?: string;
  success?: string;
  temporaryPassword?: string;
};

const allowedStatuses = new Set<VeiculoStatus>([
  "active",
  "maintenance",
  "inactive",
]);
const vehiclePhotoBucket = "frota-veiculos";
const vehicleAttachmentBucket = "frota-veiculo-anexos";
const maxVehiclePhotoSize = 5 * 1024 * 1024;
const maintenanceAttachmentBucket = "frota-manutencao";
const fuelAttachmentBucket = "frota-abastecimento";
const maxMaintenanceAttachmentSize = 10 * 1024 * 1024;

export async function createVeiculo(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("vehicles.create");

  if (permissionError) {
    return { error: permissionError };
  }

  const payload = getVeiculoPayload(formData);

  if ("error" in payload) {
    return payload;
  }

  const secretaria = await validateVehicleSecretaria(
    await requireUserProfile(),
    payload.veiculo.prefeitura_id,
    formData.get("secretaria_id"),
  );
  if ("error" in secretaria) return { error: secretaria.error };
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("frota_veiculos")
    .insert({ ...payload.veiculo, ...secretaria })
    .select("id")
    .single();

  if (error || !data) {
    return {
      error: formatSupabaseError(error?.message ?? "Veículo não criado."),
    };
  }

  revalidatePath("/frotas");
  return { success: "Veículo cadastrado com sucesso." };
}

export async function updateVeiculo(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("vehicles.update");

  if (permissionError) {
    return { error: permissionError };
  }

  const id = getRequiredValue(formData, "id");

  if (!id) {
    return { error: "Veículo não encontrado." };
  }

  const payload = getVeiculoPayload(formData);

  if ("error" in payload) {
    return payload;
  }

  const supabase = createSupabaseServerClient();
  const currentVehicle = await supabase
    .from("frota_veiculos")
    .select("id,status,prefeitura_id")
    .eq("id", id)
    .maybeSingle();
  if (currentVehicle.error || !currentVehicle.data)
    return { error: "Veículo não encontrado." };
  const profile = await requireUserProfile();
  if (
    profile.role !== "bdl_admin" &&
    (currentVehicle.data.prefeitura_id !== profile.prefeitura_id ||
      payload.veiculo.prefeitura_id !== profile.prefeitura_id)
  ) {
    return { error: "Você não tem acesso ao veículo desta empresa." };
  }
  if (currentVehicle.data.status === "processing") {
    return {
      error: "Aguarde o retorno da consulta antes de concluir o cadastro.",
    };
  }
  if (payload.veiculo.prefeitura_id !== currentVehicle.data.prefeitura_id)
    return {
      error: "A empresa do veículo não pode ser alterada neste formulário.",
    };
  const secretaria = await validateVehicleSecretaria(
    profile,
    currentVehicle.data.prefeitura_id,
    formData.get("secretaria_id"),
  );
  if ("error" in secretaria) return { error: secretaria.error };
  const { error } = await supabase
    .from("frota_veiculos")
    .update({ ...payload.veiculo, ...secretaria })
    .eq("id", id)
    .neq("status", "processing");

  if (error) {
    return { error: formatSupabaseError(error.message) };
  }

  revalidatePath("/frotas");
  return { success: "Veículo atualizado com sucesso." };
}

export async function deleteVeiculo(formData: FormData) {
  const profile = await requireUserProfile();
  if (profile.role !== "bdl_admin") {
    redirect(
      `/frotas/veiculos?error=${encodeURIComponent("Somente o usuário Master pode excluir veículos.")}`,
    );
  }
  const permissionError = await requireFrotasPermission("vehicles.delete");

  if (permissionError) {
    redirect(`/frotas/veiculos?error=${encodeURIComponent(permissionError)}`);
  }

  const id = getRequiredValue(formData, "id");
  const supabase = createSupabaseServerClient();

  const [veiculoResult, veiculoAnexosResult, manutencaoAnexosResult] =
    await Promise.all([
      supabase
        .from("frota_veiculos")
        .select("id,foto_path,status")
        .eq("id", id)
        .single(),
      supabase
        .from("frota_veiculo_anexos")
        .select("file_path")
        .eq("veiculo_id", id),
      supabase
        .from("frota_manutencao_anexos")
        .select("file_path")
        .eq("veiculo_id", id),
    ]);

  if (veiculoResult.error || !veiculoResult.data) {
    redirect(
      `/frotas/veiculos?error=${encodeURIComponent(
        formatSupabaseError(
          veiculoResult.error?.message ?? "Veículo não encontrado.",
        ),
      )}`,
    );
  }

  if (veiculoAnexosResult.error) {
    redirect(
      `/frotas/veiculos?error=${encodeURIComponent(
        formatSupabaseError(veiculoAnexosResult.error.message),
      )}`,
    );
  }

  if (manutencaoAnexosResult.error) {
    redirect(
      `/frotas/veiculos?error=${encodeURIComponent(
        formatSupabaseError(manutencaoAnexosResult.error.message),
      )}`,
    );
  }

  if (veiculoResult.data.foto_path) {
    const { error: photoError } = await supabase.storage
      .from(vehiclePhotoBucket)
      .remove([veiculoResult.data.foto_path]);

    if (photoError) {
      redirect(
        `/frotas/veiculos?error=${encodeURIComponent(
          formatSupabaseError(photoError.message),
        )}`,
      );
    }
  }

  const veiculoAttachmentPaths = (veiculoAnexosResult.data ?? [])
    .map((anexo) => anexo.file_path)
    .filter(Boolean);

  if (veiculoAttachmentPaths.length) {
    const { error: vehicleAttachmentsError } = await supabase.storage
      .from(vehicleAttachmentBucket)
      .remove(veiculoAttachmentPaths);

    if (vehicleAttachmentsError) {
      redirect(
        `/frotas/veiculos?error=${encodeURIComponent(
          formatSupabaseError(vehicleAttachmentsError.message),
        )}`,
      );
    }
  }

  const manutencaoAttachmentPaths = (manutencaoAnexosResult.data ?? [])
    .map((anexo) => anexo.file_path)
    .filter(Boolean);

  if (manutencaoAttachmentPaths.length) {
    const { error: maintenanceAttachmentsError } = await supabase.storage
      .from(maintenanceAttachmentBucket)
      .remove(manutencaoAttachmentPaths);

    if (maintenanceAttachmentsError) {
      redirect(
        `/frotas/veiculos?error=${encodeURIComponent(
          formatSupabaseError(maintenanceAttachmentsError.message),
        )}`,
      );
    }
  }

  const { error } = await supabase.from("frota_veiculos").delete().eq("id", id);

  if (error) {
    redirect(
      `/frotas/veiculos?error=${encodeURIComponent(
        formatSupabaseError(error.message),
      )}`,
    );
  }

  revalidatePath("/frotas/veiculos");
  revalidatePath("/frotas/manutencao");
  redirect("/frotas/veiculos?deleted=1");
}

export async function uploadVeiculoFoto(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("vehicles.update");

  if (permissionError) {
    return { error: permissionError };
  }

  const id = getRequiredValue(formData, "id");
  const prefeituraId = getRequiredValue(formData, "prefeitura_id");
  const placa = normalizePlate(getRequiredValue(formData, "placa"));
  const file = formData.get("foto");

  if (!id || !prefeituraId || !placa) {
    return { error: "Veículo não encontrado." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione uma foto do veículo." };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "Envie um arquivo de imagem válido." };
  }

  if (file.size > maxVehiclePhotoSize) {
    return { error: "A foto deve ter no máximo 5 MB." };
  }

  const supabase = createSupabaseServerClient();
  const bucketError = await ensureVehiclePhotoBucket(supabase);

  if (bucketError) {
    return { error: bucketError };
  }

  const extension = getImageExtension(file);
  const path = `${prefeituraId}/${id}/${placa}-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(vehiclePhotoBucket)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return { error: formatSupabaseError(uploadError.message) };
  }

  const { data: publicUrlData } = supabase.storage
    .from(vehiclePhotoBucket)
    .getPublicUrl(path);
  const { error } = await supabase
    .from("frota_veiculos")
    .update({
      foto_path: path,
      foto_url: publicUrlData.publicUrl,
    })
    .eq("id", id);

  if (error) {
    return { error: formatSupabaseError(error.message) };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  return { success: "Foto do veículo atualizada com sucesso." };
}

export async function removeVeiculoFoto(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("vehicles.update");

  if (permissionError) {
    return { error: permissionError };
  }

  const id = getRequiredValue(formData, "id");
  const path = getOptionalValue(formData, "foto_path");

  if (!id) {
    return { error: "Veículo não encontrado." };
  }

  const supabase = createSupabaseServerClient();

  if (path) {
    const { error: storageError } = await supabase.storage
      .from(vehiclePhotoBucket)
      .remove([path]);

    if (storageError) {
      return { error: formatSupabaseError(storageError.message) };
    }
  }

  const { error } = await supabase
    .from("frota_veiculos")
    .update({
      foto_path: null,
      foto_url: null,
    })
    .eq("id", id);

  if (error) {
    return { error: formatSupabaseError(error.message) };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  return { success: "Foto removida com sucesso." };
}

export async function addVeiculoAnexos(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("vehicles.update");

  if (permissionError) {
    return { error: permissionError };
  }

  const id = getRequiredValue(formData, "id");
  const hasFiles = hasAttachmentFiles(formData);

  if (!id) {
    return { error: "Veículo não encontrado." };
  }

  if (!hasFiles) {
    return { error: "Selecione ao menos um documento para anexar." };
  }

  const supabase = createSupabaseServerClient();
  const { data: veiculo, error: veiculoError } = await supabase
    .from("frota_veiculos")
    .select("id,prefeitura_id")
    .eq("id", id)
    .single();

  if (veiculoError || !veiculo) {
    return {
      error: formatSupabaseError(
        veiculoError?.message ?? "Veículo não encontrado.",
      ),
    };
  }

  const attachmentError = await uploadVehicleAttachments({
    formData,
    prefeituraId: veiculo.prefeitura_id,
    supabase,
    veiculoId: veiculo.id,
  });

  if (attachmentError) {
    return { error: attachmentError };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  return { success: "Documento anexado com sucesso." };
}

export async function deleteVeiculoAnexo(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("vehicles.update");

  if (permissionError) {
    return { error: permissionError };
  }

  const id = getRequiredValue(formData, "id");

  if (!id) {
    return { error: "Documento não encontrado." };
  }

  const supabase = createSupabaseServerClient();
  const { data: anexo, error: anexoError } = await supabase
    .from("frota_veiculo_anexos")
    .select("id,file_path")
    .eq("id", id)
    .single();

  if (anexoError || !anexo) {
    return {
      error: formatSupabaseError(
        anexoError?.message ?? "Documento não encontrado.",
      ),
    };
  }

  const { error: storageError } = await supabase.storage
    .from(vehicleAttachmentBucket)
    .remove([anexo.file_path]);

  if (storageError) {
    return { error: formatSupabaseError(storageError.message) };
  }

  const { error } = await supabase
    .from("frota_veiculo_anexos")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: formatSupabaseError(error.message) };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  return { success: "Documento removido com sucesso." };
}

export async function updateVeiculoStatus(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("vehicles.manage");

  if (permissionError) {
    return { error: permissionError };
  }

  const id = getRequiredValue(formData, "id");
  const status = getRequiredValue(formData, "status") as VeiculoStatus;

  if (!id) {
    return { error: "Veículo não encontrado." };
  }

  if (!allowedStatuses.has(status)) {
    return { error: "Status inválido." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("frota_veiculos")
    .update({ status })
    .eq("id", id);

  if (error) {
    return { error: formatSupabaseError(error.message) };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  return { success: "Status do veículo atualizado com sucesso." };
}

export async function registrarPagamentoVencimento(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("expirations.manage");

  if (permissionError) {
    return { error: permissionError };
  }

  const id = getRequiredValue(formData, "id");
  const dataPagamento = getRequiredValue(formData, "data_pagamento");
  const formaPagamento = getRequiredValue(formData, "forma_pagamento");
  const observacoes = getOptionalValue(formData, "observacoes");
  const quantidadeParcelas = Number(
    getRequiredValue(formData, "quantidade_parcelas"),
  );
  const parcelasPagas = Number(getRequiredValue(formData, "parcelas_pagas"));
  const valorTotal = parseCurrencyValue(
    getRequiredValue(formData, "valor_total"),
  );

  if (!id) {
    return { error: "Débito não encontrado." };
  }

  if (!dataPagamento) {
    return { error: "Informe a data do pagamento." };
  }

  if (!valorTotal || valorTotal <= 0) {
    return { error: "Informe o valor total do pagamento." };
  }

  if (!["cota_unica", "parcelado"].includes(formaPagamento)) {
    return { error: "Informe a forma de pagamento." };
  }

  if (
    !Number.isInteger(quantidadeParcelas) ||
    quantidadeParcelas < 1 ||
    quantidadeParcelas > 12
  ) {
    return { error: "Informe uma quantidade de parcelas entre 1 e 12." };
  }

  if (
    !Number.isInteger(parcelasPagas) ||
    parcelasPagas < 1 ||
    parcelasPagas > quantidadeParcelas
  ) {
    return { error: "Informe ao menos uma parcela paga." };
  }

  if (formaPagamento === "cota_unica" && quantidadeParcelas !== 1) {
    return { error: "Cota única deve ter apenas uma parcela." };
  }

  const supabase = createSupabaseServerClient();
  const { data: vencimento, error: vencimentoError } = await supabase
    .from("frota_vencimentos")
    .select("id,prefeitura_id,veiculo_id,tipo,data_vencimento")
    .eq("id", id)
    .single();

  if (vencimentoError || !vencimento) {
    return {
      error: formatSupabaseError(
        vencimentoError?.message ?? "Débito não encontrado.",
      ),
    };
  }

  if (vencimento.tipo !== "ipva" && formaPagamento !== "cota_unica") {
    return {
      error:
        "Somente o IPVA pode ser parcelado. Licenciamento e Seguro devem ser registrados em cota única.",
    };
  }

  if (vencimento.tipo !== "ipva" && quantidadeParcelas !== 1) {
    return {
      error: "Licenciamento e Seguro devem ter apenas uma parcela.",
    };
  }

  const nextDate = addOneYearIsoDate(vencimento.data_vencimento);
  const status = parcelasPagas === quantidadeParcelas ? "paid" : "partial";
  const { data: pagamento, error: pagamentoError } = await supabase
    .from("frota_vencimento_pagamentos")
    .insert({
      data_pagamento: dataPagamento,
      data_vencimento_pago: vencimento.data_vencimento,
      exercicio: Number(vencimento.data_vencimento.slice(0, 4)),
      forma_pagamento: formaPagamento,
      observacoes,
      parcelas_pagas: parcelasPagas,
      prefeitura_id: vencimento.prefeitura_id,
      proximo_vencimento: nextDate,
      quantidade_parcelas: quantidadeParcelas,
      status,
      tipo: vencimento.tipo,
      valor_total: valorTotal,
      veiculo_id: vencimento.veiculo_id,
      vencimento_id: vencimento.id,
    })
    .select("id")
    .single();

  if (pagamentoError || !pagamento) {
    return {
      error: formatSupabaseError(
        pagamentoError?.message ?? "Pagamento não registrado.",
      ),
    };
  }

  const parcelas = buildPaymentInstallments({
    dataPagamento,
    dataVencimento: vencimento.data_vencimento,
    pagamentoId: pagamento.id,
    parcelasPagas,
    quantidadeParcelas,
    valorTotal,
  });
  const { error: parcelasError } = await supabase
    .from("frota_vencimento_pagamento_parcelas")
    .insert(parcelas);

  if (parcelasError) {
    return { error: formatSupabaseError(parcelasError.message) };
  }

  if (status === "paid") {
    const { error } = await supabase
      .from("frota_vencimentos")
      .update({
        data_vencimento: nextDate,
        status: "pending",
      })
      .eq("id", id);

    if (error) {
      return { error: formatSupabaseError(error.message) };
    }
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  return {
    success:
      status === "paid"
        ? "Pagamento quitado e débito renovado com sucesso."
        : "Pagamento parcial registrado com sucesso.",
  };
}

export async function updateVencimentoData(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("expirations.manage");

  if (permissionError) {
    return { error: permissionError };
  }

  const id = getRequiredValue(formData, "id");
  const dataVencimento = getRequiredValue(formData, "data_vencimento");

  if (!id || !dataVencimento) {
    return { error: "Informe a data do débito." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("frota_vencimentos")
    .update({
      data_vencimento: dataVencimento,
      status: "pending",
    })
    .eq("id", id);

  if (error) {
    return { error: formatSupabaseError(error.message) };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  return { success: "Débito atualizado com sucesso." };
}

export async function createDebitoManual(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("expirations.manage");

  if (permissionError) {
    return { error: permissionError };
  }

  const veiculoId = getRequiredValue(formData, "veiculo_id");
  const tipo = getRequiredValue(formData, "tipo");
  const dataVencimento = getRequiredValue(formData, "data_vencimento");
  const descricao = getOptionalValue(formData, "descricao");
  const valor = parseCurrencyValue(getOptionalValue(formData, "valor") ?? "");

  if (!veiculoId || !tipo || !dataVencimento) {
    return { error: "Preencha os campos obrigatórios do débito." };
  }

  if (!["seguro", "ipva", "licenciamento"].includes(tipo)) {
    return { error: "Tipo de débito inválido." };
  }

  const supabase = createSupabaseServerClient();
  const { data: veiculo, error: veiculoError } = await supabase
    .from("frota_veiculos")
    .select("id,prefeitura_id")
    .eq("id", veiculoId)
    .single();

  if (veiculoError || !veiculo) {
    return {
      error: formatSupabaseError(
        veiculoError?.message ?? "Veículo não encontrado.",
      ),
    };
  }

  const { error } = await supabase.from("frota_vencimentos").insert({
    data_vencimento: dataVencimento,
    descricao,
    origem: "manual",
    prefeitura_id: veiculo.prefeitura_id,
    status: "pending",
    tipo,
    valor: valor || null,
    veiculo_id: veiculo.id,
  });

  if (error) {
    return { error: formatSupabaseError(error.message) };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  revalidatePath(`/frotas/veiculos/${veiculo.id}`);
  revalidatePath(`/frotas/veiculos/${veiculo.id}/debitos`);
  return { success: "Débito cadastrado com sucesso." };
}

export async function createMultaManual(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("vehicles.manage");

  if (permissionError) {
    return { error: permissionError };
  }

  const veiculoId = getRequiredValue(formData, "veiculo_id");
  const numeroAuto = getRequiredValue(formData, "numero_auto").toUpperCase();
  const situacao = getOptionalValue(formData, "situacao");
  const descricao = getRequiredValue(formData, "descricao").toUpperCase();
  const dataInfracao = parseBrazilianDate(getRequiredValue(formData, "data"));
  const hora = getOptionalValue(formData, "hora");
  const localComplemento = getOptionalValue(
    formData,
    "local_complemento",
  )?.toUpperCase();
  const valor = parseCurrencyValue(getOptionalValue(formData, "valor") ?? "");

  if (!veiculoId || !numeroAuto || !descricao || !dataInfracao) {
    return { error: "Preencha os campos obrigatórios da multa." };
  }

  if (dataInfracao === "invalid") {
    return { error: "Informe a data da infração no formato dd/MM/yyyy." };
  }

  if (hora && !/^\d{2}:\d{2}$/.test(hora)) {
    return { error: "Informe a hora no formato HH:mm." };
  }

  const supabase = createSupabaseServerClient();
  const { data: veiculo, error: veiculoError } = await supabase
    .from("frota_veiculos")
    .select("id,prefeitura_id")
    .eq("id", veiculoId)
    .single();

  if (veiculoError || !veiculo) {
    return {
      error: formatSupabaseError(
        veiculoError?.message ?? "Veículo não encontrado.",
      ),
    };
  }

  const { data: existingMulta, error: existingMultaError } = await supabase
    .from("frota_multas_veiculares")
    .select("id")
    .eq("veiculo_id", veiculo.id)
    .eq("origem", "manual")
    .eq("numero_auto", numeroAuto)
    .maybeSingle();

  if (existingMultaError) {
    return { error: formatSupabaseError(existingMultaError.message) };
  }

  if (existingMulta) {
    return {
      error: "Já existe uma multa manual cadastrada com este número de auto.",
    };
  }

  const { error } = await supabase.from("frota_multas_veiculares").insert({
    data_infracao: dataInfracao,
    descricao,
    hora,
    local_complemento: localComplemento,
    numero_auto: numeroAuto,
    origem: "manual",
    prefeitura_id: veiculo.prefeitura_id,
    raw_payload: {
      data: dataInfracao,
      descricao,
      hora,
      localComplemento,
      numeroAuto,
      situacao,
      valor,
    },
    situacao,
    valor,
    veiculo_id: veiculo.id,
  });

  if (error) {
    return { error: formatSupabaseError(error.message) };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  revalidatePath(`/frotas/veiculos/${veiculo.id}`);
  return { success: "Multa cadastrada com sucesso." };
}

export async function createAbastecimento(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("fuel.create");

  if (permissionError) {
    return { error: permissionError };
  }

  const veiculoId = getRequiredValue(formData, "veiculo_id");
  const dataAbastecimento = getRequiredValue(formData, "data_abastecimento");
  const motorista = getRequiredValue(formData, "motorista");
  const postoId = getRequiredValue(formData, "posto_id");
  const profile = await requireUserProfile();
  const emitidoPor = profile.nome;
  const combustivel = getRequiredValue(formData, "combustivel");
  const arlaIncluso = getOptionalValue(formData, "arla_incluso") === "true";
  const observacoes = getOptionalValue(formData, "observacoes");

  if (
    !veiculoId ||
    !dataAbastecimento ||
    !motorista ||
    !postoId ||
    !emitidoPor ||
    !combustivel
  ) {
    return { error: "Preencha os campos obrigatórios da ordem." };
  }

  const supabase = createSupabaseServerClient();
  const { data: veiculo, error: veiculoError } = await supabase
    .from("frota_veiculos")
    .select("id,prefeitura_id,combustivel")
    .eq("id", veiculoId)
    .single();

  if (veiculoError || !veiculo) {
    return {
      error: formatSupabaseError(
        veiculoError?.message ?? "Veículo não encontrado.",
      ),
    };
  }

  if (
    profile.role !== "bdl_admin" &&
    veiculo.prefeitura_id !== profile.prefeitura_id
  ) {
    return { error: "Este veículo não pertence à sua empresa." };
  }

  const { data: posto, error: postoError } = await supabase
    .from("frota_postos_credenciados")
    .select("id,nome,prefeitura_id,status")
    .eq("id", postoId)
    .single();

  if (postoError || !posto) {
    return {
      error: formatSupabaseError(
        postoError?.message ?? "Posto não encontrado.",
      ),
    };
  }

  if (
    posto.prefeitura_id !== veiculo.prefeitura_id ||
    posto.status !== "active"
  ) {
    return { error: "Selecione um posto credenciado ativo da empresa." };
  }

  if (arlaIncluso && !isDieselFuel(combustivel)) {
    return { error: "ARLA só pode ser autorizado para veículos a diesel." };
  }

  const now = new Date();
  await expireIssuedOrdersForVehicle(supabase, veiculo.id, now.toISOString());

  const { data: pendingOrder, error: pendingOrderError } = await supabase
    .from("frota_abastecimentos")
    .select("id,numero_ordem,expires_at")
    .eq("veiculo_id", veiculo.id)
    .eq("status", "issued")
    .maybeSingle();

  if (pendingOrderError) {
    return { error: formatSupabaseError(pendingOrderError.message) };
  }

  if (pendingOrder) {
    return {
      error: `Este veículo já possui a ordem ${pendingOrder.numero_ordem} pendente. Reimprima ou cancele a ordem existente antes de emitir outra.`,
    };
  }

  let numeroOrdem: string;
  try {
    numeroOrdem = await generateFuelOrderNumber(supabase);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o número da ordem.",
    };
  }
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const { data: createdOrder, error } = await supabase
    .from("frota_abastecimentos")
    .insert({
      combustivel,
      arla_incluso: arlaIncluso,
      data_abastecimento: dataAbastecimento,
      emitido_por: emitidoPor,
      atividade_usuario_id: profile.id,
      expires_at: expiresAt,
      fornecedor: posto.nome,
      litros: null,
      motorista,
      numero_ordem: numeroOrdem,
      observacoes,
      posto_id: posto.id,
      prefeitura_id: veiculo.prefeitura_id,
      quilometragem: null,
      status: "issued",
      valor_litro: null,
      valor_total: null,
      veiculo_id: veiculo.id,
    })
    .select("id")
    .single();

  if (error || !createdOrder) {
    return {
      error: formatSupabaseError(error?.message ?? "Ordem não emitida."),
    };
  }

  let abastecimento: FrotaAbastecimento;

  try {
    abastecimento = await getAbastecimentoForPrint(createdOrder.id);
  } catch (fetchError) {
    return {
      error:
        fetchError instanceof Error
          ? fetchError.message
          : "Ordem emitida, mas não foi possível preparar a impressão.",
    };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  revalidatePath("/frotas/abastecimento");
  return {
    abastecimento,
    success: "Ordem de abastecimento emitida com sucesso.",
  };
}

export async function completeAbastecimento(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  return completeAbastecimentoForSource(formData, "administracao");
}

export async function completeAbastecimentoPosto(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  return completeAbastecimentoForSource(formData, "posto");
}

async function completeAbastecimentoForSource(
  formData: FormData,
  source: "administracao" | "posto",
): Promise<FrotaActionState> {
  const id = getRequiredValue(formData, "id");
  const actor = await resolveFuelCompletionActor(id, source);
  if ("error" in actor) return { error: actor.error };

  const quilometragemValue = getRequiredValue(formData, "quilometragem");
  const quilometragem = Number(quilometragemValue);
  const litros = parseDecimalValue(getRequiredValue(formData, "litros"));
  const valorLitro = parseCurrencyValue(
    getRequiredValue(formData, "valor_litro"),
  );
  const valorCombustivelInput = parseCurrencyValue(
    getRequiredValue(formData, "valor_total"),
  );
  const arlaLitros = parseDecimalValue(
    getOptionalValue(formData, "arla_litros") ?? "",
  );
  const arlaValorLitro = parseCurrencyValue(
    getOptionalValue(formData, "arla_valor_litro") ?? "",
  );
  const arlaValorTotalInput = parseCurrencyValue(
    getOptionalValue(formData, "arla_valor_total") ?? "",
  );
  const concluidoPor = getRequiredValue(formData, "concluido_por");
  const numeroNotaFiscal = getOptionalValue(formData, "numero_nota_fiscal");
  const hasFiles = hasAttachmentFiles(formData);
  const valorCombustivel =
    valorCombustivelInput || (litros && valorLitro ? litros * valorLitro : 0);

  if (
    !id ||
    !quilometragemValue ||
    !Number.isFinite(quilometragem) ||
    !litros ||
    !valorLitro ||
    !valorCombustivel ||
    !concluidoPor
  ) {
    return { error: "Preencha os dados reais do abastecimento." };
  }

  if (quilometragem < 0) {
    return { error: "Informe uma quilometragem válida." };
  }

  const supabase = createSupabaseServerClient();
  const { data: abastecimento, error: abastecimentoError } = await supabase
    .from("frota_abastecimentos")
    .select("id,prefeitura_id,veiculo_id,status,expires_at,arla_incluso")
    .eq("id", id)
    .single();

  if (abastecimentoError || !abastecimento) {
    return {
      error: formatSupabaseError(
        abastecimentoError?.message ?? "Ordem não encontrada.",
      ),
    };
  }

  if (abastecimento.status !== "issued") {
    return { error: "Somente ordens pendentes podem ser concluídas." };
  }

  if (isExpiredAt(abastecimento.expires_at)) {
    await markAbastecimentoAsExpired(supabase, abastecimento.id);
    revalidatePath("/frotas/abastecimento");
    return {
      error:
        "Esta ordem venceu. Emita uma nova ordem de abastecimento para o veículo.",
    };
  }

  if (abastecimento.arla_incluso && (!arlaLitros || !arlaValorLitro)) {
    return { error: "Informe os litros e o valor por litro do ARLA." };
  }

  if (!abastecimento.arla_incluso && (arlaLitros || arlaValorLitro)) {
    return { error: "Esta ordem não autoriza lançamento de ARLA." };
  }

  const arlaValorTotal =
    arlaValorTotalInput ||
    (arlaLitros && arlaValorLitro ? arlaLitros * arlaValorLitro : 0);
  const valorTotal = valorCombustivel + arlaValorTotal;

  const { data: veiculo, error: veiculoError } = await supabase
    .from("frota_veiculos")
    .select("id,quilometragem")
    .eq("id", abastecimento.veiculo_id)
    .single();

  if (veiculoError || !veiculo) {
    return {
      error: formatSupabaseError(
        veiculoError?.message ?? "Veículo não encontrado.",
      ),
    };
  }

  if (veiculo.quilometragem && quilometragem < veiculo.quilometragem) {
    return {
      error:
        "A quilometragem informada não pode ser menor que a quilometragem atual do veículo.",
    };
  }

  const completionAt = new Date().toISOString();
  const { data: completedOrder, error } = await supabase
    .from("frota_abastecimentos")
    .update({
      completed_at: completionAt,
      concluido_por: concluidoPor,
      atividade_por: actor.nome,
      atividade_usuario_id: actor.usuarioId,
      litros,
      numero_nota_fiscal: numeroNotaFiscal,
      quilometragem,
      status: "completed",
      updated_at: completionAt,
      arla_litros: abastecimento.arla_incluso ? arlaLitros : null,
      arla_valor_litro: abastecimento.arla_incluso ? arlaValorLitro : null,
      arla_valor_total: abastecimento.arla_incluso ? arlaValorTotal : null,
      valor_litro: valorLitro,
      valor_total: valorTotal,
    })
    .eq("id", id)
    .eq("status", "issued")
    .gt("expires_at", completionAt)
    .select("id")
    .maybeSingle();

  if (error || !completedOrder) {
    if (isExpiredAt(abastecimento.expires_at)) {
      await markAbastecimentoAsExpired(supabase, abastecimento.id);
      revalidatePath("/frotas/abastecimento");
      return {
        error: "Esta ordem venceu. Emita uma nova ordem de abastecimento para o veículo.",
      };
    }
    return {
      error: formatSupabaseError(
        error?.message ?? "A ordem não está mais disponível para conclusão.",
      ),
    };
  }

  if (hasFiles) {
    const attachmentError = await uploadFuelAttachments({
      abastecimentoId: abastecimento.id,
      formData,
      prefeituraId: abastecimento.prefeitura_id,
      supabase,
      veiculoId: abastecimento.veiculo_id,
    });

    if (attachmentError) {
      return { error: attachmentError };
    }
  }

  if (!veiculo.quilometragem || quilometragem > veiculo.quilometragem) {
    await supabase
      .from("frota_veiculos")
      .update({ quilometragem })
      .eq("id", veiculo.id);
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  revalidatePath("/frotas/abastecimento");
  revalidatePath("/frotas/posto");
  return { success: "Abastecimento concluído com sucesso." };
}

export async function cancelAbastecimento(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("fuel.cancel");

  if (permissionError) {
    return { error: permissionError };
  }

  const id = getRequiredValue(formData, "id");
  const motivoCancelamento = getRequiredValue(formData, "motivo_cancelamento");

  if (!id || motivoCancelamento.length < 8) {
    return { error: "Descreva o motivo com pelo menos 8 caracteres." };
  }

  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();
  const { data: abastecimento, error: abastecimentoError } = await supabase
    .from("frota_abastecimentos")
    .select("id,prefeitura_id,status,expires_at")
    .eq("id", id)
    .single();

  if (abastecimentoError || !abastecimento) {
    return {
      error: formatSupabaseError(
        abastecimentoError?.message ?? "Ordem não encontrada.",
      ),
    };
  }

  if (
    profile.role !== "bdl_admin" &&
    abastecimento.prefeitura_id !== profile.prefeitura_id
  ) {
    return { error: "Este registro não pertence à sua empresa." };
  }

  if (
    abastecimento.status !== "issued" ||
    isExpiredAt(abastecimento.expires_at)
  ) {
    if (abastecimento.status === "issued") {
      await markAbastecimentoAsExpired(supabase, abastecimento.id);
      revalidatePath("/frotas/abastecimento");
    }

    return { error: "Somente ordens pendentes podem ser canceladas." };
  }

  const { data: cancelled, error } = await supabase
    .from("frota_abastecimentos")
    .update({
      cancelled_at: new Date().toISOString(),
      atividade_por: profile.nome,
      atividade_usuario_id: profile.id,
      motivo_cancelamento: motivoCancelamento,
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("prefeitura_id", abastecimento.prefeitura_id)
    .eq("status", "issued")
    .select("id")
    .maybeSingle();

  if (error || !cancelled) {
    return {
      error: error
        ? formatSupabaseError(error.message)
        : "Atualize a lista e tente novamente.",
    };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  revalidatePath("/frotas/abastecimento");
  return { success: "Ordem de abastecimento cancelada com sucesso." };
}

export async function registerAbastecimentoPrint(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("fuel.manage");

  if (permissionError) {
    return { error: permissionError };
  }

  const id = getRequiredValue(formData, "id");

  if (!id) {
    return { error: "Ordem não encontrada." };
  }

  const supabase = createSupabaseServerClient();
  const { data: abastecimento, error: abastecimentoError } = await supabase
    .from("frota_abastecimentos")
    .select("id,status,print_count,expires_at")
    .eq("id", id)
    .single();

  if (abastecimentoError || !abastecimento) {
    return {
      error: formatSupabaseError(
        abastecimentoError?.message ?? "Ordem não encontrada.",
      ),
    };
  }

  if (abastecimento.status !== "issued") {
    return { error: "Somente ordens pendentes podem ser impressas." };
  }

  if (isExpiredAt(abastecimento.expires_at)) {
    await markAbastecimentoAsExpired(supabase, abastecimento.id);
    revalidatePath("/frotas/abastecimento");
    return {
      error:
        "Esta ordem venceu. Emita uma nova ordem de abastecimento para o veículo.",
    };
  }

  const { error } = await supabase
    .from("frota_abastecimentos")
    .update({
      last_printed_at: new Date().toISOString(),
      print_count: (abastecimento.print_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { error: formatSupabaseError(error.message) };
  }

  revalidatePath("/frotas/abastecimento");
  return { success: "Impressão registrada com sucesso." };
}

export async function createPostoCredenciado(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("fuel_stations.manage");
  if (permissionError) return { error: permissionError };
  const profile = await requireUserProfile();
  const prefeituraId = profile.role === "bdl_admin" ? getRequiredValue(formData, "prefeitura_id") : profile.prefeitura_id;
  const nome = getRequiredValue(formData, "nome");
  const cnpj = getRequiredValue(formData, "cnpj").replace(/\D/g, "");
  const senha = randomBytes(12).toString("base64url");
  const telefone = getOptionalValue(formData, "telefone");

  if (!prefeituraId || !nome || !cnpj) {
    return { error: "Informe empresa, nome e CNPJ do posto." };
  }

  if (cnpj.length !== 14) {
    return { error: "Informe um CNPJ válido para o posto." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("frota_postos_credenciados").insert({
    cnpj,
    endereco: null,
    nome,
    prefeitura_id: prefeituraId,
    senha_hash: hashPassword(senha),
    status: "active",
    telefone,
  });

  if (error) {
    return { error: formatSupabaseError(error.message) };
  }

  revalidatePath("/frotas/abastecimento");
  revalidatePath("/frotas/postos");
  return { success: "Posto cadastrado. Entregue a senha provisória ao responsável pelo posto.", temporaryPassword: senha };
}

export async function updatePostoCredenciado(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("fuel_stations.manage");
  if (permissionError) return { error: permissionError };
  const profile = await requireUserProfile();
  const id = getRequiredValue(formData, "id");
  const prefeituraId = profile.role === "bdl_admin" ? getRequiredValue(formData, "prefeitura_id") : profile.prefeitura_id;
  const nome = getRequiredValue(formData, "nome");
  const cnpj = getRequiredValue(formData, "cnpj").replace(/\D/g, "");
  const endereco = getOptionalValue(formData, "endereco");
  const telefone = getOptionalValue(formData, "telefone");

  if (!id || !prefeituraId || !nome || !cnpj) {
    return { error: "Informe empresa, nome e CNPJ do posto." };
  }

  if (cnpj.length !== 14) {
    return { error: "Informe um CNPJ válido para o posto." };
  }

  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("frota_postos_credenciados")
    .update({
      cnpj,
      endereco,
      nome,
      prefeitura_id: prefeituraId,
      telefone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (profile.role !== "bdl_admin") query = query.eq("prefeitura_id", prefeituraId!);
  const { data: updated, error } = await query.select("id").maybeSingle();

  if (error || !updated) {
    return { error: formatSupabaseError(error?.message ?? "Posto não encontrado.") };
  }

  revalidatePath("/frotas/abastecimento");
  revalidatePath("/frotas/posto");
  revalidatePath("/frotas/postos");
  return { success: "Posto atualizado com sucesso." };
}

export async function resetPostoCredenciadoSenha(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("fuel_stations.manage");
  if (permissionError) return { error: permissionError };
  const profile = await requireUserProfile();
  const id = getRequiredValue(formData, "id");
  const senha = getRequiredValue(formData, "senha");

  if (!id || !senha) {
    return { error: "Informe a nova senha do posto." };
  }

  if (senha.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("frota_postos_credenciados")
    .update({
      senha_hash: hashPassword(senha),
      primeiro_acesso_concluido_em: null,
      email_verificado_em: null,
      sessao_revogada_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (profile.role !== "bdl_admin") {
    if (!profile.prefeitura_id) return { error: "Empresa não encontrada." };
    query = query.eq("prefeitura_id", profile.prefeitura_id);
  }
  const { data: updated, error } = await query.select("id").maybeSingle();

  if (error || !updated) {
    return { error: formatSupabaseError(error?.message ?? "Posto não encontrado.") };
  }

  await supabase.from("frota_posto_codigos").delete().eq("posto_id", id);
  revalidatePath("/frotas/postos");
  return { success: "Senha provisória definida. O posto deverá concluir novamente o primeiro acesso." };
}

export async function updatePostoCredenciadoStatus(
  previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  return updatePostoStatus(previousState, formData);
}

export async function createManutencao(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("maintenance.create");

  if (permissionError) {
    return { error: permissionError };
  }

  const veiculoId = getRequiredValue(formData, "veiculo_id");
  const tipo = getRequiredValue(formData, "tipo");
  const descricao = getRequiredValue(formData, "descricao");
  const dataEntrada = getRequiredValue(formData, "data_entrada");
  const oficinaId = getOptionalValue(formData, "oficina_id");
  const profile = await requireUserProfile();
  const responsavel = getOptionalValue(formData, "responsavel");
  const observacoes = getOptionalValue(formData, "observacoes");
  const valor = parseCurrencyValue(getRequiredValue(formData, "valor"));
  const quilometragem = Number(
    getOptionalValue(formData, "quilometragem") ?? 0,
  );

  if (!veiculoId || !tipo || !descricao || !dataEntrada) {
    return { error: "Preencha os campos obrigatórios da manutenção." };
  }

  const supabase = createSupabaseServerClient();
  const { data: veiculo, error: veiculoError } = await supabase
    .from("frota_veiculos")
    .select("id,prefeitura_id,placa")
    .eq("id", veiculoId)
    .single();

  if (veiculoError || !veiculo) {
    return {
      error: formatSupabaseError(
        veiculoError?.message ?? "Veículo não encontrado.",
      ),
    };
  }

  if (
    profile.role !== "bdl_admin" &&
    veiculo.prefeitura_id !== profile.prefeitura_id
  )
    return { error: "Este veículo não pertence à sua empresa." };
  const selectedOficina = await resolveMaintenanceWorkshop(
    supabase,
    oficinaId,
    veiculo.prefeitura_id,
  );
  if ("error" in selectedOficina) return selectedOficina;

  const { data: manutencao, error } = await supabase
    .from("frota_manutencoes")
    .insert({
      data_entrada: dataEntrada,
      descricao,
      observacoes,
      oficina: selectedOficina.nome,
      oficina_id: selectedOficina.id,
      atividade_por: profile.nome,
      atividade_usuario_id: profile.id,
      prefeitura_id: veiculo.prefeitura_id,
      quilometragem: quilometragem || null,
      responsavel,
      status: "open",
      tipo,
      valor: valor || null,
      veiculo_id: veiculo.id,
    })
    .select("id")
    .single();

  if (error || !manutencao) {
    return {
      error: formatSupabaseError(error?.message ?? "Manutenção não criada."),
    };
  }

  const attachmentError = await uploadMaintenanceAttachments({
    formData,
    manutencaoId: manutencao.id,
    prefeituraId: veiculo.prefeitura_id,
    supabase,
    veiculoId: veiculo.id,
  });

  if (attachmentError) {
    return { error: attachmentError };
  }

  const { error: statusError } = await supabase
    .from("frota_veiculos")
    .update({ status: "maintenance" })
    .eq("id", veiculo.id);

  if (statusError) {
    return { error: formatSupabaseError(statusError.message) };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  revalidatePath("/frotas/manutencao");
  return { success: "Manutenção registrada com sucesso." };
}

export async function updateManutencao(): Promise<FrotaActionState> {
  await requireUserProfile();
  return {
    error:
      "Manutenções não podem ser editadas. Cancele a manutenção e registre uma nova.",
  };
}

export async function finishManutencao(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const profile = await requireUserProfile();
  const permissionError = await requireFrotasPermission("maintenance.complete");

  if (permissionError) {
    return { error: permissionError };
  }

  const id = getRequiredValue(formData, "id");
  const dataSaida = getRequiredValue(formData, "data_saida");
  const observacoes = getOptionalValue(formData, "observacoes");
  const valor = parseCurrencyValue(getRequiredValue(formData, "valor"));

  if (!id || !dataSaida) {
    return { error: "Informe a data de conclusão da manutenção." };
  }

  const supabase = createSupabaseServerClient();
  const { data: manutencao, error: manutencaoError } = await supabase
    .from("frota_manutencoes")
    .select("id,prefeitura_id,veiculo_id,status")
    .eq("id", id)
    .single();

  if (manutencaoError || !manutencao) {
    return {
      error: formatSupabaseError(
        manutencaoError?.message ?? "Manutenção não encontrada.",
      ),
    };
  }

  if (
    profile.role !== "bdl_admin" &&
    manutencao.prefeitura_id !== profile.prefeitura_id
  ) {
    return { error: "Esta manutenção não pertence à sua empresa." };
  }
  if (manutencao.status !== "open")
    return { error: "Somente manutenções abertas podem ser concluídas." };

  const updatePayload: Record<string, unknown> = {
    atividade_por: profile.nome,
    atividade_usuario_id: profile.id,
    data_saida: dataSaida,
    observacoes,
    status: "completed",
    updated_at: new Date().toISOString(),
  };

  if (valor > 0) {
    updatePayload.valor = valor;
  }

  const { data: completed, error } = await supabase
    .from("frota_manutencoes")
    .update(updatePayload)
    .eq("id", id)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (error || !completed) {
    return {
      error: formatSupabaseError(
        error?.message ??
          "Não foi possível concluir. Atualize a lista e tente novamente.",
      ),
    };
  }

  const attachmentError = await uploadMaintenanceAttachments({
    formData,
    manutencaoId: manutencao.id,
    prefeituraId: manutencao.prefeitura_id,
    supabase,
    veiculoId: manutencao.veiculo_id,
  });

  if (attachmentError) {
    return { error: attachmentError };
  }

  const { error: statusError } = await supabase
    .from("frota_veiculos")
    .update({ status: "active" })
    .eq("id", manutencao.veiculo_id);

  if (statusError) {
    return { error: formatSupabaseError(statusError.message) };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  revalidatePath("/frotas/manutencao");
  return { success: "Manutenção concluída com sucesso." };
}

export async function addManutencaoAnexos(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("maintenance.update");

  if (permissionError) {
    return { error: permissionError };
  }

  const id = getRequiredValue(formData, "id");
  const hasFiles = hasAttachmentFiles(formData);

  if (!id) {
    return { error: "Manutenção não encontrada." };
  }

  if (!hasFiles) {
    return { error: "Selecione ao menos um documento para anexar." };
  }

  const supabase = createSupabaseServerClient();
  const { data: manutencao, error: manutencaoError } = await supabase
    .from("frota_manutencoes")
    .select("id,prefeitura_id,veiculo_id")
    .eq("id", id)
    .single();

  if (manutencaoError || !manutencao) {
    return {
      error: formatSupabaseError(
        manutencaoError?.message ?? "Manutenção não encontrada.",
      ),
    };
  }

  const attachmentError = await uploadMaintenanceAttachments({
    formData,
    manutencaoId: manutencao.id,
    prefeituraId: manutencao.prefeitura_id,
    supabase,
    veiculoId: manutencao.veiculo_id,
  });

  if (attachmentError) {
    return { error: attachmentError };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  revalidatePath("/frotas/manutencao");
  return { success: "Documento anexado com sucesso." };
}

export async function deleteManutencaoAnexo(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const permissionError = await requireFrotasPermission("maintenance.update");

  if (permissionError) {
    return { error: permissionError };
  }

  const id = getRequiredValue(formData, "id");

  if (!id) {
    return { error: "Documento não encontrado." };
  }

  const supabase = createSupabaseServerClient();
  const { data: anexo, error: anexoError } = await supabase
    .from("frota_manutencao_anexos")
    .select("id,file_path")
    .eq("id", id)
    .single();

  if (anexoError || !anexo) {
    return {
      error: formatSupabaseError(
        anexoError?.message ?? "Documento não encontrado.",
      ),
    };
  }

  const { error: storageError } = await supabase.storage
    .from(maintenanceAttachmentBucket)
    .remove([anexo.file_path]);

  if (storageError) {
    return { error: formatSupabaseError(storageError.message) };
  }

  const { error } = await supabase
    .from("frota_manutencao_anexos")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: formatSupabaseError(error.message) };
  }

  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  revalidatePath("/frotas/manutencao");
  return { success: "Documento removido com sucesso." };
}

export async function cancelManutencao(
  _previousState: FrotaActionState,
  formData: FormData,
): Promise<FrotaActionState> {
  const profile = await requireUserProfile();
  const allowed = await hasFrotasPermission(profile, "maintenance.cancel");
  if (!allowed)
    return { error: "Você não tem permissão para cancelar este registro." };
  const id = getRequiredValue(formData, "id");
  const motivo = getRequiredValue(formData, "motivo_cancelamento");
  if (!id || motivo.length < 8)
    return { error: "Descreva o motivo com pelo menos 8 caracteres." };
  const supabase = createSupabaseServerClient();
  const { data: registro, error: readError } = await supabase
    .from("frota_manutencoes")
    .select("id,prefeitura_id,status,veiculo_id")
    .eq("id", id)
    .single();
  if (readError || !registro) return { error: "Registro não encontrado." };
  if (
    profile.role !== "bdl_admin" &&
    registro.prefeitura_id !== profile.prefeitura_id
  )
    return { error: "Este registro não pertence à sua empresa." };
  if (registro.status !== "open")
    return { error: "Somente registros abertos podem ser cancelados." };
  const now = new Date().toISOString();
  const { data: cancelled, error } = await supabase
    .from("frota_manutencoes")
    .update({
      status: "cancelled",
      motivo_cancelamento: motivo,
      cancelled_at: now,
      updated_at: now,
      atividade_por: profile.nome,
      atividade_usuario_id: profile.id,
    })
    .eq("id", id)
    .eq("prefeitura_id", registro.prefeitura_id)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (error || !cancelled)
    return {
      error: "Não foi possível cancelar. Atualize a lista e tente novamente.",
    };
  const { data: openMaintenance, error: openError } = await supabase
    .from("frota_manutencoes")
    .select("id")
    .eq("veiculo_id", registro.veiculo_id)
    .eq("status", "open")
    .limit(1);
  if (!openError && openMaintenance?.length === 0) {
    await supabase
      .from("frota_veiculos")
      .update({ status: "active" })
      .eq("id", registro.veiculo_id)
      .eq("status", "maintenance");
  }
  revalidatePath("/frotas");
  revalidatePath("/frotas/veiculos");
  revalidatePath("/frotas/manutencao");
  return { success: "Cancelamento registrado com sucesso." };
}

function getVeiculoPayload(formData: FormData) {
  const prefeitura_id = getRequiredValue(formData, "prefeitura_id");
  const placa = normalizePlate(getRequiredValue(formData, "placa"));
  const renavam = getRequiredValue(formData, "renavam");
  const lugares = getOptionalValue(formData, "lugares");
  const tipo = getRequiredValue(formData, "tipo");
  const cor = getOptionalValue(formData, "cor");
  const combustivel = getRequiredValue(formData, "combustivel");
  const carroceria = getOptionalValue(formData, "carroceria");
  const categoria = getOptionalValue(formData, "categoria");
  const anoFabricacaoValue = getRequiredValue(formData, "ano_fabricacao");
  const anoModeloValue = getRequiredValue(formData, "ano_modelo");
  const anoFabricacao = Number(anoFabricacaoValue);
  const anoModelo = Number(anoModeloValue);
  const ano = anoModelo || anoFabricacao;
  const dataAquisicao = parseBrazilianDate(
    getOptionalValue(formData, "data_aquisicao"),
  );
  const municipioEmplacamento = getOptionalValue(
    formData,
    "municipio_emplacamento",
  );
  const situacaoVeicular = getOptionalValue(formData, "situacao_veicular");
  const marca = getRequiredValue(formData, "marca");
  const modelo = getRequiredValue(formData, "modelo");
  const proprietarioAtual = getOptionalValue(formData, "proprietario_atual");
  const proprietarioAnterior = getOptionalValue(
    formData,
    "proprietario_anterior",
  );
  const restricaoVenda = getOptionalValue(formData, "restricao_venda");
  const restricoes = getOptionalValue(formData, "restricoes");
  const licenciado = getOptionalValue(formData, "licenciado");
  const origemDados = getOptionalValue(formData, "origem_dados");
  const principalCondutor = getOptionalValue(formData, "principal_condutor");
  const especie = getOptionalValue(formData, "especie");
  const status = (getOptionalValue(formData, "status") ??
    "active") as VeiculoStatus;

  if (
    !prefeitura_id ||
    !placa ||
    !renavam ||
    !marca ||
    !modelo ||
    !ano ||
    !anoModeloValue ||
    !tipo ||
    !combustivel ||
    !status
  ) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (!isValidPlate(placa)) {
    return { error: "Informe uma placa brasileira válida." };
  }

  if (!isValidRenavam(renavam)) {
    return { error: "Informe um Renavam válido com 11 dígitos." };
  }

  if (!allowedStatuses.has(status)) {
    return { error: "Status inválido." };
  }

  if (String(ano).length !== 4) {
    return { error: "Informe um ano modelo válido." };
  }

  if (anoFabricacaoValue && String(anoFabricacao).length !== 4) {
    return { error: "Informe um ano de fabricação válido." };
  }

  if (dataAquisicao === "invalid") {
    return { error: "Informe a data de aquisição no formato dd/MM/yyyy." };
  }

  return {
    veiculo: {
      ano,
      ano_fabricacao: Number.isFinite(anoFabricacao) ? anoFabricacao : null,
      ano_modelo: anoModelo,
      carroceria,
      categoria,
      marca,
      modelo,
      cor,
      data_aquisicao: dataAquisicao,
      licenciado,
      lugares,
      municipio_emplacamento: municipioEmplacamento,
      placa,
      prefeitura_id,
      principal_condutor: principalCondutor,
      proprietario_anterior: proprietarioAnterior,
      proprietario_atual: proprietarioAtual,
      renavam,
      restricao_venda: restricaoVenda,
      restricoes,
      situacao_veicular: situacaoVeicular,
      status,
      tipo,
      combustivel,
      especie,
      origem_dados: origemDados ?? "Cadastro",
    },
  };
}

function parseBrazilianDate(value: string | null) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return "invalid";
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function getRequiredValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    return "";
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

function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isValidPlate(value: string) {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(value);
}

function isValidRenavam(value: string) {
  return /^\d{11}$/.test(value);
}

function addOneYearIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setFullYear(date.getFullYear() + 1);

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function parseCurrencyValue(value: string) {
  const normalized = value
    .replace(/[R$\s.]/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(amount * 100) / 100;
}

function parseDecimalValue(value: string) {
  const normalized = value
    .replace(/\s/g, "")
    .replace(".", "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(amount * 1000) / 1000;
}

async function generateFuelOrderNumber(
  supabase: ReturnType<typeof createSupabaseServerClient>,
) {
  const { data, error } = await supabase.rpc("next_fuel_order_number");
  if (error || !data)
    throw new Error(
      "Não foi possível gerar o número da ordem. Tente novamente.",
    );
  return data as string;
}

async function getAbastecimentoForPrint(
  id: string,
): Promise<FrotaAbastecimento> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("frota_abastecimentos")
    .select(
      "id,prefeitura_id,veiculo_id,posto_id,numero_ordem,data_abastecimento,motorista,fornecedor,combustivel,quilometragem,litros,valor_litro,valor_total,arla_incluso,arla_litros,arla_valor_litro,arla_valor_total,status,observacoes,emitido_por,expires_at,concluido_por,numero_nota_fiscal,completed_at,created_at,print_count,last_printed_at,motivo_cancelamento,cancelled_at,frota_veiculos(placa,marca,modelo,ano,renavam,secretaria,prefeituras:empresas(nome,brasao_url)),frota_postos_credenciados(nome)",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error(
      formatSupabaseError(error?.message ?? "Ordem não encontrada."),
    );
  }

  const row = data as unknown as {
    ano?: never;
    arla_incluso: boolean;
    arla_litros: number | null;
    arla_valor_litro: number | null;
    arla_valor_total: number | null;
    cancelled_at: string | null;
    completed_at: string | null;
    combustivel: string;
    concluido_por: string | null;
    created_at: string;
    data_abastecimento: string;
    emitido_por: string | null;
    expires_at: string | null;
    fornecedor: string | null;
    frota_postos_credenciados: { nome: string } | null;
    frota_veiculos: {
      ano: number;
      marca: string;
      modelo: string;
      placa: string;
      prefeituras: { brasao_url: string | null; nome: string } | null;
      renavam: string | null;
      /** Valor legado usado somente na reprodução de relatórios históricos. */
      secretaria: string | null;
    } | null;
    id: string;
    last_printed_at: string | null;
    litros: number | null;
    motorista: string;
    motivo_cancelamento: string | null;
    numero_nota_fiscal: string | null;
    numero_ordem: string;
    observacoes: string | null;
    placa?: never;
    posto_id: string | null;
    prefeitura_id: string;
    print_count: number;
    quilometragem: number | null;
    renavam?: never;
    secretaria?: never;
    status: "issued" | "completed" | "cancelled" | "expired";
    valor_litro: number | null;
    valor_total: number | null;
    veiculo_id: string;
  };

  return {
    ...row,
    anexos: [],
    ano: row.frota_veiculos?.ano ?? null,
    consumo_medio_km_l: null,
    marca: row.frota_veiculos?.marca ?? "-",
    modelo: row.frota_veiculos?.modelo ?? "-",
    placa: row.frota_veiculos?.placa ?? "-",
    posto_nome: row.frota_postos_credenciados?.nome ?? null,
    prefeitura_brasao_url: row.frota_veiculos?.prefeituras?.brasao_url ?? null,
    prefeitura_nome: row.frota_veiculos?.prefeituras?.nome ?? "-",
    renavam: row.frota_veiculos?.renavam ?? null,
    secretaria: row.frota_veiculos?.secretaria ?? "-",
  };
}

async function expireIssuedOrdersForVehicle(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  veiculoId: string,
  nowIso: string,
) {
  await supabase
    .from("frota_abastecimentos")
    .update({
      status: "expired",
      updated_at: nowIso,
    })
    .eq("veiculo_id", veiculoId)
    .eq("status", "issued")
    .lte("expires_at", nowIso);
}

async function markAbastecimentoAsExpired(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  id: string,
) {
  await supabase
    .from("frota_abastecimentos")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "issued");
}

function isExpiredAt(value: string | null) {
  if (!value) {
    return false;
  }

  return new Date(value).getTime() <= Date.now();
}

function isDieselFuel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("diesel");
}

function buildPaymentInstallments({
  dataPagamento,
  dataVencimento,
  pagamentoId,
  parcelasPagas,
  quantidadeParcelas,
  valorTotal,
}: {
  dataPagamento: string;
  dataVencimento: string;
  pagamentoId: string;
  parcelasPagas: number;
  quantidadeParcelas: number;
  valorTotal: number;
}) {
  const baseValueInCents = Math.floor((valorTotal * 100) / quantidadeParcelas);
  const remainder =
    Math.round(valorTotal * 100) - baseValueInCents * quantidadeParcelas;

  return Array.from({ length: quantidadeParcelas }, (_, index) => {
    const numero = index + 1;
    const valueInCents = baseValueInCents + (index < remainder ? 1 : 0);
    const status = numero <= parcelasPagas ? "paid" : "pending";

    return {
      data_pagamento: status === "paid" ? dataPagamento : null,
      data_vencimento: addMonthsIsoDate(dataVencimento, index),
      numero,
      pagamento_id: pagamentoId,
      status,
      valor: valueInCents / 100,
    };
  });
}

function addMonthsIsoDate(value: string, months: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setMonth(date.getMonth() + months);

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

async function uploadMaintenanceAttachments({
  formData,
  manutencaoId,
  prefeituraId,
  supabase,
  veiculoId,
}: {
  formData: FormData;
  manutencaoId: string;
  prefeituraId: string;
  supabase: ReturnType<typeof createSupabaseServerClient>;
  veiculoId: string;
}) {
  const files = formData
    .getAll("anexos")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (!files.length) {
    return null;
  }

  const bucketError = await ensureMaintenanceAttachmentBucket(supabase);

  if (bucketError) {
    return bucketError;
  }

  const uploadedFiles = [];

  for (const file of files) {
    if (file.size > maxMaintenanceAttachmentSize) {
      return "Cada anexo deve ter no máximo 10 MB.";
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const path = `${prefeituraId}/${veiculoId}/${manutencaoId}/${Date.now()}-${normalizeFileName(file.name, extension)}`;
    const { error: uploadError } = await supabase.storage
      .from(maintenanceAttachmentBucket)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      return formatSupabaseError(uploadError.message);
    }

    uploadedFiles.push({
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      file_type: file.type || null,
      manutencao_id: manutencaoId,
      prefeitura_id: prefeituraId,
      veiculo_id: veiculoId,
    });
  }

  const { error } = await supabase
    .from("frota_manutencao_anexos")
    .insert(uploadedFiles);

  if (error) {
    return formatSupabaseError(error.message);
  }

  return null;
}

async function uploadFuelAttachments({
  abastecimentoId,
  formData,
  prefeituraId,
  supabase,
  veiculoId,
}: {
  abastecimentoId: string;
  formData: FormData;
  prefeituraId: string;
  supabase: ReturnType<typeof createSupabaseServerClient>;
  veiculoId: string;
}) {
  const files = formData
    .getAll("anexos")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (!files.length) {
    return null;
  }

  const bucketError = await ensureFuelAttachmentBucket(supabase);

  if (bucketError) {
    return bucketError;
  }

  const uploadedFiles = [];

  for (const file of files) {
    if (file.size > maxMaintenanceAttachmentSize) {
      return "Cada comprovante deve ter no máximo 10 MB.";
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const path = `${prefeituraId}/${veiculoId}/${abastecimentoId}/${Date.now()}-${normalizeFileName(file.name, extension)}`;
    const { error: uploadError } = await supabase.storage
      .from(fuelAttachmentBucket)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      return formatSupabaseError(uploadError.message);
    }

    uploadedFiles.push({
      abastecimento_id: abastecimentoId,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      file_type: file.type || null,
      prefeitura_id: prefeituraId,
      veiculo_id: veiculoId,
    });
  }

  const { error } = await supabase
    .from("frota_abastecimento_anexos")
    .insert(uploadedFiles);

  if (error) {
    return formatSupabaseError(error.message);
  }

  return null;
}

async function uploadVehicleAttachments({
  formData,
  prefeituraId,
  supabase,
  veiculoId,
}: {
  formData: FormData;
  prefeituraId: string;
  supabase: ReturnType<typeof createSupabaseServerClient>;
  veiculoId: string;
}) {
  const files = formData
    .getAll("anexos")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (!files.length) {
    return null;
  }

  const bucketError = await ensureVehicleAttachmentBucket(supabase);

  if (bucketError) {
    return bucketError;
  }

  const uploadedFiles = [];

  for (const file of files) {
    if (file.size > maxMaintenanceAttachmentSize) {
      return "Cada anexo deve ter no máximo 10 MB.";
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const path = `${prefeituraId}/${veiculoId}/${Date.now()}-${normalizeFileName(file.name, extension)}`;
    const { error: uploadError } = await supabase.storage
      .from(vehicleAttachmentBucket)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      return formatSupabaseError(uploadError.message);
    }

    uploadedFiles.push({
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      file_type: file.type || null,
      prefeitura_id: prefeituraId,
      veiculo_id: veiculoId,
    });
  }

  const { error } = await supabase
    .from("frota_veiculo_anexos")
    .insert(uploadedFiles);

  if (error) {
    return formatSupabaseError(error.message);
  }

  return null;
}

function hasAttachmentFiles(formData: FormData) {
  return formData
    .getAll("anexos")
    .some((file) => file instanceof File && file.size > 0);
}

async function ensureMaintenanceAttachmentBucket(
  supabase: ReturnType<typeof createSupabaseServerClient>,
) {
  const { error } = await supabase.storage.createBucket(
    maintenanceAttachmentBucket,
    {
      allowedMimeTypes: [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
      ],
      fileSizeLimit: maxMaintenanceAttachmentSize,
      public: false,
    },
  );

  if (!error || error.message.toLowerCase().includes("already exists")) {
    return null;
  }

  return formatSupabaseError(error.message);
}

async function ensureVehicleAttachmentBucket(
  supabase: ReturnType<typeof createSupabaseServerClient>,
) {
  const { error } = await supabase.storage.createBucket(
    vehicleAttachmentBucket,
    {
      allowedMimeTypes: [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
      ],
      fileSizeLimit: maxMaintenanceAttachmentSize,
      public: false,
    },
  );

  if (!error || error.message.toLowerCase().includes("already exists")) {
    return null;
  }

  return formatSupabaseError(error.message);
}

async function ensureFuelAttachmentBucket(
  supabase: ReturnType<typeof createSupabaseServerClient>,
) {
  const { error } = await supabase.storage.createBucket(fuelAttachmentBucket, {
    allowedMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
    fileSizeLimit: maxMaintenanceAttachmentSize,
    public: false,
  });

  if (!error || error.message.toLowerCase().includes("already exists")) {
    return null;
  }

  return formatSupabaseError(error.message);
}

async function ensureVehiclePhotoBucket(
  supabase: ReturnType<typeof createSupabaseServerClient>,
) {
  const { error } = await supabase.storage.createBucket(vehiclePhotoBucket, {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    fileSizeLimit: maxVehiclePhotoSize,
    public: true,
  });

  if (!error || error.message.toLowerCase().includes("already exists")) {
    return null;
  }

  return formatSupabaseError(error.message);
}

function normalizeFileName(fileName: string, extension: string) {
  const baseName = fileName
    .replace(/\.[^/.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `${baseName || "anexo"}.${extension}`;
}

function getImageExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension && ["jpg", "jpeg", "png", "webp"].includes(extension)) {
    return extension;
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function hashPassword(password: string) {
  const iterations = 120000;
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString(
    "hex",
  );

  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

function formatSupabaseError(message: string) {
  if (message.includes("frota_abastecimentos_one_pending_per_vehicle_idx")) {
    return "Este veículo já possui uma ordem de abastecimento pendente.";
  }

  if (message.includes("frota_vencimentos_veiculo_id_tipo_key")) {
    return "Este veículo já possui um débito cadastrado para este tipo.";
  }

  if (message.includes("duplicate") || message.includes("unique")) {
    return "Já existe um registro cadastrado com estes dados.";
  }

  if (
    message.includes("frota_manutencao") ||
    message.includes("frota_abastecimento_anexos") ||
    message.includes("frota_abastecimentos") ||
    message.includes("frota_postos_credenciados") ||
    message.includes("frota_veiculo_anexos") ||
    message.includes("frota_veiculos") ||
    message.includes("frota_vencimentos")
  ) {
    return "Rode a migration de Vibe Frotas no Supabase antes de gerenciar veículos.";
  }

  return message;
}

async function requireFrotasPermission(permission: string) {
  const profile = await requireUserProfile();
  const allowed = await hasFrotasPermission(profile, permission);

  if (allowed) {
    return null;
  }

  return "Você não tem permissão para executar esta ação.";
}

async function resolveFuelCompletionActor(
  abastecimentoId: string,
  source: "administracao" | "posto",
) {
  if (!abastecimentoId)
    return { error: "Ordem de abastecimento não encontrada." };

  // Each entry point requires its own session; never fall back to another login.
  const posto = source === "posto" ? await getPostoSession() : null;
  const profile =
    source === "administracao" ? await getCurrentUserProfile() : null;
  if (
    source === "posto"
      ? !posto?.primeiro_acesso_concluido_em
      : !profile?.primeiro_acesso_concluido_em || !(await hasFrotasPermission(profile, "fuel.complete"))
  ) {
    return {
      error: "Você não tem permissão para executar esta ação. Entre novamente.",
    };
  }

  const { data, error } = await createSupabaseServerClient()
    .from("frota_abastecimentos")
    .select("id,prefeitura_id,posto_id,status")
    .eq("id", abastecimentoId)
    .maybeSingle();
  if (error || !data)
    return {
      error: formatSupabaseError(error?.message ?? "Ordem não encontrada."),
    };
  if (data.status !== "issued")
    return { error: "Somente ordens pendentes podem ser concluídas." };

  if (posto) {
    if (
      data.posto_id !== posto.id ||
      data.prefeitura_id !== posto.prefeitura_id
    ) {
      return { error: "Esta ordem não está disponível para este posto." };
    }
    return { nome: posto.nome, usuarioId: null };
  }
  if (
    !profile ||
    (profile.role !== "bdl_admin" &&
      data.prefeitura_id !== profile.prefeitura_id)
  ) {
    return { error: "Este registro não pertence à sua empresa." };
  }
  return { nome: profile.nome, usuarioId: profile.id };
}

async function resolveMaintenanceWorkshop(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  id: string | null,
  empresaId: string,
) {
  if (!id) return { error: "Selecione uma oficina cadastrada." };
  const { data, error } = await supabase
    .from("frota_oficinas")
    .select("id,nome")
    .eq("id", id)
    .eq("prefeitura_id", empresaId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data)
    return { error: "Selecione uma oficina ativa da empresa do veículo." };
  return { id: data.id as string, nome: data.nome as string };
}
