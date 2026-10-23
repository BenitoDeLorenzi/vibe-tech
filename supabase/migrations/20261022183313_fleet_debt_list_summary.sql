alter table public.frota_vencimentos
  add column if not exists updated_at timestamptz;

-- Os registros antigos não possuem histórico de edição; usa-se a criação como referência.
update public.frota_vencimentos
set updated_at = created_at
where updated_at is null;

alter table public.frota_vencimentos
  alter column updated_at set default now(),
  alter column updated_at set not null;

create or replace function public.touch_frota_vencimento_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists frota_vencimento_updated_at on public.frota_vencimentos;
create trigger frota_vencimento_updated_at
before update on public.frota_vencimentos
for each row execute function public.touch_frota_vencimento_updated_at();

create index if not exists frota_debito_consultas_veiculo_success_idx
on public.frota_debito_consultas (veiculo_id, created_at desc)
where status = 'success';

create or replace function public.frota_veiculos_pendencias_resumo(p_empresa uuid, p_ids uuid[])
returns jsonb language sql stable security invoker set search_path = '' as $$
with hoje as (
  select (now() at time zone 'America/Sao_Paulo')::date as data
), itens as (
  select v.id,
    coalesce(m.vencidos, 0) + coalesce(d.vencidos, 0) as vencidos,
    coalesce(m.proximos, 0) + coalesce(d.proximos, 0) as proximos,
    coalesce(d.total, 0) as debitos_consulta,
    coalesce(m.total, 0) as vencimentos_manuais,
    case
      when c.atualizado_em is null then greatest(m.atualizado_em, p.atualizado_em)
      when greatest(m.atualizado_em, p.atualizado_em) is null then c.atualizado_em
      else greatest(c.atualizado_em, m.atualizado_em, p.atualizado_em)
    end as atualizado_em,
    case
      when c.atualizado_em is null then 'manual'
      when greatest(m.atualizado_em, p.atualizado_em) > c.atualizado_em then 'manual'
      else 'plexi'
    end as origem_atualizacao
  from public.frota_veiculos v
  cross join hoje h
  left join lateral (
    select count(*) as total,
      count(*) filter (where status <> 'paid' and data_vencimento < h.data) as vencidos,
      count(*) filter (where status <> 'paid' and data_vencimento between h.data and h.data + 30) as proximos,
      max(updated_at) as atualizado_em
    from public.frota_vencimentos fv where fv.veiculo_id = v.id
  ) m on true
  left join lateral (
    select max(created_at) as atualizado_em
    from public.frota_vencimento_pagamentos fp where fp.veiculo_id = v.id
  ) p on true
  left join lateral (
    select dc.id, dc.updated_at as atualizado_em
    from public.frota_debito_consultas dc
    where dc.veiculo_id = v.id and dc.status = 'success'
    order by dc.created_at desc, dc.id desc limit 1
  ) c on true
  left join lateral (
    select count(*) as total,
      count(*) filter (where is_expired or coalesce(due_date, expiration_date)::date < h.data) as vencidos,
      count(*) filter (where not is_expired and coalesce(due_date, expiration_date)::date between h.data and h.data + 30) as proximos
    from public.frota_debitos_veiculares dv where dv.consulta_id = c.id
  ) d on true
  where v.prefeitura_id = p_empresa and v.id = any(p_ids)
)
select coalesce(jsonb_object_agg(id, jsonb_build_object(
  'vencidos', vencidos,
  'proximos', proximos,
  'debitosConsulta', debitos_consulta,
  'vencimentosManuais', vencimentos_manuais,
  'atualizadoEm', atualizado_em,
  'origemAtualizacao', case when atualizado_em is null then null else origem_atualizacao end
)), '{}'::jsonb) from itens;
$$;

revoke all on function public.frota_veiculos_pendencias_resumo(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.frota_veiculos_pendencias_resumo(uuid, uuid[]) to service_role;

alter function public.frota_veiculos_pendencias_resumo(uuid, uuid[])
  set timezone to 'America/Sao_Paulo';
