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
  if exists(select 1 from public.licenca_recebimentos where id=rid and pagamento_id=p_id and forma_pagamento='Inter' and estornado_em is null) then raise exception 'Recebimento confirmado pelo Inter nao pode ser estornado manualmente.'; end if;
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
