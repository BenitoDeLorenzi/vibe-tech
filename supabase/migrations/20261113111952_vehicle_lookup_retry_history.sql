-- Keep the provider response and protocol after a vehicle is removed. The
-- dependent vehicle data continues to follow its own deletion rules.
alter table public.frota_debito_consultas
  alter column veiculo_id drop not null;

alter table public.frota_debito_consultas
  drop constraint frota_debito_consultas_veiculo_id_fkey;

alter table public.frota_debito_consultas
  add constraint frota_debito_consultas_veiculo_id_fkey
  foreign key (veiculo_id) references public.frota_veiculos(id) on delete set null;

create index if not exists frota_debito_consultas_historico_placa_idx
  on public.frota_debito_consultas (prefeitura_id, license_plate, created_at desc)
  where provider = 'plexi';
