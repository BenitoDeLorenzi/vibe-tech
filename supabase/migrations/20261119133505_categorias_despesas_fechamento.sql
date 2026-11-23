-- Staff payments are categorized without turning them into accounts payable.
insert into public.gestao_fin_categorias(unidade_id,nome,sistema)
select f.unidade_id,'Pessoal',true from public.gestao_fin_config f
where not exists (
  select 1 from public.gestao_fin_categorias c
  where c.unidade_id=f.unidade_id
    and gestao_private.normalizar_categoria_financeira(c.nome)=gestao_private.normalizar_categoria_financeira('Pessoal')
);
update public.gestao_fin_categorias set sistema=true
where gestao_private.normalizar_categoria_financeira(nome)=gestao_private.normalizar_categoria_financeira('Pessoal');

create or replace function gestao_private.criar_categorias_financeiras() returns trigger
language plpgsql set search_path='' as $$
declare nome_padrao text;
begin
  foreach nome_padrao in array array[
    'Fornecedores', 'Aluguel', 'Energia e água', 'Internet e telefone',
    'Manutenção', 'Serviços', 'Impostos', 'Pessoal', 'Outras despesas', 'Fechamento'
  ] loop
    insert into public.gestao_fin_categorias(unidade_id,nome,sistema)
    values (new.unidade_id,nome_padrao,nome_padrao in ('Pessoal','Outras despesas','Fechamento'))
    on conflict do nothing;
  end loop;
  return new;
end $$;

alter table public.gestao_fin_movimentos add column if not exists categoria text;
update public.gestao_fin_movimentos set categoria='Pessoal'
where tipo='equipe' and categoria is null;

create or replace function public.gestao_operar(p_ator uuid,p_acao text,p_dados jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare u uuid; e uuid; rid uuid; inicio date; f public.gestao_fechamentos%rowtype; item jsonb; meta jsonb;
 c uuid; pagar uuid; receber uuid; grupo uuid; v numeric; idx integer; restante numeric; tipo text; categoria_despesa text;
begin
 if p_acao not in ('salvar','confirmar','reabrir') then return gestao_private.operar_equipe(p_ator,p_acao,p_dados);end if;
 u:=(p_dados->>'unidade_id')::uuid;rid:=(p_dados->>'id')::uuid;
 select empresa_id into e from public.gestao_unidades where id=u;
 if e is null or gestao_private.papel_gestao(p_ator,e) is null then raise exception 'Empresa ou módulo sem acesso vigente.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':financeiro',0));
 perform pg_advisory_xact_lock(hashtextextended(rid::text,0));
 select * into f from public.gestao_fechamentos where id=rid and unidade_id=u for update;
 select fc.inicio into inicio from public.gestao_fin_config fc where unidade_id=u;
 if p_acao='salvar' then
   rid:=gestao_private.operar_equipe(p_ator,p_acao,p_dados);
   if not exists(select 1 from public.perfis where id=p_ator and ativo and role::text='bdl_admin') then update public.gestao_fechamentos set financeiro='{}' where id=rid;end if;
   if p_dados ? 'financeiro' then
     if not exists(select 1 from public.perfis where id=p_ator and ativo and role::text='bdl_admin') then raise exception 'Somente o Master pode definir contas financeiras.';end if;
     if jsonb_typeof(p_dados->'financeiro') is distinct from 'object' then raise exception 'Dados financeiros inválidos.';end if;
     update public.gestao_fechamentos set financeiro=p_dados->'financeiro' where id=rid;
   end if;
   return rid;
 end if;
 if (p_acao='confirmar' and f.status='conferido') or (p_acao='reabrir' and f.status='rascunho') then return gestao_private.operar_equipe(p_ator,p_acao,p_dados);end if;
 if p_acao='reabrir' and f.financeiro_gerado then
   if exists(select 1 from public.gestao_fin_movimentos m join public.gestao_contas_receber r on r.id=m.receber_id where r.fechamento_id=rid and m.tipo='recebimento' and not m.estornado) then raise exception 'Estorne primeiro os recebimentos de cartões vinculados a este fechamento.';end if;
   if exists(select 1 from public.gestao_fin_movimentos m join public.gestao_contas_pagar p on p.id=m.pagar_id where p.fechamento_id=rid and m.fechamento_id is distinct from rid and not m.estornado) then raise exception 'Estorne primeiro os pagamentos posteriores vinculados a este fechamento.';end if;
   update public.gestao_fin_movimentos set estornado=true,motivo_estorno=trim(p_dados->>'motivo') where fechamento_id=rid and not estornado;
   update public.gestao_contas_receber set cancelada=true where fechamento_id=rid;
   update public.gestao_contas_pagar set cancelada=true where fechamento_id=rid;
 end if;
 rid:=gestao_private.operar_equipe(p_ator,p_acao,p_dados);
 if p_acao='reabrir' then update public.gestao_fechamentos set financeiro_gerado=false where id=rid;perform gestao_private.validar_saldo_cobranca(u);return rid;end if;
 if inicio is null or f.data<inicio or f.financeiro_legado then return rid;end if;
 if f.data>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Confirme apenas fechamentos com data até hoje.';end if;
 idx:=0;
 for item in select value from jsonb_array_elements(f.pagamentos) loop
   meta:=f.financeiro->'recebimentos'->idx; idx:=idx+1;
   c:=nullif(meta->>'conta_id','')::uuid;
   if c is not null then perform gestao_private.fin_conta(u,c);end if;
   -- Old drafts may still point Pix at the bank. Normalize their incoming destination.
   if c is null or not exists(select 1 from public.gestao_contas where id=c and unidade_id=u and ativo and gestao_contas.tipo=case when item->>'forma'='Dinheiro' then 'caixa' else 'cobranca' end) then
     select id into c from public.gestao_contas where unidade_id=u and ativo and gestao_contas.tipo=case when item->>'forma'='Dinheiro' then 'caixa' else 'cobranca' end order by created_at,id limit 1;
   end if;
   c:=gestao_private.fin_conta(u,c);
   v:=coalesce((item->>'valor_liquido')::numeric,(item->>'valor')::numeric);
   if v=0 then continue;end if;
   insert into public.gestao_fin_movimentos(grupo,unidade_id,conta_id,data,valor,tipo,descricao,fechamento_id,criado_por)
   values(gen_random_uuid(),u,c,f.data,v,'venda',(item->>'forma')||' · fechamento',rid,p_ator);
 end loop;
 idx:=0;
 for item in select value from jsonb_array_elements(f.despesas) loop
   meta:=f.financeiro->'despesas'->idx;idx:=idx+1;
   c:=nullif(meta->>'conta_id','')::uuid;
   if c is null then select id into c from public.gestao_contas where unidade_id=u and ativo and gestao_contas.tipo='caixa' order by created_at,id limit 1;end if;
   c:=gestao_private.fin_conta(u,c);v:=(item->>'valor')::numeric;
   pagar:=nullif(meta->>'pagar_id','')::uuid;
   if pagar is null then
     categoria_despesa:=coalesce(nullif(trim(meta->>'categoria'),''),'Outras despesas');
     insert into public.gestao_contas_pagar(unidade_id,descricao,categoria,vencimento,valor,fechamento_id,criado_por)
     values(u,item->>'descricao',categoria_despesa,f.data,v,rid,p_ator) returning id into pagar;
   else
     if nullif(meta->>'categoria','') is not null and not exists (
       select 1 from public.gestao_contas_pagar p
       where p.id=pagar and p.unidade_id=u and p.categoria=(meta->>'categoria')
     ) then raise exception 'A categoria da despesa deve corresponder à conta a pagar vinculada.'; end if;
     select p.valor-coalesce((select -sum(m.valor) from public.gestao_fin_movimentos m where m.pagar_id=p.id and not estornado),0) into restante
     from public.gestao_contas_pagar p where p.id=pagar and p.unidade_id=u and not p.cancelada for update;
     if not found or v>restante then raise exception 'Uma conta vinculada à despesa está indisponível ou seu saldo é menor que o pagamento.';end if;
   end if;
   insert into public.gestao_fin_movimentos(grupo,unidade_id,conta_id,data,valor,tipo,descricao,fechamento_id,pagar_id,criado_por)
   values(gen_random_uuid(),u,c,f.data,-v,'despesa',item->>'descricao',rid,pagar,p_ator);
 end loop;
 for item in select to_jsonb(eq) from public.gestao_fechamento_equipe eq where fechamento_id=rid and valor_pago>0 loop
   c:=nullif(f.financeiro->>'equipe_conta_id','')::uuid;
   if c is null then select id into c from public.gestao_contas where unidade_id=u and ativo and gestao_contas.tipo='caixa' order by created_at,id limit 1;end if;
   c:=gestao_private.fin_conta(u,c);
   insert into public.gestao_fin_movimentos(grupo,unidade_id,conta_id,data,valor,tipo,descricao,fechamento_id,criado_por,categoria)
   values(gen_random_uuid(),u,c,f.data,-(item->>'valor_pago')::numeric,'equipe','Equipe · '||(item->>'nome'),rid,p_ator,'Pessoal');
 end loop;
 perform gestao_private.validar_saldo_cobranca(u);
 update public.gestao_fechamentos set financeiro_gerado=true where id=rid;
 return rid;
end $$;
revoke all on function public.gestao_operar(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.gestao_operar(uuid,text,jsonb) to service_role;
