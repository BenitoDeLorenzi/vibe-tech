create function public.license_cancel(p_actor uuid, p_id uuid, p_reason text)
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  license_row public.licencas;
  cancelled_count integer := 0;
  current_month date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
begin
  if not exists(select 1 from public.perfis where id=p_actor and role='bdl_admin' and ativo is true) then
    raise exception 'Acesso restrito ao Master.';
  end if;
  if length(trim(coalesce(p_reason,''))) < 3 then
    raise exception 'Informe a justificativa do cancelamento.';
  end if;
  select * into license_row from public.licencas where id=p_id for update;
  if not found then raise exception 'Licença não encontrada.'; end if;
  if license_row.status='cancelled' then raise exception 'Esta licença já está cancelada.'; end if;

  -- Confirm bank cancellation first. A submitted or uncertain bill must never
  -- disappear behind a cancelled monthly charge.
  if exists (
    select 1 from public.inter_cobrancas b
    join public.licenca_pagamentos p on p.id=b.pagamento_id
    where p.licenca_id=p_id
      and b.status not in ('cancelled','failed','expired')
      and b.situacao is distinct from 'RECEBIDO'
  ) then
    raise exception 'Há boleto ativo ou pendente no Inter. Dê baixa nele e aguarde a confirmação do banco antes de cancelar a licença.';
  end if;

  with cancelled as (
    update public.licenca_pagamentos p
       set status='cancelled', updated_at=now()
     where p.licenca_id=p_id
       and p.competencia>current_month
       and p.status in ('open','overdue')
       and coalesce(p.valor_pago,0)=0
     returning p.id, p.valor, p.competencia
  ), audit as (
    insert into public.licenca_cobranca_eventos(licenca_id,pagamento_id,autor_id,acao,detalhes)
    select p_id,id,p_actor,'cancel',jsonb_build_object('dados',jsonb_build_object('motivo',p_reason,'origem','cancelamento_licenca'),'valor',valor,'competencia',competencia)
    from cancelled returning id
  ) select count(*) into cancelled_count from audit;

  update public.licencas set status='cancelled' where id=p_id;
  insert into public.licenca_cobranca_eventos(licenca_id,autor_id,acao,detalhes)
  values(p_id,p_actor,'cancelamento_licenca',jsonb_build_object('motivo',p_reason,'anterior',license_row.status,'mensalidades_futuras_canceladas',cancelled_count));
  return cancelled_count;
end $$;
revoke all on function public.license_cancel(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.license_cancel(uuid,uuid,text) to service_role;

create or replace function public.inter_reserve_billing(p_actor uuid,p_pagamento uuid,p_seu_numero text)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare p public.licenca_pagamentos; bid uuid;
begin
  if not exists(select 1 from public.perfis where id=p_actor and role='bdl_admin' and ativo is true) then raise exception 'Acesso restrito ao Master.'; end if;
  select * into p from public.licenca_pagamentos where id=p_pagamento for update;
  if not found or p.status<>'open' or coalesce(p.valor_pago,0)<>0 then raise exception 'Mensalidade indisponível para emissão.'; end if;
  if not exists(select 1 from public.licencas where id=p.licenca_id and status<>'cancelled') then raise exception 'Não é possível emitir boleto para uma licença cancelada.'; end if;
  if p.vencimento<(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Ajuste o vencimento antes de emitir.'; end if;
  insert into public.inter_cobrancas(pagamento_id,seu_numero,status,valor,vencimento,criado_por)
  values(p_pagamento,p_seu_numero,'submitting',p.valor,p.vencimento,p_actor) returning id into bid;
  return bid;
end $$;
revoke all on function public.inter_reserve_billing(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.inter_reserve_billing(uuid,uuid,text) to service_role;
