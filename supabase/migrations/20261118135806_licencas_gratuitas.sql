-- A zero-value contract grants access for its term without creating installments.
create or replace function public.license_save_contract(p_actor uuid,p_id uuid,p_empresa uuid,p_modulo uuid,p_inicio date,p_fim date,p_mensal numeric,p_dia integer,p_status text,p_renew boolean default false)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare l public.licencas; c public.licenca_contratos; cid uuid; n integer:=0; ciclo date; venc date; mes date;
begin
 if not exists(select 1 from public.perfis where id=p_actor and role='bdl_admin' and ativo is true) then raise exception 'Acesso restrito ao Master.'; end if;
 if p_inicio is null or p_fim is null or p_fim<p_inicio or p_fim>=p_inicio+interval '120 months' or p_mensal is null or p_mensal<0 or p_mensal<>round(p_mensal,2) or p_dia is null or p_dia not between 1 and 31 or p_status is null or p_status not in ('active','suspended','expired','cancelled') then raise exception 'Informe período válido (até 120 ciclos), mensalidade e vencimento.'; end if;
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
 if p_mensal>0 then
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
 end if;
 if p_renew then
  insert into public.licenca_renovacoes(licenca_id,prefeitura_id,modulo_id,inicio_anterior,fim_anterior,valor_anual_anterior,inicio_novo,fim_novo,valor_anual_novo,pagamentos_snapshot)
  values(p_id,p_empresa,p_modulo,c.inicio,c.fim,l.valor_anual,p_inicio,p_fim,p_mensal*12,'[]');
  -- Keep uninterrupted access to the current term when renewing ahead of time.
  update public.licencas set fim=p_fim,status='active',valor_mensal=p_mensal,dia_vencimento=p_dia,valor_anual=p_mensal*12 where id=p_id;
 end if;
 insert into public.licenca_cobranca_eventos(licenca_id,autor_id,acao,detalhes) values(p_id,p_actor,case when p_renew then 'renovacao' else 'contrato' end,jsonb_build_object('contrato_id',cid,'inicio',p_inicio,'fim',p_fim,'mensalidade',p_mensal,'parcelas',n));
 return p_id;
end $$;
