insert into public.permissoes (modulo_id, chave, nome, descricao)
select id, 'reports.create', 'Gerar relatórios', 'Permite gerar e salvar novos relatórios da frota.'
from public.modulos
where slug = 'frotas-publicas'
on conflict (modulo_id, chave) do update
set nome = excluded.nome, descricao = excluded.descricao;

update public.permissoes
set nome = 'Consultar relatórios',
    descricao = 'Permite consultar e imprimir relatórios já gerados.'
where chave = 'reports.read'
  and modulo_id in (select id from public.modulos where slug = 'frotas-publicas');

update public.permissoes
set descricao = 'Permite gerir produtos, estoque, equipe e fechamentos. O financeiro é exclusivo do Master.'
where chave = 'gestao.manage'
  and modulo_id in (select id from public.modulos where slug = 'gestao-estabelecimentos');

-- Quem já podia gerar relatórios mantém essa capacidade após a separação.
insert into public.usuario_permissoes (usuario_id, permissao_id)
select existing.usuario_id, create_permission.id
from public.usuario_permissoes existing
join public.permissoes read_permission on read_permission.id = existing.permissao_id
join public.permissoes create_permission
  on create_permission.modulo_id = read_permission.modulo_id
 and create_permission.chave = 'reports.create'
where read_permission.chave = 'reports.read'
on conflict (usuario_id, permissao_id) do nothing;
