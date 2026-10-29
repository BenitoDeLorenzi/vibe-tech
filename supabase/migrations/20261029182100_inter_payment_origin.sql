create or replace function public.inter_apply_billing_status(p_id uuid,p_situacao text,p_details jsonb)
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
  origem_recebimento=case when p_situacao='RECEBIDO' then coalesce(p_details->>'origemRecebimento',origem_recebimento) else origem_recebimento end,
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
