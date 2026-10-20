-- No default departments: all new records are explicitly registered by users.
alter table public.frota_secretarias enable row level security;
create unique index frota_secretarias_normalized_nome_idx
  on public.frota_secretarias (prefeitura_id, lower(regexp_replace(btrim(nome), '\s+', ' ', 'g')));
alter table public.frota_secretarias add constraint frota_secretarias_id_empresa_key unique (id, prefeitura_id);
alter table public.frota_veiculos add column secretaria_id uuid;
alter table public.frota_veiculos add constraint frota_veiculos_secretaria_empresa_fkey
  foreign key (secretaria_id, prefeitura_id) references public.frota_secretarias(id, prefeitura_id) on delete restrict;
create index frota_veiculos_secretaria_empresa_idx on public.frota_veiculos(secretaria_id, prefeitura_id);

-- Only preserve existing explicit matches; never infer the municipal flag or create records.
update public.frota_veiculos v set secretaria_id = s.id
from public.frota_secretarias s, public.empresas e
where v.prefeitura_id = s.prefeitura_id and e.id = s.prefeitura_id and e.is_prefeitura
  and lower(regexp_replace(btrim(v.secretaria), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(s.nome), '\s+', ' ', 'g'));

create function public.validate_frota_secretaria() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.empresas where id = new.prefeitura_id and is_prefeitura) then
    raise exception 'Secretarias são exclusivas de prefeituras.' using errcode = '23514';
  end if;
  new.nome := regexp_replace(btrim(new.nome), '\s+', ' ', 'g');
  if char_length(new.nome) not between 2 and 120 then
    raise exception 'Nome de secretaria inválido.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validate_frota_secretaria before insert or update of nome, prefeitura_id on public.frota_secretarias
for each row execute function public.validate_frota_secretaria();

create function public.validate_vehicle_secretaria() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.secretaria_id is null then
    new.secretaria := null;
    return new;
  end if;
  if not exists (select 1 from public.empresas where id = new.prefeitura_id and is_prefeitura) then
    raise exception 'Somente prefeituras podem vincular veículos a secretarias.' using errcode = '23514';
  end if;
  select nome into new.secretaria from public.frota_secretarias
    where id = new.secretaria_id and prefeitura_id = new.prefeitura_id for share;
  if not found then
    raise exception 'Secretaria não pertence à prefeitura do veículo.' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger validate_vehicle_secretaria before insert or update of secretaria_id, prefeitura_id on public.frota_veiculos
for each row execute function public.validate_vehicle_secretaria();

-- Keep the legacy display field in sync for reports and fuel documents.
create function public.sync_secretaria_vehicle_name() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.frota_veiculos set secretaria = new.nome where secretaria_id = new.id and prefeitura_id = new.prefeitura_id;
  return new;
end;
$$;
create trigger sync_secretaria_vehicle_name after update of nome on public.frota_secretarias
for each row when (old.nome is distinct from new.nome) execute function public.sync_secretaria_vehicle_name();
