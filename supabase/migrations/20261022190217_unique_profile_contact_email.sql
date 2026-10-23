-- E-mails de recuperação pertencem a uma única conta não excluída.
-- A comparação ignora maiúsculas/minúsculas e espaços laterais.
create unique index if not exists perfis_email_contato_unico_idx
  on public.perfis (lower(btrim(email_contato)))
  where excluido_em is null and email_contato is not null;
