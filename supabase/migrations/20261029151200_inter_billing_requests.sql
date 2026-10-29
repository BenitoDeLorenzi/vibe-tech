create table public.inter_cobrancas (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null unique references public.licenca_pagamentos(id) on delete restrict,
  seu_numero text not null unique,
  codigo_solicitacao text unique,
  status text not null default 'submitting' check (status in ('submitting','submitted','uncertain')),
  valor numeric(12,2) not null check (valor > 0),
  vencimento date not null,
  criado_por uuid references public.perfis(id) on delete set null,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inter_cobrancas_status_idx on public.inter_cobrancas(status,created_at);
alter table public.inter_cobrancas enable row level security;
revoke all on public.inter_cobrancas from anon, authenticated;
grant all on public.inter_cobrancas to service_role;
