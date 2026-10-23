alter table public.perfis
  add column if not exists primeiro_acesso_concluido_em timestamptz,
  add column if not exists senha_inicial_alterada_em timestamptz,
  add column if not exists email_contato_verificado_em timestamptz;

-- Contas existentes continuam operando; a exigência vale para novos cadastros.
update public.perfis
set primeiro_acesso_concluido_em = now()
where primeiro_acesso_concluido_em is null;

create table if not exists public.perfil_email_confirmacoes (
  token_hash text primary key,
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  email text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null
);

create index if not exists perfil_email_confirmacoes_usuario_idx
  on public.perfil_email_confirmacoes (usuario_id, criado_em desc);

alter table public.perfil_email_confirmacoes enable row level security;
revoke all on public.perfil_email_confirmacoes from anon, authenticated;
grant select, insert, delete on public.perfil_email_confirmacoes to service_role;
