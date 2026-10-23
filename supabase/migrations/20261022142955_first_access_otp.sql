alter table public.perfil_email_confirmacoes
  add column if not exists tentativas smallint not null default 0;

grant update on public.perfil_email_confirmacoes to service_role;
