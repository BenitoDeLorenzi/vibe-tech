alter table public.empresas
  add column is_prefeitura boolean not null default false;

comment on column public.empresas.is_prefeitura is
  'Identifica uma administração municipal. Classificação explícita no cadastro, sem alterar regras dos módulos.';
