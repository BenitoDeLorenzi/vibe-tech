-- Only the trusted server can invoke these functions after authorizing the company.
create or replace function public.frota_lista_pagina(p_lista text, p_empresa uuid, p_busca text default '', p_status text default '', p_tipo text default '', p_registro text default '', p_page integer default 1, p_size integer default 10)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  tbl text; joins text := ''; search_expr text; ordering text := 't.created_at desc,t.id desc';
  status_expr text := 't.status'; extra text := 'true'; in_use text := 'false'; result jsonb;
begin
  if p_empresa is null or p_page < 1 or p_size < 1 or p_size > 50 then raise exception 'Invalid page'; end if;
  case p_lista
  when 'veiculos' then
    tbl := 'frota_veiculos';
    search_expr := 'concat_ws('' '',t.placa,t.prefixo,t.marca,t.modelo,t.tipo,t.versao,t.combustivel,t.cor,t.categoria,t.chassi,t.placa_anterior,t.municipio_emplacamento,t.local_registro,t.situacao_veicular,t.licenciado,t.proprietario_atual)';
  when 'uso-veiculo' then
    tbl := 'frota_uso_veiculos'; joins := 'left join public.frota_veiculos v on v.id=t.veiculo_id';
    search_expr := 'concat_ws('' '',v.placa,v.modelo,v.marca,t.funcionario_nome,t.funcionario_cpf,t.destino,t.finalidade)';
    ordering := 't.data_saida desc,t.created_at desc,t.id desc';
  when 'manutencao' then
    tbl := 'frota_manutencoes'; joins := 'left join public.frota_veiculos v on v.id=t.veiculo_id';
    search_expr := 'concat_ws('' '',v.placa,v.marca,v.modelo,t.tipo,t.descricao,t.oficina,t.responsavel)';
    ordering := 't.data_entrada desc,t.created_at desc,t.id desc';
  when 'abastecimento' then
    tbl := 'frota_abastecimentos'; joins := 'left join public.frota_veiculos v on v.id=t.veiculo_id';
    search_expr := 'concat_ws('' '',t.numero_ordem,v.placa,v.marca,v.modelo,t.motorista,t.fornecedor)';
    ordering := 't.data_abastecimento desc,t.created_at desc,t.id desc';
    status_expr := 'case when t.status=''issued'' and t.expires_at <= now() then ''expired'' else t.status end';
  when 'secretarias' then tbl := 'frota_secretarias'; search_expr := 't.nome'; ordering := 't.nome,t.id';
  when 'oficinas' then
    tbl := 'frota_oficinas'; search_expr := 'concat_ws('' '',t.nome,t.documento,t.telefone,t.responsavel,t.endereco,t.especialidades)'; ordering := 't.nome,t.id';
  when 'postos' then
    tbl := 'frota_postos_credenciados'; joins := 'left join public.empresas e on e.id=t.prefeitura_id';
    search_expr := 'concat_ws('' '',t.nome,t.cnpj,t.telefone,t.endereco,e.nome)';
  when 'motoristas' then
    tbl := 'frota_motoristas'; joins := 'left join public.empresas e on e.id=t.prefeitura_id';
    search_expr := 'concat_ws('' '',t.nome,t.cpf,e.nome,(select string_agg(concat_ws('' '',v.modelo,v.placa),'' '') from public.frota_uso_veiculos u join public.frota_veiculos v on v.id=u.veiculo_id where u.motorista_id=t.id and u.status=''in_use''))';
    extra := 't.cpf is not null and t.cpf <> ''''';
    in_use := 'exists(select 1 from public.frota_uso_veiculos u where u.motorista_id=t.id and u.status=''in_use'')';
  when 'relatorios' then
    tbl := 'frota_relatorios'; joins := 'left join public.empresas e on e.id=t.prefeitura_id left join public.perfis p on p.id=t.criado_por';
    search_expr := 'concat_ws('' '',t.titulo,e.nome,p.nome,case t.tipo when ''fuel'' then ''Abastecimentos'' when ''maintenance'' then ''Manutenções'' when ''vehicles'' then ''Veículos'' else ''Vencimentos'' end)';
    extra := '($5 in ('''',''all'') or t.tipo=$5)';
  else raise exception 'Invalid list';
  end case;
  execute format($query$
    with filtered as materialized (
      select t.id, %s as status, %s as em_uso, row_number() over(order by %s) as position
      from public.%I t %s where t.prefeitura_id=$1 and (%s)
      and ($3 in ('','all') or (%s)=$3) and ($6='' or t.id::text=$6)
      and ($2='' or position(translate(lower($2),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') in translate(lower(%s),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'))>0
        or ($7 and regexp_replace($2,'[^0-9]','','g')<>'' and position(regexp_replace($2,'[^0-9]','','g') in regexp_replace(%s,'[^0-9]','','g'))>0))
    ), totals as (select count(*) as total,greatest(1,ceil(count(*)::numeric/$4))::integer as pages from filtered),
    chosen as (select least($8,pages) as page,pages,total from totals)
    select jsonb_build_object('ids',coalesce((select jsonb_agg(id order by position) from filtered,chosen where position>(page::bigint-1)*$4 and position<=page::bigint*$4),'[]'::jsonb),
      'page',page,'pageCount',pages,'total',total,
      'statuses',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from filtered group by status) s),'{}'::jsonb),
      'inUse',(select count(*) from filtered where em_uso)) from chosen
  $query$,status_expr,in_use,ordering,tbl,joins,extra,status_expr,search_expr,search_expr)
  into result using p_empresa,trim(coalesce(p_busca,'')),coalesce(p_status,''),p_size,coalesce(p_tipo,''),coalesce(p_registro,''),p_lista in ('motoristas','oficinas','uso-veiculo','postos'),p_page;
  return result;
end $$;
revoke all on function public.frota_lista_pagina(text,uuid,text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.frota_lista_pagina(text,uuid,text,text,text,text,integer,integer) to service_role;

create or replace function public.frota_motoristas_resumo(p_ids uuid[])
returns jsonb language sql stable security invoker set search_path='' as $$
select coalesce(jsonb_object_agg(m.id,jsonb_build_object('total',s.total,'emUso',s.em_uso,'ultimoUso',s.ultimo,'veiculoAtual',a.veiculo)),'{}'::jsonb)
from public.frota_motoristas m
cross join lateral (select count(*) total,coalesce(bool_or(u.status='in_use'),false) em_uso,max(u.data_saida) ultimo from public.frota_uso_veiculos u where u.motorista_id=m.id) s
left join lateral (select concat_ws(' · ',v.modelo,v.placa) veiculo from public.frota_uso_veiculos u join public.frota_veiculos v on v.id=u.veiculo_id where u.motorista_id=m.id and u.status='in_use' order by u.data_saida desc,u.id desc limit 1) a on true
where m.id=any(p_ids)
$$;
revoke all on function public.frota_motoristas_resumo(uuid[]) from public,anon,authenticated;
grant execute on function public.frota_motoristas_resumo(uuid[]) to service_role;

create or replace function public.frota_consumo_pagina(p_ids uuid[])
returns jsonb language sql stable security invoker set search_path='' as $$
select coalesce(jsonb_object_agg(t.id,case when t.quilometragem>p.quilometragem then round((t.quilometragem-p.quilometragem)::numeric/t.litros,2) else null end),'{}'::jsonb)
from public.frota_abastecimentos t
left join lateral (select a.quilometragem from public.frota_abastecimentos a where a.veiculo_id=t.veiculo_id and a.status='completed' and a.quilometragem>0 and a.litros>0 and (coalesce(a.completed_at,a.created_at),a.id)<(coalesce(t.completed_at,t.created_at),t.id) order by coalesce(a.completed_at,a.created_at) desc,a.id desc limit 1) p on true
where t.id=any(p_ids) and t.status='completed' and t.quilometragem>0 and t.litros>0
$$;
revoke all on function public.frota_consumo_pagina(uuid[]) from public,anon,authenticated;
grant execute on function public.frota_consumo_pagina(uuid[]) to service_role;

create index if not exists frota_veiculos_list_idx on public.frota_veiculos(prefeitura_id,created_at desc,id desc);
create index if not exists frota_uso_list_idx on public.frota_uso_veiculos(prefeitura_id,data_saida desc,created_at desc,id desc);
create index if not exists frota_manutencoes_list_idx on public.frota_manutencoes(prefeitura_id,data_entrada desc,created_at desc,id desc);
create index if not exists frota_abastecimentos_list_idx on public.frota_abastecimentos(prefeitura_id,data_abastecimento desc,created_at desc,id desc);
create index if not exists frota_motoristas_list_idx on public.frota_motoristas(prefeitura_id,created_at desc,id desc);
create index if not exists frota_postos_list_idx on public.frota_postos_credenciados(prefeitura_id,created_at desc,id desc);
create index if not exists frota_relatorios_list_idx on public.frota_relatorios(prefeitura_id,created_at desc,id desc);
create index if not exists frota_oficinas_list_idx on public.frota_oficinas(prefeitura_id,nome,id);
create index if not exists frota_secretarias_list_idx on public.frota_secretarias(prefeitura_id,nome,id);
create index if not exists frota_uso_motorista_list_idx on public.frota_uso_veiculos(motorista_id,data_saida desc,id desc);
create index if not exists frota_consumo_previous_idx on public.frota_abastecimentos(veiculo_id,(coalesce(completed_at,created_at)) desc,id desc) where status='completed' and quilometragem>0 and litros>0;
