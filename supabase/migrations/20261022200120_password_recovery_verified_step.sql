alter table public.perfil_senha_recuperacoes
  add column verificado_em timestamptz,
  add column reset_token_hash text,
  add column reset_expira_em timestamptz;

create unique index perfil_senha_recuperacoes_reset_token_hash_key
  on public.perfil_senha_recuperacoes (reset_token_hash)
  where reset_token_hash is not null;

create or replace function public.registrar_tentativa_recuperacao(p_usuario_id uuid)
returns table (token_hash text, email text, expira_em timestamptz, tentativas smallint)
language sql
security invoker
set search_path = ''
as $$
  update public.perfil_senha_recuperacoes as r
  set tentativas = r.tentativas + 1
  where r.usuario_id = p_usuario_id
    and r.tentativas < 5
    and r.expira_em > now()
    and r.verificado_em is null
  returning r.token_hash, r.email, r.expira_em, r.tentativas;
$$;
