-- Remove canceled payables from the active list without breaking financial history.
alter table public.gestao_contas_pagar
  add column excluida_em timestamptz;

create or replace view public.gestao_pagar_saldos with (security_invoker=true) as
select p.id, p.unidade_id, p.descricao, p.categoria, p.fornecedor,
  p.observacoes, p.vencimento, p.valor, p.cancelada, p.fechamento_id,
  p.criado_por, p.created_at,
  coalesce((select -sum(m.valor) from public.gestao_fin_movimentos m
    where m.pagar_id=p.id and not m.estornado), 0) as pago,
  p.parcelamento_id, p.parcela_numero, p.parcelas_total,
  p.forma_prevista, p.cartao_id
from public.gestao_contas_pagar p
where p.excluida_em is null;

create function public.gestao_fin_excluir_conta_pagar(
  p_ator uuid, p_unidade uuid, p_conta uuid
) returns void language plpgsql security invoker set search_path='' as $$
declare empresa uuid; conta public.gestao_contas_pagar%rowtype;
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
  if not conta.cancelada then
    raise exception 'Cancele a conta antes de excluí-la.';
  end if;
  if exists(select 1 from public.gestao_fin_solicitacoes
    where pagar_id=p_conta and status='pendente') then
    raise exception 'Cancele as solicitações pendentes antes de excluir a conta.';
  end if;
  update public.gestao_contas_pagar set excluida_em=now() where id=p_conta;
  insert into public.gestao_auditoria(empresa_id,usuario_id,acao,registro_id,dados)
  values(empresa,p_ator,'financeiro_pagar_excluir',p_conta,
    jsonb_build_object('conta',to_jsonb(conta),'exclusao','ocultada; histórico preservado'));
end $$;

revoke all on function public.gestao_fin_excluir_conta_pagar(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.gestao_fin_excluir_conta_pagar(uuid,uuid,uuid) to service_role;
