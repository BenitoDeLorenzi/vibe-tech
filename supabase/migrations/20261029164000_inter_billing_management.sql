alter table public.inter_cobrancas drop constraint inter_cobrancas_pagamento_id_key;
alter table public.inter_cobrancas add column situacao text;
alter table public.inter_cobrancas add column nosso_numero text;
alter table public.inter_cobrancas add column linha_digitavel text;
alter table public.inter_cobrancas add column codigo_barras text;
alter table public.inter_cobrancas add column pix_copia_e_cola text;
alter table public.inter_cobrancas add column valor_recebido numeric(12,2);
alter table public.inter_cobrancas add column recebido_em date;
alter table public.inter_cobrancas add column consultado_em timestamptz;
alter table public.inter_cobrancas add column cancelamento_motivo text;
alter table public.inter_cobrancas add column cancelamento_solicitado_em timestamptz;
alter table public.inter_cobrancas drop constraint inter_cobrancas_status_check;
alter table public.inter_cobrancas add constraint inter_cobrancas_status_check check (status in ('submitting','submitted','uncertain','cancelling','cancelled','failed','expired'));
create unique index inter_cobrancas_ativa_por_pagamento_idx on public.inter_cobrancas(pagamento_id)
 where status not in ('cancelled','failed','expired');
create index inter_cobrancas_pagamento_historico_idx on public.inter_cobrancas(pagamento_id,created_at desc);

create unique index licenca_recebimentos_inter_documento_idx on public.licenca_recebimentos(documento)
 where forma_pagamento='Inter' and estornado_em is null;

create function public.inter_reserve_billing(p_actor uuid,p_pagamento uuid,p_seu_numero text)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare p public.licenca_pagamentos; bid uuid;
begin
 if not exists(select 1 from public.perfis where id=p_actor and role='bdl_admin' and ativo is true) then raise exception 'Acesso restrito ao Master.'; end if;
 select * into p from public.licenca_pagamentos where id=p_pagamento for update;
 if not found or p.status<>'open' or coalesce(p.valor_pago,0)<>0 then raise exception 'Mensalidade indisponível para emissão.'; end if;
 if p.vencimento<(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Ajuste o vencimento antes de emitir.'; end if;
 insert into public.inter_cobrancas(pagamento_id,seu_numero,status,valor,vencimento,criado_por)
 values(p_pagamento,p_seu_numero,'submitting',p.valor,p.vencimento,p_actor) returning id into bid;
 return bid;
end $$;
revoke all on function public.inter_reserve_billing(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.inter_reserve_billing(uuid,uuid,text) to service_role;

create function public.inter_apply_billing_status(p_id uuid,p_situacao text,p_details jsonb)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare b public.inter_cobrancas; p public.licenca_pagamentos; amount numeric; credited numeric; dt date; rid uuid;
begin
 select * into b from public.inter_cobrancas where id=p_id for update;
 if not found then raise exception 'Boleto não encontrado.'; end if;
 select * into p from public.licenca_pagamentos where id=b.pagamento_id for update;
 if p_situacao not in ('RECEBIDO','A_RECEBER','MARCADO_RECEBIDO','ATRASADO','CANCELADO','EXPIRADO','FALHA_EMISSAO','EM_PROCESSAMENTO','PROTESTO') then raise exception 'Situação bancária inválida.'; end if;
 if b.situacao='RECEBIDO' and p_situacao<>'RECEBIDO' then raise exception 'Pagamento bancário já confirmado.'; end if;
 if b.situacao='CANCELADO' and p_situacao<>'CANCELADO' then raise exception 'Boleto já cancelado.'; end if;
 update public.inter_cobrancas set
  situacao=p_situacao,
  status=case p_situacao when 'CANCELADO' then 'cancelled' when 'EXPIRADO' then 'expired' when 'FALHA_EMISSAO' then 'failed' else case when status='cancelling' then 'cancelling' else 'submitted' end end,
  nosso_numero=coalesce(p_details->>'nossoNumero',nosso_numero),
  linha_digitavel=coalesce(p_details->>'linhaDigitavel',linha_digitavel),
  codigo_barras=coalesce(p_details->>'codigoBarras',codigo_barras),
  pix_copia_e_cola=coalesce(p_details->>'pixCopiaECola',pix_copia_e_cola),
  valor_recebido=case when p_situacao='RECEBIDO' then nullif(p_details->>'valorTotalRecebido','')::numeric else valor_recebido end,
  recebido_em=case when p_situacao='RECEBIDO' then nullif(left(p_details->>'dataSituacao',10),'')::date else recebido_em end,
  consultado_em=now(),updated_at=now(),erro=null
 where id=p_id;
 if p_situacao='RECEBIDO' and p.status<>'cancelled' then
  amount:=nullif(p_details->>'valorTotalRecebido','')::numeric;
  dt:=nullif(left(p_details->>'dataSituacao',10),'')::date;
  if amount is not null and amount>0 and dt is not null and dt<=(now() at time zone 'America/Sao_Paulo')::date then
   if not exists(select 1 from public.licenca_recebimentos where documento=b.codigo_solicitacao and forma_pagamento='Inter' and estornado_em is null) then
    credited:=least(amount,greatest(0,p.valor-coalesce(p.valor_pago,0)));
    if credited>0 then
     insert into public.licenca_recebimentos(pagamento_id,valor,pago_em,forma_pagamento,documento,observacoes)
     values(p.id,credited,dt,'Inter',b.codigo_solicitacao,'Recebimento confirmado pela API do Inter') returning id into rid;
     update public.licenca_pagamentos set valor_pago=coalesce(valor_pago,0)+credited,pago_em=dt,
      status=case when coalesce(valor_pago,0)+credited>=valor then 'paid' else 'partial' end,
      forma_pagamento='Inter',documento=b.codigo_solicitacao,updated_at=now() where id=p.id;
     insert into public.licenca_cobranca_eventos(licenca_id,pagamento_id,acao,detalhes)
     values(p.licenca_id,p.id,'inter_receive',jsonb_build_object('inter_cobranca_id',b.id,'valor_recebido',amount,'valor_creditado',credited,'recebimento_id',rid));
    end if;
   end if;
  end if;
 end if;
end $$;
revoke all on function public.inter_apply_billing_status(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.inter_apply_billing_status(uuid,text,jsonb) to service_role;

create or replace function public.license_payment_operation(p_actor uuid,p_id uuid,p_action text,p_values jsonb default '{}')
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare p public.licenca_pagamentos; total numeric; amount numeric; dt date; rid uuid; req uuid; reason text;
begin
 if not exists(select 1 from public.perfis where id=p_actor and role='bdl_admin' and ativo is true) then raise exception 'Acesso restrito ao Master.'; end if;
 select * into p from public.licenca_pagamentos where id=p_id for update;
 if not found then raise exception 'Cobrança não encontrada.'; end if;
 if p_action in ('edit','cancel','receive') and exists(
  select 1 from public.inter_cobrancas where pagamento_id=p_id and status not in ('cancelled','failed','expired')
 ) then raise exception 'Ha boleto ativo ou pendente no Inter. Confirme seu cancelamento antes de alterar ou registrar manualmente esta mensalidade.'; end if;
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
