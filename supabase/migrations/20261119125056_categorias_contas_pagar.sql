-- Categories for accounts payable are scoped to each financial unit.
create table public.gestao_fin_categorias (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.gestao_unidades(id),
  nome text not null check (length(trim(nome)) between 2 and 100),
  ativo boolean not null default true,
  sistema boolean not null default false,
  created_at timestamptz not null default now(),
  unique(id, unidade_id)
);
create unique index gestao_fin_categorias_nome_idx
  on public.gestao_fin_categorias(unidade_id, lower(trim(nome)));
create index gestao_fin_categorias_unidade_idx
  on public.gestao_fin_categorias(unidade_id, ativo);
alter table public.gestao_fin_categorias enable row level security;
revoke all on public.gestao_fin_categorias from public, anon, authenticated;
grant select on public.gestao_fin_categorias to authenticated;
grant all on public.gestao_fin_categorias to service_role;
create policy gestao_fin_categorias_master on public.gestao_fin_categorias
  for select to authenticated using (
    (select gestao_private.fin_master()) and unidade_id in (
      select u.id from public.gestao_unidades u
      where u.empresa_id in (select gestao_private.empresas_equipe())
    )
  );

create function gestao_private.criar_categorias_financeiras() returns trigger
language plpgsql set search_path='' as $$
declare nome_padrao text;
begin
  foreach nome_padrao in array array[
    'Fornecedores', 'Aluguel', 'Energia e água', 'Internet e telefone',
    'Manutenção', 'Serviços', 'Impostos', 'Outras despesas', 'Fechamento'
  ] loop
    insert into public.gestao_fin_categorias(unidade_id, nome, sistema)
    values (new.unidade_id, nome_padrao, nome_padrao in ('Outras despesas', 'Fechamento'))
    on conflict do nothing;
  end loop;
  return new;
end $$;
create trigger gestao_fin_categorias_iniciais after insert on public.gestao_fin_config
for each row execute function gestao_private.criar_categorias_financeiras();

insert into public.gestao_fin_categorias(unidade_id, nome, sistema)
select f.unidade_id, padrao.nome, padrao.nome in ('Outras despesas', 'Fechamento')
from public.gestao_fin_config f cross join unnest(array[
  'Fornecedores', 'Aluguel', 'Energia e água', 'Internet e telefone',
  'Manutenção', 'Serviços', 'Impostos', 'Outras despesas', 'Fechamento'
]) as padrao(nome)
on conflict do nothing;

insert into public.gestao_fin_categorias(unidade_id, nome)
select distinct p.unidade_id, trim(p.categoria)
from public.gestao_contas_pagar p
where length(trim(p.categoria)) between 2 and 100
on conflict do nothing;

create function gestao_private.validar_categoria_conta_pagar() returns trigger
language plpgsql set search_path='' as $$
declare nome_canonico text;
begin
  select c.nome into nome_canonico from public.gestao_fin_categorias c
  where c.unidade_id=new.unidade_id and c.ativo
    and lower(trim(c.nome))=lower(trim(new.categoria));
  if nome_canonico is null then
    raise exception 'Escolha uma categoria financeira ativa desta unidade.';
  end if;
  new.categoria:=nome_canonico;
  return new;
end $$;
create trigger gestao_validar_categoria_pagar before insert on public.gestao_contas_pagar
for each row execute function gestao_private.validar_categoria_conta_pagar();

create function public.gestao_fin_categoria_operar(
  p_ator uuid, p_unidade uuid, p_acao text, p_dados jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
declare empresa uuid; categoria public.gestao_fin_categorias%rowtype;
  nome_novo text; id_categoria uuid; novo_ativo boolean;
begin
  select empresa_id into empresa from public.gestao_unidades where id=p_unidade;
  if empresa is null
    or gestao_private.papel_gestao(p_ator,empresa) is distinct from 'gestor'
    or not exists(select 1 from public.perfis where id=p_ator and ativo and role::text='bdl_admin')
  then raise exception 'O financeiro é exclusivo do usuário Master com acesso vigente à unidade.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_unidade::text||':financeiro',0));
  if not exists(select 1 from public.gestao_fin_config where unidade_id=p_unidade) then
    raise exception 'Ative o financeiro antes de cadastrar categorias.';
  end if;
  if p_acao='criar' then
    nome_novo:=trim(coalesce(p_dados->>'nome',''));
    if length(nome_novo) not between 2 and 100 then
      raise exception 'Informe um nome de 2 a 100 caracteres.';
    end if;
    insert into public.gestao_fin_categorias(unidade_id,nome)
    values(p_unidade,nome_novo) returning id into id_categoria;
  elsif p_acao='situacao' then
    id_categoria:=nullif(p_dados->>'id','')::uuid;
    select * into categoria from public.gestao_fin_categorias
      where id=id_categoria and unidade_id=p_unidade for update;
    if not found then raise exception 'Categoria não encontrada nesta unidade.'; end if;
    if categoria.sistema then raise exception 'Esta categoria é necessária para o funcionamento do financeiro.'; end if;
    novo_ativo:=nullif(p_dados->>'ativo','')::boolean;
    if novo_ativo is null then raise exception 'Informe a nova situação da categoria.'; end if;
    update public.gestao_fin_categorias set ativo=novo_ativo where id=id_categoria;
  else
    raise exception 'Operação de categoria inválida.';
  end if;
  insert into public.gestao_auditoria(empresa_id,usuario_id,acao,registro_id,dados)
  values(empresa,p_ator,'financeiro_categoria_'||p_acao,id_categoria,p_dados);
  return id_categoria;
end $$;
revoke all on function public.gestao_fin_categoria_operar(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.gestao_fin_categoria_operar(uuid,uuid,text,jsonb) to service_role;
