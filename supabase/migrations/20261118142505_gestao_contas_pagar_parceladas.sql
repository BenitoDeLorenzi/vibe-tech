-- One payable per installment; balances move only through the existing payment action.
create table public.gestao_cartoes_credito (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.gestao_unidades(id),
  nome text not null check(length(nome) between 2 and 100),
  fechamento_dia smallint check(fechamento_dia between 1 and 28),
  vencimento_dia smallint check(vencimento_dia between 1 and 28),
  ativo boolean not null default true,
  criado_por uuid not null references public.perfis(id),
  created_at timestamptz not null default now(),
  unique(id, unidade_id),
  unique(unidade_id, nome)
);
create index gestao_cartoes_credito_unidade_idx on public.gestao_cartoes_credito(unidade_id);
alter table public.gestao_cartoes_credito enable row level security;
revoke all on public.gestao_cartoes_credito from public, anon, authenticated;
grant select on public.gestao_cartoes_credito to authenticated;
grant all on public.gestao_cartoes_credito to service_role;
create policy gestao_cartoes_master on public.gestao_cartoes_credito for select to authenticated
using ((select gestao_private.fin_master()) and unidade_id in (
  select u.id from public.gestao_unidades u
  where u.empresa_id in (select gestao_private.empresas_equipe())
));

alter table public.gestao_contas_pagar
  add column parcelamento_id uuid,
  add column parcela_numero smallint,
  add column parcelas_total smallint,
  add column forma_prevista text,
  add column cartao_id uuid,
  add constraint gestao_pagar_cartao_fk foreign key(cartao_id, unidade_id)
    references public.gestao_cartoes_credito(id, unidade_id);

alter table public.gestao_contas_pagar
  add constraint gestao_pagar_parcelamento_check check (
    (parcelamento_id is null and parcela_numero is null and parcelas_total is null and forma_prevista is null and cartao_id is null)
    or
    (parcelamento_id is not null and parcela_numero is not null and parcelas_total is not null
      and parcelas_total between 1 and 60 and parcela_numero between 1 and parcelas_total
      and forma_prevista is not null and forma_prevista in ('cartao', 'outro')
      and ((forma_prevista='cartao' and cartao_id is not null)
        or (forma_prevista='outro' and cartao_id is null)))
  );
create unique index gestao_pagar_parcelamento_parcela_idx
  on public.gestao_contas_pagar(unidade_id, parcelamento_id, parcela_numero);
create index gestao_pagar_cartao_idx on public.gestao_contas_pagar(cartao_id, vencimento);

-- Preserve the existing view columns; append parcel metadata for the app.
create or replace view public.gestao_pagar_saldos with (security_invoker=true) as
select p.id, p.unidade_id, p.descricao, p.categoria, p.fornecedor,
  p.observacoes, p.vencimento, p.valor, p.cancelada, p.fechamento_id,
  p.criado_por, p.created_at,
  coalesce((select -sum(m.valor) from public.gestao_fin_movimentos m
    where m.pagar_id=p.id and not m.estornado), 0) as pago,
  p.parcelamento_id, p.parcela_numero, p.parcelas_total,
  p.forma_prevista, p.cartao_id
from public.gestao_contas_pagar p;

create function public.gestao_fin_criar_parcelas(
  p_ator uuid, p_unidade uuid, p_dados jsonb
) returns uuid
language plpgsql security invoker set search_path='' as $$
declare
  empresa uuid;
  grupo uuid;
  descricao text;
  categoria text;
  fornecedor text;
  observacoes text;
  forma text;
  cartao uuid;
  valor numeric;
  vencimento_inicial date;
  parcelas integer;
  centavos bigint;
  centavos_base bigint;
  centavos_restantes integer;
  numero integer;
  mes date;
  ultimo_dia integer;
  vencimento date;
begin
  select empresa_id into empresa from public.gestao_unidades where id=p_unidade;
  if empresa is null
    or gestao_private.papel_gestao(p_ator, empresa) is distinct from 'gestor'
    or not exists(select 1 from public.perfis where id=p_ator and ativo and role::text='bdl_admin')
  then raise exception 'O financeiro é exclusivo do usuário Master com acesso vigente à unidade.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_unidade::text||':financeiro',0));
  if not exists(select 1 from public.gestao_fin_config where unidade_id=p_unidade) then
    raise exception 'Ative o financeiro antes de registrar lançamentos.';
  end if;
  grupo:=nullif(p_dados->>'requisicao','')::uuid;
  if grupo is null then raise exception 'Identificador da operação ausente.'; end if;
  if exists(select 1 from public.gestao_auditoria
    where registro_id=grupo and empresa_id=empresa and acao='financeiro_pagar_parcelado') then
    return grupo;
  end if;
  descricao:=trim(coalesce(p_dados->>'descricao',''));
  categoria:=coalesce(nullif(trim(p_dados->>'categoria'),''),'Outras despesas');
  fornecedor:=trim(coalesce(p_dados->>'fornecedor',''));
  observacoes:=trim(coalesce(p_dados->>'observacoes',''));
  forma:=p_dados->>'forma_prevista';
  cartao:=nullif(p_dados->>'cartao_id','')::uuid;
  valor:=nullif(p_dados->>'valor','')::numeric;
  parcelas:=nullif(p_dados->>'parcelas','')::integer;
  vencimento_inicial:=nullif(p_dados->>'vencimento','')::date;
  if length(descricao) not between 2 and 200 or length(categoria)>100
    or length(fornecedor)>120 or length(observacoes)>2000
    or forma is null or forma not in ('cartao','outro')
    or (forma='cartao' and (cartao is null or not exists (
      select 1 from public.gestao_cartoes_credito
      where id=cartao and unidade_id=p_unidade and ativo)))
    or (forma='outro' and cartao is not null)
    or parcelas is null or parcelas not between 1 and 60
    or vencimento_inicial is null
    or valor is null or valor::text in ('NaN','Infinity','-Infinity')
    or valor<=0 or valor>=1000000000 or valor<>round(valor,2)
  then raise exception 'Confira o valor, o primeiro vencimento e os dados do parcelamento.';
  end if;
  centavos:=(valor*100)::bigint;
  if centavos<parcelas then raise exception 'O valor precisa permitir parcelas de pelo menos R$ 0,01.'; end if;
  centavos_base:=centavos/parcelas;
  centavos_restantes:=mod(centavos,parcelas)::integer;
  for numero in 1..parcelas loop
    mes:=(date_trunc('month',vencimento_inicial)::date + make_interval(months=>numero-1))::date;
    ultimo_dia:=extract(day from (mes+interval '1 month - 1 day'))::integer;
    vencimento:=mes+least(extract(day from vencimento_inicial)::integer,ultimo_dia)-1;
    insert into public.gestao_contas_pagar(
      unidade_id,descricao,categoria,fornecedor,observacoes,vencimento,valor,criado_por,
      parcelamento_id,parcela_numero,parcelas_total,forma_prevista,cartao_id
    ) values (
      p_unidade,descricao,categoria,fornecedor,observacoes,vencimento,
      (centavos_base+case when numero<=centavos_restantes then 1 else 0 end)/100.0,p_ator,
      grupo,numero,parcelas,forma,cartao
    );
  end loop;
  insert into public.gestao_auditoria(empresa_id,usuario_id,acao,registro_id,dados)
  values(empresa,p_ator,'financeiro_pagar_parcelado',grupo,
    p_dados||jsonb_build_object('parcelamento_id',grupo,'parcelas_criadas',parcelas));
  return grupo;
end $$;

revoke all on function public.gestao_fin_criar_parcelas(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.gestao_fin_criar_parcelas(uuid,uuid,jsonb) to service_role;

create function public.gestao_fin_criar_cartao(
  p_ator uuid, p_unidade uuid, p_dados jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
declare empresa uuid; grupo uuid; nome text; fechamento smallint; vencimento smallint; novo uuid;
begin
  select empresa_id into empresa from public.gestao_unidades where id=p_unidade;
  if empresa is null
    or gestao_private.papel_gestao(p_ator,empresa) is distinct from 'gestor'
    or not exists(select 1 from public.perfis where id=p_ator and ativo and role::text='bdl_admin')
  then raise exception 'O financeiro é exclusivo do usuário Master com acesso vigente à unidade.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_unidade::text||':financeiro',0));
  if not exists(select 1 from public.gestao_fin_config where unidade_id=p_unidade) then
    raise exception 'Ative o financeiro antes de cadastrar cartões.';
  end if;
  grupo:=nullif(p_dados->>'requisicao','')::uuid;
  if grupo is null then raise exception 'Identificador da operação ausente.'; end if;
  select registro_id into novo from public.gestao_auditoria
    where registro_id=grupo and empresa_id=empresa and acao='financeiro_cartao_cadastrar';
  if novo is not null then return novo; end if;
  nome:=trim(coalesce(p_dados->>'descricao',''));
  fechamento:=nullif(p_dados->>'fechamento_dia','')::smallint;
  vencimento:=nullif(p_dados->>'vencimento_dia','')::smallint;
  if length(nome) not between 2 and 100
    or (fechamento is not null and fechamento not between 1 and 28)
    or (vencimento is not null and vencimento not between 1 and 28)
  then raise exception 'Confira o nome e os dias do cartão.'; end if;
  insert into public.gestao_cartoes_credito(unidade_id,nome,fechamento_dia,vencimento_dia,criado_por)
  values(p_unidade,nome,fechamento,vencimento,p_ator) returning id into novo;
  insert into public.gestao_auditoria(empresa_id,usuario_id,acao,registro_id,dados)
  values(empresa,p_ator,'financeiro_cartao_cadastrar',grupo,p_dados||jsonb_build_object('cartao_id',novo));
  return novo;
end $$;
revoke all on function public.gestao_fin_criar_cartao(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.gestao_fin_criar_cartao(uuid,uuid,jsonb) to service_role;

create function gestao_private.validar_pagamento_cartao() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.pagar_id is not null
    and exists(select 1 from public.gestao_contas_pagar p where p.id=new.pagar_id and p.cartao_id is not null)
    and not exists(select 1 from public.gestao_contas c
      where c.id=new.conta_id and c.unidade_id=new.unidade_id and c.tipo in ('caixa','banco'))
  then raise exception 'Pague a fatura do cartão a partir de Caixa ou Banco.';
  end if;
  return new;
end $$;
create trigger gestao_validar_pagamento_cartao before insert on public.gestao_fin_movimentos
for each row execute function gestao_private.validar_pagamento_cartao();
