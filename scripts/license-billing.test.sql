-- Integration smoke test: uses an available company/module pair and rolls back every write.
begin;
do $$
declare actor uuid; company uuid; module uuid; lid uuid; pid uuid; request uuid:=gen_random_uuid();
begin
 select id into actor from public.perfis where role='bdl_admin' and ativo=true limit 1;
 select e.id,m.id into company,module from public.empresas e cross join public.modulos m
 where e.status='active' and m.ativo=true and not exists(select 1 from public.licencas l where l.prefeitura_id=e.id and l.modulo_id=m.id) limit 1;
 if actor is null or company is null then raise exception 'Test needs a Master and an unused company/module pair.'; end if;
 lid:=public.license_save_contract(actor,null,company,module,'2028-01-31','2029-07-30',500,31,'active',false);
 assert (select count(*) from public.licenca_pagamentos where licenca_id=lid)=18,'18-month contract';
 assert (select vencimento from public.licenca_pagamentos where licenca_id=lid and numero_parcela=2)='2028-02-29'::date,'leap day';
 assert (select vencimento from public.licenca_pagamentos where licenca_id=lid and numero_parcela=3)='2028-03-31'::date,'original day anchor';
 perform public.license_save_contract(actor,lid,company,module,'2028-01-31','2029-07-30',500,31,'suspended',false);
 assert (select status from public.licencas where id=lid)='suspended','status edit';
 select id into pid from public.licenca_pagamentos where licenca_id=lid and numero_parcela=1;
 perform public.license_payment_operation(actor,pid,'edit','{"valor":450,"vencimento":"2028-02-01","observacoes":"Teste de ajuste"}');
 assert (select valor from public.licenca_pagamentos where id=pid)=450,'adjustment';
 perform public.license_payment_operation(actor,pid,'receive',jsonb_build_object('request_id',request,'valor_pago',100,'pago_em',current_date));
 perform public.license_payment_operation(actor,pid,'receive',jsonb_build_object('request_id',request,'valor_pago',100,'pago_em',current_date));
 assert (select valor_pago from public.licenca_pagamentos where id=pid)=100,'idempotency';
 assert (select status from public.licenca_pagamentos where id=pid)='partial','partial receipt';
 begin
  perform public.license_payment_operation(actor,pid,'edit','{"valor":300,"vencimento":"2028-02-01"}');
  raise exception 'TEST edit with receipt accepted';
 exception when others then if sqlerrm='TEST edit with receipt accepted' then raise; end if; end;
 select id into pid from public.licenca_pagamentos where licenca_id=lid and numero_parcela=2;
 perform public.license_payment_operation(actor,pid,'cancel','{"motivo":"Teste de cancelamento"}');
 assert (select status from public.licenca_pagamentos where id=pid)='cancelled','cancellation';
 assert not has_table_privilege('authenticated','public.licenca_recebimentos','select'),'no direct client financial access';
end $$;
rollback;
select 'PASS: create, 18 cycles, leap dates, status, adjustment, receipt, retry, immutable paid invoice, cancellation, access; all rolled back' as result;
