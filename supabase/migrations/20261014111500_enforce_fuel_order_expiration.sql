create or replace function public.prevent_expired_fuel_order_completion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'issued'
    and new.status = 'completed'
    and old.expires_at is not null
    and old.expires_at <= now() then
    raise exception 'Esta ordem venceu. Emita uma nova ordem de abastecimento para o veículo.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists frota_abastecimentos_prevent_expired_completion
  on public.frota_abastecimentos;

create trigger frota_abastecimentos_prevent_expired_completion
before update of status on public.frota_abastecimentos
for each row
execute function public.prevent_expired_fuel_order_completion();

update public.frota_abastecimentos
set status = 'expired', updated_at = now()
where status = 'issued'
  and expires_at is not null
  and expires_at <= now();
