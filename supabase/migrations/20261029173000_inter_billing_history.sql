alter table public.inter_cobrancas add column cancelado_por uuid references public.perfis(id) on delete set null;

create table public.inter_cobranca_eventos (
  id uuid primary key default gen_random_uuid(),
  inter_cobranca_id uuid not null references public.inter_cobrancas(id) on delete cascade,
  autor_id uuid references public.perfis(id) on delete set null,
  tipo text not null,
  situacao text,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index inter_cobranca_eventos_boleto_idx on public.inter_cobranca_eventos(inter_cobranca_id,created_at);
alter table public.inter_cobranca_eventos enable row level security;
revoke all on public.inter_cobranca_eventos from anon,authenticated;
grant all on public.inter_cobranca_eventos to service_role;

insert into public.inter_cobranca_eventos(inter_cobranca_id,autor_id,tipo,detalhes,created_at)
select id,criado_por,'emissao_iniciada',jsonb_build_object('valor',valor,'vencimento',vencimento),created_at
from public.inter_cobrancas;
insert into public.inter_cobranca_eventos(inter_cobranca_id,autor_id,tipo,detalhes,created_at)
select id,criado_por,'emissao_solicitada',jsonb_build_object('codigo_solicitacao',codigo_solicitacao),updated_at
from public.inter_cobrancas where codigo_solicitacao is not null;
insert into public.inter_cobranca_eventos(inter_cobranca_id,tipo,situacao,created_at)
select id,'situacao_inter',situacao,coalesce(consultado_em,updated_at)
from public.inter_cobrancas where situacao is not null;

create function public.log_inter_cobranca_evento() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' then
  insert into public.inter_cobranca_eventos(inter_cobranca_id,autor_id,tipo,detalhes)
  values(new.id,new.criado_por,'emissao_iniciada',jsonb_build_object('valor',new.valor,'vencimento',new.vencimento));
  return new;
 end if;
 if new.codigo_solicitacao is distinct from old.codigo_solicitacao and new.codigo_solicitacao is not null then
  insert into public.inter_cobranca_eventos(inter_cobranca_id,autor_id,tipo,detalhes)
  values(new.id,new.criado_por,'emissao_solicitada',jsonb_build_object('codigo_solicitacao',new.codigo_solicitacao));
 end if;
 if new.status='cancelling' and old.status is distinct from new.status then
  insert into public.inter_cobranca_eventos(inter_cobranca_id,autor_id,tipo,detalhes)
  values(new.id,new.cancelado_por,'cancelamento_solicitado',jsonb_build_object('motivo',new.cancelamento_motivo));
 end if;
 if new.situacao is distinct from old.situacao and new.situacao is not null then
  insert into public.inter_cobranca_eventos(inter_cobranca_id,tipo,situacao,detalhes)
  values(new.id,'situacao_inter',new.situacao,jsonb_build_object('anterior',old.situacao));
 end if;
 if new.status in ('failed','uncertain') and old.status is distinct from new.status then
  insert into public.inter_cobranca_eventos(inter_cobranca_id,tipo,detalhes)
  values(new.id,'emissao_pendente',jsonb_build_object('status',new.status,'erro',new.erro));
 end if;
 return new;
end $$;
create trigger inter_cobranca_eventos_trigger
after insert or update on public.inter_cobrancas
for each row execute function public.log_inter_cobranca_evento();
