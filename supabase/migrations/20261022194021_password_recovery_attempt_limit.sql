-- Reserva uma tentativa de forma atômica antes de comparar o OTP.
create function public.registrar_tentativa_recuperacao(p_usuario_id uuid)
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
  returning r.token_hash, r.email, r.expira_em, r.tentativas;
$$;

revoke all on function public.registrar_tentativa_recuperacao(uuid) from public, anon, authenticated;
grant execute on function public.registrar_tentativa_recuperacao(uuid) to service_role;
