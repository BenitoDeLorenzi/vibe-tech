-- Totals since financial activation. Transfers, initial balances and capital
-- adjustments are excluded from revenue and expense totals.
create function public.gestao_fin_totais_contas(p_ator uuid, p_unidade uuid)
returns table(receitas numeric, despesas numeric)
language plpgsql security invoker set search_path='' as $$
declare empresa uuid;
begin
  select empresa_id into empresa from public.gestao_unidades where id=p_unidade;
  if empresa is null
    or gestao_private.papel_gestao(p_ator,empresa) is distinct from 'gestor'
    or not exists(select 1 from public.perfis where id=p_ator and ativo and role::text='bdl_admin')
  then raise exception 'O financeiro é exclusivo do usuário Master com acesso vigente à unidade.';
  end if;

  return query
    select
      coalesce(sum(m.valor) filter (where m.tipo='venda' and m.valor>0),0),
      coalesce(-sum(m.valor) filter (where m.tipo in ('despesa','equipe') and m.valor<0),0)
    from public.gestao_fin_movimentos m
    where m.unidade_id=p_unidade and not m.estornado;
end $$;

revoke all on function public.gestao_fin_totais_contas(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gestao_fin_totais_contas(uuid,uuid) to service_role;
