alter table public.frota_postos_credenciados
  add column email_contato text,
  add column email_verificado_em timestamptz,
  add column primeiro_acesso_concluido_em timestamptz;

-- Postos já em operação mantêm o acesso; novos postos concluem a ativação.
update public.frota_postos_credenciados
set primeiro_acesso_concluido_em = now()
where senha_hash is not null;

create unique index frota_postos_email_contato_unique
  on public.frota_postos_credenciados (lower(email_contato))
  where email_contato is not null;

create table public.frota_posto_codigos (
  posto_id uuid primary key references public.frota_postos_credenciados(id) on delete cascade,
  finalidade text not null check (finalidade in ('primeiro_acesso', 'recuperacao')),
  email text not null,
  codigo_hash text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  tentativas smallint not null default 0 check (tentativas between 0 and 5),
  verificado_em timestamptz,
  reset_token_hash text,
  reset_expira_em timestamptz
);

create unique index frota_posto_codigos_reset_token_unique
  on public.frota_posto_codigos (reset_token_hash)
  where reset_token_hash is not null;

alter table public.frota_posto_codigos enable row level security;
revoke all on public.frota_posto_codigos from anon, authenticated;
grant select, insert, update, delete on public.frota_posto_codigos to service_role;

create function public.registrar_tentativa_codigo_posto(p_posto_id uuid, p_finalidade text)
returns table (codigo_hash text, email text, tentativas smallint)
language sql security invoker set search_path = '' as $$
  update public.frota_posto_codigos as c
  set tentativas = c.tentativas + 1
  where c.posto_id = p_posto_id and c.finalidade = p_finalidade
    and c.tentativas < 5 and c.expira_em > now() and c.verificado_em is null
  returning c.codigo_hash, c.email, c.tentativas;
$$;
revoke all on function public.registrar_tentativa_codigo_posto(uuid, text) from public, anon, authenticated;
grant execute on function public.registrar_tentativa_codigo_posto(uuid, text) to service_role;
