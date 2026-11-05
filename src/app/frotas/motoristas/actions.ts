"use server";

import { revalidatePath } from "next/cache";

import { requireUserProfile } from "@/lib/auth-data";
import { hasFrotasPermission } from "@/lib/frotas-permissions";
import { getFrotasEmpresa } from "@/lib/secretarias-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type MotoristaActionState = {
  error?: string;
  success?: string;
};

export async function createMotorista(
  _previousState: MotoristaActionState,
  formData: FormData
): Promise<MotoristaActionState> {
  const profile = await requireUserProfile();
  const allowed = await hasFrotasPermission(profile, "drivers.manage");

  if (!allowed) {
    return { error: "Você não tem permissão para cadastrar motoristas." };
  }

  const prefeituraId = getRequiredValue(formData, "prefeitura_id");
  const nome = getRequiredValue(formData, "nome");
  const cpf = onlyDigits(getRequiredValue(formData, "cpf"));

  if (!prefeituraId || !nome || !cpf) {
    return { error: "Informe empresa, nome e CPF do motorista." };
  }

  if (profile.role !== "bdl_admin" && prefeituraId !== profile.prefeitura_id) {
    return { error: "Você só pode cadastrar motoristas da sua empresa." };
  }
  if (!(await getFrotasEmpresa(profile, prefeituraId))) {
    return { error: "Empresa não disponível para o módulo de frotas." };
  }

  if (!isValidCpf(cpf)) {
    return { error: "Informe um CPF válido." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("frota_motoristas").insert({
    cpf,
    nome,
    prefeitura_id: prefeituraId,
    status: "active",
  });

  if (error) {
    return { error: formatMotoristaError(error.message) };
  }

  revalidateMotoristasPaths();
  return { success: "Motorista cadastrado com sucesso." };
}

export async function updateMotorista(
  _previousState: MotoristaActionState,
  formData: FormData
): Promise<MotoristaActionState> {
  const profile = await requireUserProfile();
  const allowed = await hasFrotasPermission(profile, "drivers.manage");

  if (!allowed) {
    return { error: "Você não tem permissão para editar motoristas." };
  }

  const id = getRequiredValue(formData, "id");
  const prefeituraId = getRequiredValue(formData, "prefeitura_id");
  const nome = getRequiredValue(formData, "nome");
  const cpf = onlyDigits(getRequiredValue(formData, "cpf"));

  if (!id || !prefeituraId || !nome || !cpf) {
    return { error: "Informe empresa, nome e CPF do motorista." };
  }

  if (profile.role !== "bdl_admin" && prefeituraId !== profile.prefeitura_id) {
    return { error: "Você só pode editar motoristas da sua empresa." };
  }
  if (!(await getFrotasEmpresa(profile, prefeituraId))) {
    return { error: "Empresa não disponível para o módulo de frotas." };
  }

  if (!isValidCpf(cpf)) {
    return { error: "Informe um CPF válido." };
  }

  const supabase = createSupabaseServerClient();
  const { data: currentMotorista } = await supabase.from("frota_motoristas")
    .select("prefeitura_id").eq("id", id).maybeSingle();
  if (!currentMotorista || !(await getFrotasEmpresa(profile, currentMotorista.prefeitura_id))) {
    return { error: "Motorista não encontrado nesta empresa." };
  }
  const { error } = await supabase
    .from("frota_motoristas")
    .update({
      cpf,
      nome,
      prefeitura_id: prefeituraId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("prefeitura_id", currentMotorista.prefeitura_id);

  if (error) {
    return { error: formatMotoristaError(error.message) };
  }

  revalidateMotoristasPaths();
  return { success: "Motorista atualizado com sucesso." };
}

export async function updateMotoristaStatus(
  _previousState: MotoristaActionState,
  formData: FormData
): Promise<MotoristaActionState> {
  const profile = await requireUserProfile();
  const allowed = await hasFrotasPermission(profile, "drivers.manage");

  if (!allowed) {
    return { error: "Você não tem permissão para alterar motoristas." };
  }

  const id = getRequiredValue(formData, "id");
  const status = getRequiredValue(formData, "status");

  if (!id || !["active", "inactive"].includes(status)) {
    return { error: "Status do motorista inválido." };
  }

  const supabase = createSupabaseServerClient();
  const { data: motorista, error: motoristaError } = await supabase
    .from("frota_motoristas")
    .select("id,prefeitura_id")
    .eq("id", id)
    .single();

  if (motoristaError || !motorista) {
    return {
      error: formatMotoristaError(
        motoristaError?.message ?? "Motorista não encontrado."
      ),
    };
  }

  if (!(await getFrotasEmpresa(profile, motorista.prefeitura_id))) {
    return { error: "Você só pode alterar motoristas da sua empresa." };
  }

  const { error } = await supabase
    .from("frota_motoristas")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("prefeitura_id", motorista.prefeitura_id);

  if (error) {
    return { error: formatMotoristaError(error.message) };
  }

  revalidateMotoristasPaths();
  return {
    success:
      status === "active"
        ? "Motorista ativado com sucesso."
        : "Motorista inativado com sucesso.",
  };
}

function getRequiredValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function isValidCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) {
    return false;
  }

  const digits = cpf.split("").map(Number);
  const firstDigit = calculateCpfDigit(digits.slice(0, 9), 10);
  const secondDigit = calculateCpfDigit([...digits.slice(0, 9), firstDigit], 11);

  return firstDigit === digits[9] && secondDigit === digits[10];
}

function calculateCpfDigit(numbers: number[], factor: number) {
  const total = numbers.reduce(
    (sum, number, index) => sum + number * (factor - index),
    0
  );
  const remainder = (total * 10) % 11;

  return remainder === 10 ? 0 : remainder;
}

function formatMotoristaError(message: string) {
  if (message.includes("frota_motoristas_prefeitura_cpf_idx")) {
    return "Já existe um motorista com este CPF nesta empresa.";
  }

  if (
    message.includes("duplicate") ||
    message.includes("unique")
  ) {
    return "Já existe um motorista cadastrado com estes dados.";
  }

  if (message.includes("frota_motoristas")) {
    return "Rode a migration de Motoristas no Supabase antes de gerenciar motoristas.";
  }

  return message;
}

function revalidateMotoristasPaths() {
  revalidatePath("/frotas");
  revalidatePath("/frotas/motoristas");
  revalidatePath("/frotas/uso-veiculo");
}
