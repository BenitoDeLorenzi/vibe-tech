-- Expense edits are atomic and limited to entries without financial activity.
create function public.gestao_fin_editar_conta_pagar(
  p_ator uuid, p_unidade uuid, p_conta uuid, p_escopo text, p_dados jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
declare empresa uuid; conta public.gestao_contas_pagar%rowtype;
  alvos uuid[]; anteriores jsonb; quantidade integer;
  descricao_nova text; categoria_nova text; fornecedor_novo text; observacoes_novas text;
  valor_novo numeric; primeiro_vencimento date; centavos bigint; base bigint; resto integer;
  numero integer; mes date; ultimo_dia integer; vencimento_novo date;
begin
  select empresa_id into empresa from public.gestao_unidades where id=p_unidade;
  if empresa is null
    or gestao_private.papel_gestao(p_ator,empresa) is distinct from 'gestor'
    or not exists(select 1 from public.perfis where id=p_ator and ativo and role::text='bdl_admin')
  then raise exception 'O financeiro é exclusivo do usuário Master com acesso vigente à unidade.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_unidade::text||':financeiro',0));
  select * into conta from public.gestao_contas_pagar
  where id=p_conta and unidade_id=p_unidade for update;
  if not found or conta.cancelada or conta.excluida_em is not null or conta.fechamento_id is not null then
    raise exception 'Esta conta não pode ser editada.';
  end if;
  if p_escopo not in ('uma','todas') or p_escopo is null then
    raise exception 'Escolha quais parcelas deseja editar.';
  end if;
  if p_escopo='todas' and conta.parcelamento_id is null then
    raise exception 'Esta conta não pertence a um parcelamento.';
  end if;

  if p_escopo='todas' then
    perform 1 from public.gestao_contas_pagar p
    where p.unidade_id=p_unidade and p.parcelamento_id=conta.parcelamento_id for update;
    select array_agg(p.id order by p.parcela_numero),
      jsonb_agg(to_jsonb(p) order by p.parcela_numero), count(*)::integer
    into alvos,anteriores,quantidade
    from public.gestao_contas_pagar p
    where p.unidade_id=p_unidade and p.parcelamento_id=conta.parcelamento_id;
    if quantidade<>conta.parcelas_total then
      raise exception 'O parcelamento está incompleto e não pode ser editado em conjunto.';
    end if;
  else
    alvos:=array[conta.id];
    anteriores:=jsonb_build_array(to_jsonb(conta));
    quantidade:=1;
  end if;
  if exists(select 1 from public.gestao_contas_pagar p where p.id=any(alvos)
    and (p.cancelada or p.excluida_em is not null or p.fechamento_id is not null))
    or exists(select 1 from public.gestao_fin_movimentos m where m.pagar_id=any(alvos))
    or exists(select 1 from public.gestao_fin_solicitacoes s where s.pagar_id=any(alvos))
  then raise exception 'Há parcelas canceladas ou com histórico financeiro. Edite apenas contas sem pagamentos ou solicitações.';
  end if;

  descricao_nova:=trim(coalesce(p_dados->>'descricao',''));
  fornecedor_novo:=trim(coalesce(p_dados->>'fornecedor',''));
  observacoes_novas:=trim(coalesce(p_dados->>'observacoes',''));
  valor_novo:=nullif(p_dados->>'valor','')::numeric;
  primeiro_vencimento:=nullif(p_dados->>'vencimento','')::date;
  select c.nome into categoria_nova from public.gestao_fin_categorias c
  where c.unidade_id=p_unidade and c.ativo and c.nome<>'Fechamento'
    and gestao_private.normalizar_categoria_financeira(c.nome)=
      gestao_private.normalizar_categoria_financeira(p_dados->>'categoria');
  if length(descricao_nova) not between 2 and 200
    or length(fornecedor_novo)>120 or length(observacoes_novas)>2000
    or categoria_nova is null or primeiro_vencimento is null
    or valor_novo is null or valor_novo::text in ('NaN','Infinity','-Infinity')
    or valor_novo<=0 or valor_novo>=1000000000 or valor_novo<>round(valor_novo,2)
  then raise exception 'Confira descrição, categoria, valor e vencimento.';
  end if;
  centavos:=(valor_novo*100)::bigint;
  if centavos<quantidade then
    raise exception 'O valor total deve permitir pelo menos R$ 0,01 por parcela.';
  end if;

  if p_escopo='uma' then
    update public.gestao_contas_pagar set
      descricao=descricao_nova,categoria=categoria_nova,fornecedor=fornecedor_novo,
      observacoes=observacoes_novas,valor=valor_novo,vencimento=primeiro_vencimento
    where id=p_conta;
  else
    base:=centavos/quantidade;
    resto:=mod(centavos,quantidade)::integer;
    for numero in 1..quantidade loop
      mes:=(date_trunc('month',primeiro_vencimento)::date + make_interval(months=>numero-1))::date;
      ultimo_dia:=extract(day from (mes+interval '1 month - 1 day'))::integer;
      vencimento_novo:=mes+least(extract(day from primeiro_vencimento)::integer,ultimo_dia)-1;
      update public.gestao_contas_pagar set
        descricao=descricao_nova,categoria=categoria_nova,fornecedor=fornecedor_novo,
        observacoes=observacoes_novas,
        valor=(base+case when numero<=resto then 1 else 0 end)/100.0,
        vencimento=vencimento_novo
      where id=alvos[numero];
    end loop;
  end if;
  insert into public.gestao_auditoria(empresa_id,usuario_id,acao,registro_id,dados)
  values(empresa,p_ator,'financeiro_pagar_editar',p_conta,
    p_dados||jsonb_build_object('escopo',p_escopo,'anteriores',anteriores));
  return p_conta;
end $$;
revoke all on function public.gestao_fin_editar_conta_pagar(uuid,uuid,uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.gestao_fin_editar_conta_pagar(uuid,uuid,uuid,text,jsonb)
  to service_role;
