-- Correct the classification of a paid expense without touching its settlement.
create function public.gestao_fin_editar_categoria_conta_paga(
  p_ator uuid, p_unidade uuid, p_conta uuid, p_escopo text, p_categoria text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare empresa uuid; conta public.gestao_contas_pagar%rowtype;
  categoria_nova text; alvos uuid[]; anteriores jsonb;
begin
  select empresa_id into empresa from public.gestao_unidades where id=p_unidade;
  if empresa is null
    or gestao_private.papel_gestao(p_ator,empresa) is distinct from 'gestor'
    or not exists(select 1 from public.perfis where id=p_ator and ativo and role::text='bdl_admin')
  then raise exception 'O financeiro é exclusivo do usuário Master com acesso vigente à unidade.';
  end if;
  if p_escopo not in ('uma','todas') or p_escopo is null then
    raise exception 'Escolha quais parcelas deseja alterar.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_unidade::text||':financeiro',0));
  select * into conta from public.gestao_contas_pagar
  where id=p_conta and unidade_id=p_unidade for update;
  if not found or conta.cancelada or conta.excluida_em is not null or conta.fechamento_id is not null then
    raise exception 'Esta conta não pode ser alterada.';
  end if;
  if p_escopo='todas' then
    if conta.parcelamento_id is null then
      raise exception 'Esta conta não pertence a um parcelamento.';
    end if;
    perform 1 from public.gestao_contas_pagar p
    where p.unidade_id=p_unidade and p.parcelamento_id=conta.parcelamento_id for update;
    select array_agg(p.id), jsonb_agg(to_jsonb(p)) into alvos, anteriores
    from public.gestao_contas_pagar p
    where p.unidade_id=p_unidade and p.parcelamento_id=conta.parcelamento_id;
    if cardinality(alvos)<>conta.parcelas_total then
      raise exception 'O parcelamento está incompleto.';
    end if;
  else
    alvos:=array[conta.id];
    anteriores:=jsonb_build_array(to_jsonb(conta));
  end if;
  if exists(select 1 from public.gestao_contas_pagar p where p.id=any(alvos)
    and (p.cancelada or p.excluida_em is not null or p.fechamento_id is not null)) then
    raise exception 'Há parcelas canceladas ou incluídas em fechamento.';
  end if;
  select c.nome into categoria_nova from public.gestao_fin_categorias c
  where c.unidade_id=p_unidade and c.ativo and c.nome<>'Fechamento'
    and gestao_private.normalizar_categoria_financeira(c.nome)=
      gestao_private.normalizar_categoria_financeira(p_categoria);
  if categoria_nova is null then raise exception 'Escolha uma categoria ativa.'; end if;
  update public.gestao_contas_pagar set categoria=categoria_nova where id=any(alvos);
  insert into public.gestao_auditoria(empresa_id,usuario_id,acao,registro_id,dados)
  values(empresa,p_ator,'financeiro_pagar_editar_categoria',p_conta,
    jsonb_build_object('escopo',p_escopo,'categoria_nova',categoria_nova,'anteriores',anteriores));
  return p_conta;
end $$;
revoke all on function public.gestao_fin_editar_categoria_conta_paga(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.gestao_fin_editar_categoria_conta_paga(uuid,uuid,uuid,text,text)
  to service_role;
