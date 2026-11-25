-- Hide a payable directly while retaining ledger movements and audit history.
-- Optionally cancel later, still unpaid installments in the same group.
drop function if exists public.gestao_fin_excluir_conta_pagar(uuid, uuid, uuid);

create function public.gestao_fin_excluir_conta_pagar(
  p_ator uuid, p_unidade uuid, p_conta uuid, p_demais boolean
) returns void language plpgsql security invoker set search_path='' as $$
declare
  empresa uuid;
  conta public.gestao_contas_pagar%rowtype;
  parcelas_canceladas uuid[] := array[]::uuid[];
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
  if not found or conta.excluida_em is not null then
    raise exception 'Conta não encontrada ou já excluída.';
  end if;
  if conta.fechamento_id is not null then
    raise exception 'Esta conta pertence a um fechamento e não pode ser excluída aqui.';
  end if;
  if exists(select 1 from public.gestao_fin_solicitacoes
    where pagar_id=p_conta and status='pendente') then
    raise exception 'Cancele as solicitações pendentes antes de excluir a conta.';
  end if;

  if p_demais then
    if conta.parcelamento_id is null then
      raise exception 'Esta conta não pertence a um parcelamento.';
    end if;
    perform 1 from public.gestao_contas_pagar p
      where p.unidade_id=p_unidade and p.parcelamento_id=conta.parcelamento_id
        and p.parcela_numero>conta.parcela_numero and p.excluida_em is null
      for update;
    if exists(
      select 1 from public.gestao_contas_pagar p
      where p.unidade_id=p_unidade and p.parcelamento_id=conta.parcelamento_id
        and p.parcela_numero>conta.parcela_numero and p.excluida_em is null
        and not p.cancelada and (
          p.fechamento_id is not null
          or exists(select 1 from public.gestao_fin_movimentos m where m.pagar_id=p.id and not m.estornado)
          or exists(select 1 from public.gestao_fin_solicitacoes s where s.pagar_id=p.id and s.status='pendente')
        )
    ) then
      raise exception 'Há parcelas seguintes pagas, vinculadas a fechamento ou com solicitação pendente. Trate-as antes de cancelar as demais.';
    end if;
    select coalesce(array_agg(p.id), array[]::uuid[]) into parcelas_canceladas
      from public.gestao_contas_pagar p
      where p.unidade_id=p_unidade and p.parcelamento_id=conta.parcelamento_id
        and p.parcela_numero>conta.parcela_numero and p.excluida_em is null
        and not p.cancelada;
    update public.gestao_contas_pagar p set cancelada=true
      where p.unidade_id=p_unidade and p.parcelamento_id=conta.parcelamento_id
        and p.parcela_numero>conta.parcela_numero and p.excluida_em is null
        and not p.cancelada;
  end if;

  update public.gestao_contas_pagar set cancelada=true, excluida_em=now() where id=p_conta;
  insert into public.gestao_auditoria(empresa_id,usuario_id,acao,registro_id,dados)
  values(empresa,p_ator,'financeiro_pagar_excluir',p_conta,
    jsonb_build_object('conta',to_jsonb(conta),'exclusao','ocultada; histórico preservado',
      'cancelar_parcelas_seguintes',p_demais,'parcelas_canceladas',parcelas_canceladas));
end $$;

revoke all on function public.gestao_fin_excluir_conta_pagar(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.gestao_fin_excluir_conta_pagar(uuid,uuid,uuid,boolean) to service_role;
