alter table public.suporte_conversas
  add column feedback_resolvido boolean,
  add column feedback_nota smallint check (feedback_nota between 1 and 5),
  add column feedback_respondido_em timestamptz;

create or replace function public.suporte_enviar(p_usuario uuid,p_master boolean,p_empresa uuid,p_conversa uuid,p_request uuid,p_assunto text,p_texto text,p_anexos jsonb,p_origem text)
returns bigint language plpgsql security invoker set search_path='' as $$
declare
  perfil public.perfis%rowtype;
  conversa public.suporte_conversas%rowtype;
  mensagem bigint;
begin
  select * into perfil from public.perfis where id=p_usuario and ativo is distinct from false;
  if perfil.id is null or (p_master and perfil.role<>'bdl_admin') then raise exception 'Acesso negado'; end if;
  if not p_master and perfil.role<>'bdl_admin' and perfil.prefeitura_id is distinct from p_empresa then raise exception 'Empresa inválida'; end if;
  if char_length(btrim(p_texto))>5000 or (btrim(p_texto)='' and jsonb_array_length(p_anexos)=0) then raise exception 'Mensagem inválida'; end if;
  if not p_master then
    insert into public.suporte_conversas(id,empresa_id,usuario_id,solicitante_nome,assunto,origem)
    values(p_conversa,p_empresa,p_usuario,perfil.nome,p_assunto,p_origem) on conflict(id) do nothing;
  end if;
  select * into conversa from public.suporte_conversas where id=p_conversa for update;
  if conversa.id is null or (not p_master and (conversa.usuario_id is distinct from p_usuario or conversa.empresa_id<>p_empresa)) then raise exception 'Acesso negado'; end if;
  select id into mensagem from public.suporte_mensagens where request_id=p_request and conversa_id=p_conversa and autor_id=p_usuario;
  if mensagem is not null then return mensagem; end if;
  if conversa.status='resolved' then raise exception 'Reabra o atendimento antes de enviar uma mensagem'; end if;
  insert into public.suporte_mensagens(conversa_id,autor_id,autor_nome,suporte,texto,anexos,request_id)
  values(p_conversa,p_usuario,perfil.nome,p_master,btrim(p_texto),p_anexos,p_request) returning id into mensagem;
  update public.suporte_conversas set updated_at=clock_timestamp(),status=case when p_master or conversa.status='active' then 'active' else 'waiting' end where id=p_conversa;
  if p_master and p_usuario<>conversa.usuario_id then
    insert into public.frota_notificacoes(prefeitura_id,tipo,suporte_id,destinatario_id,evento,numero_ordem,veiculo,responsavel,autor_id)
    values(conversa.empresa_id,'suporte',conversa.id,conversa.usuario_id,'issued',conversa.assunto,'',perfil.nome,p_usuario);
  end if;
  return mensagem;
end;
$$;

create or replace function public.suporte_avaliar(p_usuario uuid,p_empresa uuid,p_conversa uuid,p_resolvido boolean,p_nota smallint)
returns void language plpgsql security invoker set search_path='' as $$
declare
  perfil public.perfis%rowtype;
  conversa public.suporte_conversas%rowtype;
begin
  select * into perfil from public.perfis where id=p_usuario and ativo is distinct from false;
  if perfil.id is null or p_resolvido is null or p_nota is null or p_nota not between 1 and 5 then raise exception 'Avaliação inválida'; end if;
  select * into conversa from public.suporte_conversas where id=p_conversa for update;
  if conversa.id is null or conversa.usuario_id is distinct from p_usuario or conversa.empresa_id is distinct from p_empresa
    or (perfil.role<>'bdl_admin' and perfil.prefeitura_id is distinct from p_empresa) then raise exception 'Acesso negado'; end if;
  if conversa.status<>'resolved' or conversa.feedback_respondido_em is not null then raise exception 'Avaliação indisponível'; end if;
  update public.suporte_conversas set feedback_resolvido=p_resolvido, feedback_nota=p_nota,
    feedback_respondido_em=clock_timestamp(), status=case when p_resolvido then 'resolved' else 'waiting' end,
    updated_at=clock_timestamp() where id=p_conversa;
  insert into public.suporte_mensagens(conversa_id,autor_id,autor_nome,suporte,tipo,texto,request_id)
  values(p_conversa,p_usuario,perfil.nome,false,'status',
    case when p_resolvido then 'Problema resolvido' else 'Ainda preciso de ajuda' end || ' · Avaliação: ' || p_nota || '/5',gen_random_uuid());
end;
$$;

revoke all on function public.suporte_avaliar(uuid,uuid,uuid,boolean,smallint) from public,anon,authenticated;
grant execute on function public.suporte_avaliar(uuid,uuid,uuid,boolean,smallint) to service_role;

create function public.suporte_limpar_feedback_ao_resolver()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='resolved' and old.status is distinct from 'resolved' then
    new.feedback_resolvido=null;
    new.feedback_nota=null;
    new.feedback_respondido_em=null;
  end if;
  return new;
end;
$$;

create trigger suporte_limpar_feedback_ao_resolver
before update of status on public.suporte_conversas
for each row execute function public.suporte_limpar_feedback_ao_resolver();
