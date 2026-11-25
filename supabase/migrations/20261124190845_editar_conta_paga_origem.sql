-- Correct a paid payable and its direct payment source without changing paid amounts.
create function public.gestao_fin_editar_conta_paga(
  p_ator uuid, p_unidade uuid, p_conta uuid, p_escopo text, p_dados jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  empresa uuid;
  conta public.gestao_contas_pagar%rowtype;
  movimento public.gestao_fin_movimentos%rowtype;
  origens jsonb;
  origem jsonb;
  conta_nova uuid;
  tipo_novo text;
  anteriores jsonb;
  descricao_nova text;
  categoria_nova text;
  fornecedor_novo text;
  observacoes_novas text;
  valor_novo numeric;
  vencimento_novo date;
  pago numeric;
begin
  select empresa_id into empresa from public.gestao_unidades where id=p_unidade;
  if empresa is null
    or gestao_private.papel_gestao(p_ator,empresa) is distinct from 'gestor'
    or not exists(select 1 from public.perfis where id=p_ator and ativo and role::text='bdl_admin')
  then raise exception 'O financeiro é exclusivo do usuário Master com acesso vigente à unidade.';
  end if;
  if p_escopo is distinct from 'uma' then
    raise exception 'Contas pagas devem ser editadas individualmente.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_unidade::text||':financeiro',0));
  select * into conta from public.gestao_contas_pagar
    where id=p_conta and unidade_id=p_unidade for update;
  if not found or conta.cancelada or conta.excluida_em is not null or conta.fechamento_id is not null then
    raise exception 'Esta conta não pode ser editada.';
  end if;
  select coalesce(-sum(m.valor),0), coalesce(jsonb_agg(to_jsonb(m) order by m.data,m.id),'[]'::jsonb)
    into pago,anteriores
    from public.gestao_fin_movimentos m
    where m.unidade_id=p_unidade and m.pagar_id=p_conta and not m.estornado;
  if pago<=0 then raise exception 'Esta conta não possui pagamento ativo.'; end if;
  if exists(select 1 from public.gestao_fin_movimentos m
    where m.unidade_id=p_unidade and m.pagar_id=p_conta and not m.estornado
      and (m.tipo<>'despesa' or m.valor>=0 or m.fechamento_id is not null)) then
    raise exception 'Há pagamentos vinculados a fechamento que não podem ser alterados aqui.';
  end if;

  descricao_nova:=trim(coalesce(p_dados->>'descricao',''));
  fornecedor_novo:=trim(coalesce(p_dados->>'fornecedor',''));
  observacoes_novas:=trim(coalesce(p_dados->>'observacoes',''));
  valor_novo:=nullif(p_dados->>'valor','')::numeric;
  vencimento_novo:=nullif(p_dados->>'vencimento','')::date;
  select c.nome into categoria_nova from public.gestao_fin_categorias c
    where c.unidade_id=p_unidade and c.ativo and c.nome<>'Fechamento'
      and gestao_private.normalizar_categoria_financeira(c.nome)=
        gestao_private.normalizar_categoria_financeira(p_dados->>'categoria');
  if length(descricao_nova) not between 2 and 200
    or length(fornecedor_novo)>120 or length(observacoes_novas)>2000
    or categoria_nova is null or vencimento_novo is null
    or valor_novo is null or valor_novo::text in ('NaN','Infinity','-Infinity')
    or valor_novo<pago or valor_novo>=1000000000 or valor_novo<>round(valor_novo,2)
  then raise exception 'Confira os dados. O valor da conta não pode ser menor que o total já pago.';
  end if;

  origens:=p_dados->'origens';
  if jsonb_typeof(origens) is distinct from 'array'
    or jsonb_array_length(origens)<>(select count(*) from public.gestao_fin_movimentos m
      where m.unidade_id=p_unidade and m.pagar_id=p_conta and not m.estornado)
  then raise exception 'Confira todos os pagamentos desta conta.';
  end if;

  for movimento in select * from public.gestao_fin_movimentos m
    where m.unidade_id=p_unidade and m.pagar_id=p_conta and not m.estornado
    order by m.id for update
  loop
    if (select count(*) from jsonb_array_elements(origens) o where o->>'id'=movimento.id::text)<>1 then
      raise exception 'Confira todos os pagamentos desta conta.';
    end if;
    select o into origem from jsonb_array_elements(origens) o where o->>'id'=movimento.id::text;
    conta_nova:=nullif(origem->>'conta_id','')::uuid;
    select c.tipo into tipo_novo from public.gestao_contas c
      where c.id=conta_nova and c.unidade_id=p_unidade and c.ativo;
    if tipo_novo is null or (conta.cartao_id is not null and tipo_novo not in ('caixa','banco')) then
      raise exception 'Selecione uma conta de origem ativa e compatível com o pagamento.';
    end if;
    if conta_nova is distinct from movimento.conta_id and exists(
      select 1 from public.gestao_fin_solicitacoes s
      where s.pagar_id=p_conta and s.status in ('pendente','concluida')
    ) then raise exception 'Cancele ou estorne a solicitação vinculada antes de alterar a origem.';
    end if;
    if conta_nova is distinct from movimento.conta_id and exists(
      select 1 from public.gestao_fin_movimentos outro
      where outro.unidade_id=p_unidade and outro.grupo=movimento.grupo
        and outro.id<>movimento.id and not outro.estornado
    ) then raise exception 'Este pagamento faz parte de um lançamento conjunto. Estorne-o antes de alterar a origem.';
    end if;
    update public.gestao_fin_movimentos set conta_id=conta_nova,descricao=descricao_nova
      where id=movimento.id;
  end loop;

  update public.gestao_contas_pagar set
    descricao=descricao_nova,categoria=categoria_nova,fornecedor=fornecedor_novo,
    observacoes=observacoes_novas,valor=valor_novo,vencimento=vencimento_novo
    where id=p_conta;
  insert into public.gestao_auditoria(empresa_id,usuario_id,acao,registro_id,dados)
    values(empresa,p_ator,'financeiro_pagar_editar_pago',p_conta,
      jsonb_build_object('anterior',to_jsonb(conta),'pagamentos_anteriores',anteriores,'novo',p_dados));
  return p_conta;
end $$;

revoke all on function public.gestao_fin_editar_conta_paga(uuid,uuid,uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.gestao_fin_editar_conta_paga(uuid,uuid,uuid,text,jsonb)
  to service_role;
