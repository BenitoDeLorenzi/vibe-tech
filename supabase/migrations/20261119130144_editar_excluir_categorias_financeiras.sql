-- Normalize Portuguese accents for category identity and keep payable labels in sync.
create function gestao_private.normalizar_categoria_financeira(valor text)
returns text language sql immutable set search_path='' as $$
  select regexp_replace(
    regexp_replace(
      translate(
        translate(
          translate(
            translate(
              translate(
                translate(lower(trim(coalesce(valor, ''))), 'áàâãä', 'aaaaa'),
                'éèêë', 'eeee'),
              'íìîï', 'iiii'),
            'óòôõö', 'ooooo'),
          'úùûü', 'uuuu'),
        'çñ', 'cn'),
      '[̀-ͯ]', '', 'g'),
    '[[:space:]]+', ' ', 'g');
$$;
revoke all on function gestao_private.normalizar_categoria_financeira(text) from public,anon,authenticated;
grant execute on function gestao_private.normalizar_categoria_financeira(text) to service_role;

-- Merge any pre-existing accent variants before installing the unique index.
do $$
declare repetida record; nome_mantido text;
begin
  for repetida in
    select unidade_id,
      gestao_private.normalizar_categoria_financeira(nome) as chave,
      (array_agg(id order by sistema desc, created_at, id))[1] as manter_id
    from public.gestao_fin_categorias
    group by unidade_id, gestao_private.normalizar_categoria_financeira(nome)
    having count(*) > 1
  loop
    select nome into nome_mantido from public.gestao_fin_categorias where id=repetida.manter_id;
    update public.gestao_contas_pagar p set categoria=nome_mantido
    where p.unidade_id=repetida.unidade_id
      and gestao_private.normalizar_categoria_financeira(p.categoria)=repetida.chave;
    delete from public.gestao_fin_categorias c
    where c.unidade_id=repetida.unidade_id
      and gestao_private.normalizar_categoria_financeira(c.nome)=repetida.chave
      and c.id<>repetida.manter_id;
  end loop;
end $$;

drop index public.gestao_fin_categorias_nome_idx;
create unique index gestao_fin_categorias_nome_idx
  on public.gestao_fin_categorias(
    unidade_id, gestao_private.normalizar_categoria_financeira(nome)
  );

create or replace function gestao_private.validar_categoria_conta_pagar() returns trigger
language plpgsql set search_path='' as $$
declare nome_canonico text;
begin
  select c.nome into nome_canonico from public.gestao_fin_categorias c
  where c.unidade_id=new.unidade_id and c.ativo
    and gestao_private.normalizar_categoria_financeira(c.nome)=
      gestao_private.normalizar_categoria_financeira(new.categoria);
  if nome_canonico is null then
    raise exception 'Escolha uma categoria financeira ativa desta unidade.';
  end if;
  new.categoria:=nome_canonico;
  return new;
end $$;

create or replace function public.gestao_fin_categoria_operar(
  p_ator uuid, p_unidade uuid, p_acao text, p_dados jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
declare empresa uuid; categoria public.gestao_fin_categorias%rowtype;
  substituta public.gestao_fin_categorias%rowtype;
  nome_novo text; id_categoria uuid; novo_ativo boolean;
  anterior jsonb := '{}'::jsonb; contas_atualizadas integer := 0;
begin
  select empresa_id into empresa from public.gestao_unidades where id=p_unidade;
  if empresa is null
    or gestao_private.papel_gestao(p_ator,empresa) is distinct from 'gestor'
    or not exists(select 1 from public.perfis where id=p_ator and ativo and role::text='bdl_admin')
  then raise exception 'O financeiro é exclusivo do usuário Master com acesso vigente à unidade.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_unidade::text||':financeiro',0));
  if not exists(select 1 from public.gestao_fin_config where unidade_id=p_unidade) then
    raise exception 'Ative o financeiro antes de gerir categorias.';
  end if;
  if p_acao='criar' then
    nome_novo:=trim(coalesce(p_dados->>'nome',''));
    if length(nome_novo) not between 2 and 100 then
      raise exception 'Informe um nome de 2 a 100 caracteres.';
    end if;
    insert into public.gestao_fin_categorias(unidade_id,nome)
    values(p_unidade,nome_novo) returning id into id_categoria;
  elsif p_acao in ('editar','situacao','excluir') then
    id_categoria:=nullif(p_dados->>'id','')::uuid;
    select * into categoria from public.gestao_fin_categorias
      where id=id_categoria and unidade_id=p_unidade for update;
    if not found then raise exception 'Categoria não encontrada nesta unidade.'; end if;
    if categoria.sistema then raise exception 'Esta categoria é necessária para o funcionamento do financeiro.'; end if;
    anterior:=to_jsonb(categoria);
    if p_acao='editar' then
      nome_novo:=trim(coalesce(p_dados->>'nome',''));
      if length(nome_novo) not between 2 and 100 then
        raise exception 'Informe um nome de 2 a 100 caracteres.';
      end if;
      update public.gestao_fin_categorias set nome=nome_novo where id=id_categoria;
      update public.gestao_contas_pagar p set categoria=nome_novo
      where p.unidade_id=p_unidade
        and gestao_private.normalizar_categoria_financeira(p.categoria)=
          gestao_private.normalizar_categoria_financeira(categoria.nome);
      get diagnostics contas_atualizadas=row_count;
    elsif p_acao='situacao' then
      novo_ativo:=nullif(p_dados->>'ativo','')::boolean;
      if novo_ativo is null then raise exception 'Informe a nova situação da categoria.'; end if;
      update public.gestao_fin_categorias set ativo=novo_ativo where id=id_categoria;
    else
      if nullif(p_dados->>'substituta_id','') is not null then
        select * into substituta from public.gestao_fin_categorias
        where id=(p_dados->>'substituta_id')::uuid and unidade_id=p_unidade and ativo for update;
        if not found or substituta.id=id_categoria then
          raise exception 'Escolha outra categoria ativa para as contas existentes.';
        end if;
      end if;
      if exists(select 1 from public.gestao_contas_pagar p
        where p.unidade_id=p_unidade
          and gestao_private.normalizar_categoria_financeira(p.categoria)=
            gestao_private.normalizar_categoria_financeira(categoria.nome))
        and substituta.id is null then
        raise exception 'Escolha outra categoria ativa para as contas existentes.';
      end if;
      if substituta.id is not null then
        update public.gestao_contas_pagar p set categoria=substituta.nome
        where p.unidade_id=p_unidade
          and gestao_private.normalizar_categoria_financeira(p.categoria)=
            gestao_private.normalizar_categoria_financeira(categoria.nome);
        get diagnostics contas_atualizadas=row_count;
      end if;
      delete from public.gestao_fin_categorias where id=id_categoria;
    end if;
  else
    raise exception 'Operação de categoria inválida.';
  end if;
  insert into public.gestao_auditoria(empresa_id,usuario_id,acao,registro_id,dados)
  values(empresa,p_ator,'financeiro_categoria_'||p_acao,id_categoria,
    p_dados||jsonb_build_object('anterior',anterior,'contas_atualizadas',contas_atualizadas));
  return id_categoria;
end $$;
