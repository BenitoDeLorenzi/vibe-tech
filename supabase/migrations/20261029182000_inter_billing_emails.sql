alter table public.inter_cobrancas add column email_automatico boolean not null default true;
alter table public.inter_cobrancas add column origem_recebimento text;
update public.inter_cobrancas set email_automatico=false;

create table public.inter_cobranca_emails (
  id uuid primary key default gen_random_uuid(),
  inter_cobranca_id uuid not null references public.inter_cobrancas(id) on delete cascade,
  tipo text not null check (tipo in ('boleto_empresa','pagamento_vibe')),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','skipped')),
  destinatario text,
  tentativas integer not null default 0,
  ultimo_erro text,
  ultima_tentativa_em timestamptz,
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(inter_cobranca_id,tipo)
);
create index inter_cobranca_emails_pendentes_idx on public.inter_cobranca_emails(status,created_at)
 where status in ('pending','failed');
alter table public.inter_cobranca_emails enable row level security;
revoke all on public.inter_cobranca_emails from anon,authenticated;
grant all on public.inter_cobranca_emails to service_role;

create function public.queue_inter_billing_emails() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if not new.email_automatico or new.situacao is not distinct from old.situacao then return new; end if;
 if new.situacao in ('A_RECEBER','ATRASADO') and old.situacao is distinct from 'A_RECEBER' then
  insert into public.inter_cobranca_emails(inter_cobranca_id,tipo)
  values(new.id,'boleto_empresa') on conflict do nothing;
 end if;
 if new.situacao='RECEBIDO' then
  insert into public.inter_cobranca_emails(inter_cobranca_id,tipo)
  values(new.id,'pagamento_vibe') on conflict do nothing;
 end if;
 return new;
end $$;
create trigger inter_billing_emails_trigger
after update on public.inter_cobrancas
for each row execute function public.queue_inter_billing_emails();

create function public.claim_inter_billing_email(p_id uuid)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare claimed uuid;
begin
 update public.inter_cobranca_emails set status='sending',tentativas=tentativas+1,
  ultima_tentativa_em=now(),updated_at=now(),ultimo_erro=null
 where id=p_id and status in ('pending','failed') and tentativas<5
 returning id into claimed;
 return claimed;
end $$;
revoke all on function public.claim_inter_billing_email(uuid) from public,anon,authenticated;
grant execute on function public.claim_inter_billing_email(uuid) to service_role;
