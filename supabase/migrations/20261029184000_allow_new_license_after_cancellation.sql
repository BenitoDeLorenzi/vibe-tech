-- Preserve cancelled licenses and their financial history while allowing a
-- fresh license for the same company and module.
alter table public.licencas
  drop constraint licencas_prefeitura_id_modulo_id_key;

create unique index licencas_empresa_modulo_nao_cancelada_key
  on public.licencas (prefeitura_id, modulo_id)
  where status <> 'cancelled';
