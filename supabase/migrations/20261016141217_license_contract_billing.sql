-- Existing installments are retained exactly as issued. New periods use full monthly cycles.
alter table public.licencas add column valor_mensal numeric(12,2), add column dia_vencimento integer check (dia_vencimento between 1 and 31);
update public.licencas set valor_mensal=round(coalesce(valor_anual,0)/12,2), dia_vencimento=extract(day from inicio);
create table public.licenca_contratos (
 id uuid primary key default gen_random_uuid(), licenca_id uuid not null references public.licencas(id) on delete restrict,
 inicio date not null, fim date not null check(fim>=inicio), valor_mensal numeric(12,2) not null check(valor_mensal>=0),
 dia_vencimento integer not null check(dia_vencimento between 1 and 31), legado boolean not null default false,
 created_at timestamptz not null default now(), unique(licenca_id,inicio)
);
insert into public.licenca_contratos(licenca_id,inicio,fim,valor_mensal,dia_vencimento,legado)
select id,inicio,fim,valor_mensal,dia_vencimento,true from public.licencas;
alter table public.licenca_pagamentos add column contrato_id uuid references public.licenca_contratos(id) on delete restrict;
update public.licenca_pagamentos p set contrato_id=c.id from public.licenca_contratos c where c.licenca_id=p.licenca_id;
alter table public.licenca_pagamentos alter column contrato_id set not null;
alter table public.licenca_pagamentos drop constraint licenca_pagamentos_licenca_id_numero_parcela_key;
alter table public.licenca_pagamentos drop constraint licenca_pagamentos_numero_parcela_check;
alter table public.licenca_pagamentos add constraint licenca_pagamentos_numero_parcela_check check(numero_parcela between 1 and 120);
alter table public.licenca_pagamentos add constraint licenca_pagamentos_contrato_parcela_key unique(contrato_id,numero_parcela);
alter table public.licenca_pagamentos drop constraint licenca_pagamentos_status_check;
alter table public.licenca_pagamentos add constraint licenca_pagamentos_status_check check(status in ('open','paid','partial','overdue','cancelled'));
create index licenca_pagamentos_competencia_idx on public.licenca_pagamentos(competencia,vencimento);
create table public.licenca_recebimentos (
 id uuid primary key default gen_random_uuid(), pagamento_id uuid not null references public.licenca_pagamentos(id) on delete restrict,
 valor numeric(12,2) not null check(valor>0), pago_em date not null, forma_pagamento text, documento text, observacoes text,
 autor_id uuid, request_id uuid unique, estornado_em timestamptz, estornado_por uuid, motivo_estorno text,
 created_at timestamptz not null default now()
);
create index licenca_recebimentos_pagamento_idx on public.licenca_recebimentos(pagamento_id);
create index licenca_recebimentos_data_idx on public.licenca_recebimentos(pago_em) where estornado_em is null;
insert into public.licenca_recebimentos(pagamento_id,valor,pago_em,forma_pagamento,documento,observacoes)
select id,valor_pago,pago_em,forma_pagamento,documento,observacoes from public.licenca_pagamentos where valor_pago>0 and pago_em is not null;
create table public.licenca_cobranca_eventos (
 id uuid primary key default gen_random_uuid(), licenca_id uuid not null references public.licencas(id) on delete restrict,
 pagamento_id uuid references public.licenca_pagamentos(id) on delete restrict, autor_id uuid, acao text not null,
 detalhes jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index licenca_cobranca_eventos_licenca_idx on public.licenca_cobranca_eventos(licenca_id,created_at);
create index licenca_cobranca_eventos_pagamento_idx on public.licenca_cobranca_eventos(pagamento_id);
-- These tables are only used by authorized server actions with service_role.
alter table public.licenca_contratos enable row level security;
alter table public.licenca_recebimentos enable row level security;
alter table public.licenca_cobranca_eventos enable row level security;
alter table public.licenca_pagamentos enable row level security;
revoke all on public.licenca_contratos,public.licenca_recebimentos,public.licenca_cobranca_eventos,public.licenca_pagamentos from anon,authenticated;
grant all on public.licenca_contratos,public.licenca_recebimentos,public.licenca_cobranca_eventos,public.licenca_pagamentos to service_role;

create function public.license_save_contract(p_actor uuid,p_id uuid,p_empresa uuid,p_modulo uuid,p_inicio date,p_fim date,p_mensal numeric,p_dia integer,p_status text,p_renew boolean default false)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare l public.licencas; c public.licenca_contratos; cid uuid; n integer:=0; ciclo date; venc date; mes date;
begin
 if not exists(select 1 from public.perfis where id=p_actor and role='bdl_admin' and ativo is true) then raise exception 'Acesso restrito ao Master.'; end if;
 if p_inicio is null or p_fim is null or p_fim<p_inicio or p_fim>=p_inicio+interval '120 months' or p_mensal is null or p_mensal<=0 or p_mensal<>round(p_mensal,2) or p_dia is null or p_dia not between 1 and 31 or p_status is null or p_status not in ('active','suspended','expired','cancelled') then raise exception 'Informe período válido (até 120 ciclos), mensalidade e vencimento.'; end if;
 if p_id is not null then
  select * into l from public.licencas where id=p_id for update;
  if not found then raise exception 'Licença não encontrada.'; end if;
  select * into c from public.licenca_contratos where licenca_id=p_id order by inicio desc limit 1;
  if p_renew then
   if p_inicio<>l.fim+1 then raise exception 'A renovação deve começar no dia seguinte ao fim da licença.'; end if;
   p_empresa:=l.prefeitura_id; p_modulo:=l.modulo_id;
  else
   if p_empresa<>l.prefeitura_id or p_modulo<>l.modulo_id or p_inicio<>c.inicio or p_fim<>c.fim or p_mensal<>c.valor_mensal or p_dia<>c.dia_vencimento then
    raise exception 'O contrato já possui cobranças. Preserve o histórico: ajuste uma cobrança individual ou renove para um novo período.';
   end if;
   update public.licencas set status=p_status::public.subscription_status where id=p_id;
   insert into public.licenca_cobranca_eventos(licenca_id,autor_id,acao,detalhes) values(p_id,p_actor,'status_licenca',jsonb_build_object('anterior',l.status,'novo',p_status));
   return p_id;
  end if;
 else
  if not exists(select 1 from public.empresas where id=p_empresa and status='active') or not exists(select 1 from public.modulos where id=p_modulo and ativo=true) then raise exception 'Selecione empresa e módulo ativos.'; end if;
  insert into public.licencas(prefeitura_id,modulo_id,inicio,fim,status,valor_mensal,dia_vencimento,valor_anual)
  values(p_empresa,p_modulo,p_inicio,p_fim,p_status::public.subscription_status,p_mensal,p_dia,p_mensal*12) returning id into p_id;
 end if;
 insert into public.licenca_contratos(licenca_id,inicio,fim,valor_mensal,dia_vencimento) values(p_id,p_inicio,p_fim,p_mensal,p_dia) returning id into cid;
 loop
  ciclo:=(p_inicio+make_interval(months=>n))::date;
  exit when ciclo>p_fim;
  mes:=date_trunc('month',ciclo)::date;
  venc:=mes+least(p_dia,extract(day from mes+interval '1 month - 1 day')::integer)-1;
  if venc<ciclo then
   mes:=(mes+interval '1 month')::date;
   venc:=mes+least(p_dia,extract(day from mes+interval '1 month - 1 day')::integer)-1;
  end if;
  insert into public.licenca_pagamentos(licenca_id,contrato_id,prefeitura_id,modulo_id,numero_parcela,competencia,vencimento,valor,status)
  values(p_id,cid,p_empresa,p_modulo,n+1,date_trunc('month',ciclo)::date,venc,p_mensal,'open');
  n:=n+1;
 end loop;
 if p_renew then
  insert into public.licenca_renovacoes(licenca_id,prefeitura_id,modulo_id,inicio_anterior,fim_anterior,valor_anual_anterior,inicio_novo,fim_novo,valor_anual_novo,pagamentos_snapshot)
  values(p_id,p_empresa,p_modulo,c.inicio,c.fim,l.valor_anual,p_inicio,p_fim,p_mensal*12,'[]');
  -- Keep uninterrupted access to the current term when renewing ahead of time.
  update public.licencas set fim=p_fim,status='active',valor_mensal=p_mensal,dia_vencimento=p_dia,valor_anual=p_mensal*12 where id=p_id;
 end if;
 insert into public.licenca_cobranca_eventos(licenca_id,autor_id,acao,detalhes) values(p_id,p_actor,case when p_renew then 'renovacao' else 'contrato' end,jsonb_build_object('contrato_id',cid,'inicio',p_inicio,'fim',p_fim,'mensalidade',p_mensal,'parcelas',n));
 return p_id;
end $$;

create function public.license_payment_operation(p_actor uuid,p_id uuid,p_action text,p_values jsonb default '{}')
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare p public.licenca_pagamentos; total numeric; amount numeric; dt date; rid uuid; req uuid; reason text;
begin
 if not exists(select 1 from public.perfis where id=p_actor and role='bdl_admin' and ativo is true) then raise exception 'Acesso restrito ao Master.'; end if;
 select * into p from public.licenca_pagamentos where id=p_id for update;
 if not found then raise exception 'Cobrança não encontrada.'; end if;
 select coalesce(sum(valor),0) into total from public.licenca_recebimentos where pagamento_id=p_id and estornado_em is null;
 if p_action='receive' then
  req:=(p_values->>'request_id')::uuid;
  if req is null then raise exception 'Identificador do recebimento ausente.'; end if;
  if exists(select 1 from public.licenca_recebimentos where request_id=req and pagamento_id=p_id) then return; end if;
  amount:=(p_values->>'valor_pago')::numeric; dt:=(p_values->>'pago_em')::date;
  if p.status='cancelled' or amount is null or amount<=0 or amount<>round(amount,2) or amount>p.valor-total or dt is null or dt>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Informe valor até o saldo pendente e data de recebimento não futura.'; end if;
  insert into public.licenca_recebimentos(pagamento_id,valor,pago_em,forma_pagamento,documento,observacoes,autor_id,request_id)
  values(p_id,amount,dt,p_values->>'forma_pagamento',p_values->>'documento',p_values->>'observacoes',p_actor,req);
 elsif p_action='reverse' then
  reason:=trim(p_values->>'motivo'); rid:=(p_values->>'recebimento_id')::uuid;
  if coalesce(length(reason),0)<3 then raise exception 'Informe o motivo do estorno.'; end if;
  update public.licenca_recebimentos set estornado_em=now(),estornado_por=p_actor,motivo_estorno=reason where id=rid and pagamento_id=p_id and estornado_em is null;
  if not found then raise exception 'Recebimento já estornado ou não encontrado.'; end if;
 elsif p_action='cancel' then
  if total>0 then raise exception 'Estorne os recebimentos antes de cancelar a cobrança.'; end if;
  if coalesce(length(trim(p_values->>'motivo')),0)<3 then raise exception 'Informe o motivo do cancelamento.'; end if;
  update public.licenca_pagamentos set status='cancelled',updated_at=now() where id=p_id;
 elsif p_action='edit' then
  amount:=(p_values->>'valor')::numeric; dt:=(p_values->>'vencimento')::date;
  if p.status='cancelled' or total>0 then raise exception 'Só é possível editar cobranças sem recebimentos e não canceladas.'; end if;
  if amount is null or amount<=0 or amount<>round(amount,2) or dt is null then raise exception 'Informe valor e vencimento válidos.'; end if;
  update public.licenca_pagamentos set valor=amount,vencimento=dt,observacoes=p_values->>'observacoes',updated_at=now() where id=p_id;
 else raise exception 'Operação inválida.';
 end if;
 if p_action in ('receive','reverse') then
  select coalesce(sum(valor),0),max(pago_em) into total,dt from public.licenca_recebimentos where pagamento_id=p_id and estornado_em is null;
  update public.licenca_pagamentos set valor_pago=total,pago_em=dt,status=case when total>=valor then 'paid' when total>0 then 'partial' else 'open' end,
   forma_pagamento=case when p_action='receive' then p_values->>'forma_pagamento' else null end,
   documento=case when p_action='receive' then p_values->>'documento' else null end,updated_at=now() where id=p_id;
 end if;
 insert into public.licenca_cobranca_eventos(licenca_id,pagamento_id,autor_id,acao,detalhes) values(p.licenca_id,p_id,p_actor,p_action,jsonb_build_object('antes',to_jsonb(p),'dados',p_values));
end $$;
revoke all on function public.license_save_contract(uuid,uuid,uuid,uuid,date,date,numeric,integer,text,boolean) from public,anon,authenticated;
revoke all on function public.license_payment_operation(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.license_save_contract(uuid,uuid,uuid,uuid,date,date,numeric,integer,text,boolean) to service_role;
grant execute on function public.license_payment_operation(uuid,uuid,text,jsonb) to service_role;
