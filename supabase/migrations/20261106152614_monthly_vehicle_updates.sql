create table if not exists public.frota_atualizacoes_veiculos (
  id uuid primary key default gen_random_uuid(),
  prefeitura_id uuid not null references public.empresas(id) on delete cascade,
  competencia date not null,
  status text not null default 'processing' check (status in ('processing', 'completed')),
  created_by uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (prefeitura_id, competencia),
  check (extract(day from competencia) = 1)
);

create index if not exists frota_atualizacoes_veiculos_empresa_idx
  on public.frota_atualizacoes_veiculos (prefeitura_id, created_at desc);

create table if not exists public.frota_atualizacao_veiculos_itens (
  id uuid primary key default gen_random_uuid(),
  atualizacao_id uuid not null references public.frota_atualizacoes_veiculos(id) on delete cascade,
  prefeitura_id uuid not null references public.empresas(id) on delete cascade,
  veiculo_id uuid references public.frota_veiculos(id) on delete set null,
  placa text not null,
  renavam text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'success', 'error')),
  consulta_id uuid references public.frota_debito_consultas(id) on delete set null,
  attempt integer not null default 1,
  error_message text,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (atualizacao_id, veiculo_id)
);

create index if not exists frota_atualizacao_itens_pendentes_idx
  on public.frota_atualizacao_veiculos_itens (status, claimed_at)
  where status in ('pending', 'processing');

create index if not exists frota_atualizacao_itens_atualizacao_idx
  on public.frota_atualizacao_veiculos_itens (atualizacao_id, created_at);

alter table public.frota_atualizacoes_veiculos enable row level security;
alter table public.frota_atualizacao_veiculos_itens enable row level security;

-- As telas e a API usam o cliente do servidor, após validar licença, empresa e permissão.
revoke all on public.frota_atualizacoes_veiculos from anon, authenticated;
revoke all on public.frota_atualizacao_veiculos_itens from anon, authenticated;
grant all on public.frota_atualizacoes_veiculos to service_role;
grant all on public.frota_atualizacao_veiculos_itens to service_role;

create or replace function public.iniciar_frota_atualizacao_veiculos(
  p_prefeitura uuid, p_competencia date, p_usuario uuid
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.frota_atualizacoes_veiculos (prefeitura_id, competencia, created_by)
  values (p_prefeitura, p_competencia, p_usuario)
  on conflict (prefeitura_id, competencia) do nothing
  returning id into v_id;

  if v_id is null then return null; end if;

  insert into public.frota_atualizacao_veiculos_itens
    (atualizacao_id, prefeitura_id, veiculo_id, placa, renavam, status, error_message)
  select v_id, p_prefeitura, v.id, v.placa, v.renavam,
    case when v.status = 'processing' or v.renavam is null or v.renavam !~ '^\d{11}$' then 'error' else 'pending' end,
    case when v.status = 'processing' then 'Cadastro do veículo ainda em processamento.'
         when v.renavam is null or v.renavam !~ '^\d{11}$' then 'Renavam ausente ou inválido.'
         else null end
  from public.frota_veiculos v where v.prefeitura_id = p_prefeitura;

  if not found then
    delete from public.frota_atualizacoes_veiculos where id = v_id;
    return null;
  end if;
  return v_id;
end $$;

revoke all on function public.iniciar_frota_atualizacao_veiculos(uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.iniciar_frota_atualizacao_veiculos(uuid, date, uuid) to service_role;
