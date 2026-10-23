alter table public.perfis
  add column if not exists excluido_em timestamptz;

create index if not exists perfis_visiveis_created_at_idx
  on public.perfis (created_at desc)
  where excluido_em is null;

comment on column public.perfis.excluido_em is
  'Exclusão lógica: preserva referências históricas, mas remove o acesso e o cadastro das listagens.';
