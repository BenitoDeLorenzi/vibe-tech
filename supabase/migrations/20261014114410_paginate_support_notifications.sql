create function public.suporte_listar_pagina(p_usuario uuid,p_master boolean,p_empresa uuid default null,p_status text default null,p_busca text default '',p_page integer default 1,p_size integer default 25)
returns jsonb language sql stable security invoker set search_path='' as $$
with autorizadas as (
  select c.*,e.nome as empresa,coalesce(p.nome,c.solicitante_nome) as usuario,
    (select count(*) from public.suporte_mensagens m where m.conversa_id=c.id and m.autor_id is distinct from p_usuario
      and m.id>coalesce((select l.ultima_id from public.suporte_leituras l where l.conversa_id=c.id and l.usuario_id=p_usuario),0)) as novas
  from public.suporte_conversas c join public.empresas e on e.id=c.empresa_id left join public.perfis p on p.id=c.usuario_id
  where exists(select 1 from public.perfis a where a.id=p_usuario and a.ativo is distinct from false and
    ((p_master and a.role='bdl_admin') or (not p_master and c.usuario_id=p_usuario and c.empresa_id=p_empresa and (a.role='bdl_admin' or a.prefeitura_id=p_empresa))))
), filtradas as (
  select * from autorizadas where (p_status is null or status=p_status) and position(lower(p_busca) in lower(concat_ws(' ',assunto,empresa,usuario)))>0
), totals as (select count(*) total,greatest(1,least(p_size,25)) size from filtradas),
chosen as (select *,least(greatest(1,p_page),greatest(1,ceil(total::numeric/size))::integer) page from totals)
select jsonb_build_object('unread',coalesce((select sum(novas) from autorizadas),0),'total',total,'page',page,
  'items',coalesce((select jsonb_agg(to_jsonb(t) order by t.updated_at desc,t.id desc) from
    (select * from filtradas order by updated_at desc,id desc limit chosen.size offset (chosen.page::bigint-1)*chosen.size) t),'[]'::jsonb)) from chosen;
$$;
revoke all on function public.suporte_listar_pagina(uuid,boolean,uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.suporte_listar_pagina(uuid,boolean,uuid,text,text,integer,integer) to service_role;

create function public.frota_notificacoes_pagina(p_empresa uuid,p_usuario uuid,p_tipos text[],p_page integer default 1,p_size integer default 13)
returns jsonb language sql stable security invoker set search_path='' as $$
with permitidas as (
  select * from public.frota_notificacoes where prefeitura_id=p_empresa and tipo=any(p_tipos) and (destinatario_id is null or destinatario_id=p_usuario)
), totals as (select count(*) total,greatest(1,least(p_size,13)) size from permitidas),
chosen as (select *,greatest(1,ceil(total::numeric/size))::integer pages,least(greatest(1,p_page),greatest(1,ceil(total::numeric/size))::integer) page from totals)
select jsonb_build_object('total',total,'page',page,'pageCount',pages,'hasMore',page<pages,
  'unread',(select count(*) from permitidas n where n.autor_id is distinct from p_usuario and not exists(select 1 from public.frota_notificacao_leituras r where r.usuario_id=p_usuario and r.notificacao_id=n.id)),
  'items',coalesce((select jsonb_agg(to_jsonb(t) order by t.id desc) from (
    select n.*,(n.autor_id=p_usuario or exists(select 1 from public.frota_notificacao_leituras r where r.usuario_id=p_usuario and r.notificacao_id=n.id)) is true as lida
    from permitidas n order by n.id desc limit chosen.size offset (chosen.page::bigint-1)*chosen.size
  ) t),'[]'::jsonb)) from chosen;
$$;
revoke all on function public.frota_notificacoes_pagina(uuid,uuid,text[],integer,integer) from public,anon,authenticated;
grant execute on function public.frota_notificacoes_pagina(uuid,uuid,text[],integer,integer) to service_role;
