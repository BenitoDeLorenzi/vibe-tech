create table if not exists public.perfil_senha_recuperacoes (
  usuario_id uuid primary key references public.perfis(id) on delete cascade,
  token_hash text not null,
  email text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  tentativas smallint not null default 0 check (tentativas between 0 and 5)
);

alter table public.perfil_senha_recuperacoes enable row level security;
revoke all on public.perfil_senha_recuperacoes from anon, authenticated;
grant select, insert, update, delete on public.perfil_senha_recuperacoes to service_role;
