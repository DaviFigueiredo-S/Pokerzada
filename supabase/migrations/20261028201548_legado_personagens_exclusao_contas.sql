begin;
-- Nenhuma conta é removida ao aplicar esta migração.
alter table public.poker_accounts add column deletion_pending boolean not null default false;
create table poker_private.account_deletions (
 target_id uuid primary key, requested_by uuid references auth.users(id) on delete set null,
 target_role text not null, requested_at timestamptz not null default now(), completed_at timestamptz
);
create table poker_private.character_photos (
 player_id uuid primary key references public.poker_players(id) on delete cascade,
 source text not null check(length(source)<=1500000), updated_at timestamptz not null default now()
);
alter table poker_private.account_deletions enable row level security;
alter table poker_private.character_photos enable row level security;
revoke all on poker_private.account_deletions,poker_private.character_photos from public,anon,authenticated,service_role;

-- UPDATE primeiro: ON CONFLICT acionava BEFORE INSERT e revalidava nomes legados.
create or replace function poker_private.poker_link_player() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deletion_pending then return new;end if;
 update public.poker_players set data=data||jsonb_build_object('accountId',new.user_id,'active',new.active and new.approved) where id=new.user_id;
 if not found then
  insert into public.poker_players(id,data) values(new.user_id,jsonb_build_object('id',new.user_id,'accountId',new.user_id,'name',new.display_name,'avatar','','active',new.active and new.approved));
 end if;
 return new;
end;$$;

-- A auditoria financeira não deve impedir a exclusão da identidade de autenticação.
alter table public.poker_operations alter column actor drop not null;
alter table public.poker_audit alter column actor drop not null;
alter table public.poker_operations drop constraint poker_operations_actor_fkey;
alter table public.poker_operations add constraint poker_operations_actor_fkey foreign key(actor) references auth.users(id) on delete set null;
alter table public.poker_audit drop constraint poker_audit_actor_fkey;
alter table public.poker_audit add constraint poker_audit_actor_fkey foreign key(actor) references auth.users(id) on delete set null;

create function poker_private.protect_account_deletion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.role='owner' or lower(old.username)='davi303' then raise exception 'A conta principal está protegida' using errcode='42501';end if;
  if not exists(select 1 from poker_private.account_deletions where target_id=old.user_id) then raise exception 'Use o fluxo auditado de exclusão de conta' using errcode='42501';end if;
  return old;
 end if;
 if old.deletion_pending and (new.active or new.approved or not new.deletion_pending or new.role<>old.role or new.username<>old.username) then raise exception 'Esta conta está em exclusão. Conclua a exclusão pendente.';end if;
 return new;
end;$$;
create trigger protect_account_deletion before delete or update on public.poker_accounts for each row execute function poker_private.protect_account_deletion();

-- Redação contextual: preserva IDs históricos, centavos, cartas, vitórias e versões.
create function poker_private.anonymize(value jsonb, uid text, labels text[]) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb; k text; v jsonb; txt text; own boolean;
begin
 if jsonb_typeof(value)='array' then
  select coalesce(jsonb_agg(poker_private.anonymize(x,uid,labels)),'[]'::jsonb) into result from jsonb_array_elements(value) x;return result;
 elsif jsonb_typeof(value)='object' then
  own:=value->>'id'=uid or value->>'user_id'=uid or value->>'accountId'=uid;
  result:='{}';
  for k,v in select * from jsonb_each(value) loop
   if own and k in ('avatar','photo','source','email','username','display_name','name') then
    v:=to_jsonb(case when k in ('name','username','display_name') then 'Integrante removido' else '' end);
   elsif own and k='accountId' then v:='null'::jsonb;
   elsif k in ('actor','ancient','createdByName','deletedByName') and (v#>>'{}')=any(labels) then v:='"Integrante removido"'::jsonb;
   elsif k in ('note','reason','deleteReason','cancelReason','correctionReason','voidReason') and jsonb_typeof(v)='string' then
    txt:=v#>>'{}';for i in 1..coalesce(array_length(labels,1),0) loop if length(labels[i])>0 then txt:=replace(txt,labels[i],'Integrante removido');end if;end loop;v:=to_jsonb(txt);
   else v:=poker_private.anonymize(v,uid,labels);
   end if;
   result:=result||jsonb_build_object(k,v);
  end loop;return result;
 end if;
 return value;
end;$$;

create function poker_private.require_account_admin(actor_id uuid,target_role text) returns void language plpgsql security definer set search_path='' as $$
declare a public.poker_accounts;
begin
 select * into a from public.poker_accounts where user_id=actor_id for share;
 if a.user_id is null or not a.active or not a.approved or a.must_change_password or a.deletion_pending or a.role not in ('owner','admin') then raise exception 'Administrador autorizado obrigatório' using errcode='42501';end if;
 if target_role='owner' then raise exception 'A conta principal está protegida' using errcode='42501';end if;
 if target_role='admin' and a.role<>'owner' then raise exception 'Somente Davi303 administra TcheTches' using errcode='42501';end if;
end;$$;
create function poker_private.delete_account_prepare(actor_id uuid,target_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.poker_accounts; job poker_private.account_deletions; labels text[]; at_time text; op uuid:=gen_random_uuid();
begin
 -- Exclusivo contra comandos que criam/reabrem mesas e contra salvamentos de perfil.
 perform pg_advisory_xact_lock(730304);
 select * into job from poker_private.account_deletions j where j.target_id=delete_account_prepare.target_id;
 if found then perform poker_private.require_account_admin(actor_id,job.target_role);return jsonb_build_object('done',job.completed_at is not null);end if;
 select * into target from public.poker_accounts where user_id=target_id for update;
 perform poker_private.require_account_admin(actor_id,target.role);
 if target.user_id is null then raise exception 'Conta não encontrada';end if;
 if target.user_id=actor_id then raise exception 'Não é possível excluir sua própria conta por esta área';end if;
 if exists(select 1 from public.poker_sessions where data->>'status'='active' and exists(select 1 from jsonb_array_elements(data->'participants') p where p->>'playerId'=target_id::text)) then raise exception 'Este integrante participa de uma mesa ativa. Finalize ou cancele a mesa antes de excluir a conta.';end if;
 labels:=array[target.username,target.display_name,(select data->>'name' from public.poker_players where id=target_id)];
 at_time:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 insert into poker_private.account_deletions(target_id,requested_by,target_role) values(target_id,actor_id,target.role);
 update public.poker_accounts set deletion_pending=true,active=false,approved=false,preferences='{}' where user_id=target_id;
 delete from poker_private.character_photos where player_id=target_id;
 update public.poker_players set data=jsonb_build_object('id',id,'name','Integrante removido','avatar','','active',false,'archived',true,'deletedAccount',true,'accountId',null) where id=target_id;
 update public.poker_sessions set data=poker_private.anonymize(data,target_id::text,labels),updated_at=now();
 update public.poker_audit set data=poker_private.anonymize(data,target_id::text,labels);
 update public.poker_operations set command=poker_private.anonymize(command,target_id::text,labels);
 insert into public.poker_operations(id,actor,command) values(op,actor_id,jsonb_build_object('id',op,'type','deleteAccountStarted','payload',jsonb_build_object('userId',target_id)));
 insert into public.poker_audit(id,actor,data) values(op,actor_id,jsonb_build_object('id',op,'type','deleteAccountStarted','actorId',actor_id,'actor',(select display_name from public.poker_accounts where user_id=actor_id),'targetId',target_id,'at',at_time));
 return jsonb_build_object('done',false);
end;$$;
create function poker_private.delete_account_finish(actor_id uuid,target_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job poker_private.account_deletions;op uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(730304);
 select * into job from poker_private.account_deletions j where j.target_id=delete_account_finish.target_id for update;
 if not found then raise exception 'Exclusão não iniciada';end if;
 perform poker_private.require_account_admin(actor_id,job.target_role);
 if job.completed_at is not null then return jsonb_build_object('ok',true);end if;
 if exists(select 1 from auth.users where id=target_id) then raise exception 'A autenticação ainda não foi removida. Tente concluir a exclusão novamente.';end if;
 update poker_private.account_deletions j set completed_at=now() where j.target_id=delete_account_finish.target_id;
 insert into public.poker_operations(id,actor,command) values(op,actor_id,jsonb_build_object('id',op,'type','deleteAccountFinished','payload',jsonb_build_object('userId',target_id)));
 insert into public.poker_audit(id,actor,data) values(op,actor_id,jsonb_build_object('id',op,'type','deleteAccountFinished','actorId',actor_id,'actor',(select display_name from public.poker_accounts where user_id=actor_id),'targetId',target_id,'at',now()));
 return jsonb_build_object('ok',true);
end;$$;

create function poker_private.require_character_access(actor_id uuid,target_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.poker_accounts;
begin
 select * into a from public.poker_accounts where user_id=actor_id for share;
 if a.user_id is null or not a.active or not a.approved or a.must_change_password or a.deletion_pending or (actor_id<>target_id and a.role not in ('owner','admin','organizer')) then raise exception 'Você não pode editar este personagem' using errcode='42501';end if;
 if not exists(select 1 from public.poker_accounts where user_id=target_id and not deletion_pending) then raise exception 'Conta indisponível';end if;
end;$$;
create function poker_private.character_read(actor_id uuid,target_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb; source text;
begin
 perform poker_private.require_character_access(actor_id,target_id);
 select data into p from public.poker_players where id=target_id;
 select c.source into source from poker_private.character_photos c where player_id=target_id;
 return jsonb_build_object('player',p,'source',coalesce(source,p->>'avatar',''));
end;$$;
create function poker_private.character_save(actor_id uuid,target_id uuid,operation_id uuid,expected_revision bigint,appearance jsonb,photo_source text,photo_avatar text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb;cmd jsonb;prior public.poker_operations; revision bigint;at_time text;
begin
 perform pg_advisory_xact_lock_shared(730304);
 perform poker_private.require_character_access(actor_id,target_id);
 if operation_id is null then raise exception 'Identificador obrigatório';end if;
 perform pg_advisory_xact_lock(hashtextextended(operation_id::text,0));
 cmd:=jsonb_build_object('type','character','targetId',target_id,'revision',expected_revision,'digest',md5(jsonb_build_object('appearance',appearance,'source',photo_source,'avatar',photo_avatar)::text));
 select * into prior from public.poker_operations where id=operation_id;
 if found then
  if prior.actor is distinct from actor_id or prior.command<>cmd then raise exception 'Identificador reutilizado';end if;
  return jsonb_build_object('ok',true,'duplicate',true);
 end if;
 select data into p from public.poker_players where id=target_id for update;
 if p is null then raise exception 'Jogador não encontrado';end if;
 revision:=coalesce((p->>'characterRevision')::bigint,0);
 if expected_revision is distinct from revision then raise exception 'Seu personagem mudou em outro aparelho. Feche e reabra o editor para conferir.' using errcode='40001';end if;
 if coalesce(appearance->>'outfit','') not in ('executivo','praiano','magnata','palhaco','mafioso','cowboy','rei','heroi','mago','pirata','piloto','casual','lorde','chef','lutador','coringa') then raise exception 'Traje inválido';end if;
 if jsonb_typeof(appearance->'crop'->'x') is distinct from 'number' or jsonb_typeof(appearance->'crop'->'y') is distinct from 'number' or jsonb_typeof(appearance->'crop'->'zoom') is distinct from 'number' or (appearance->'crop'->>'x')::numeric not between 0 and 1 or (appearance->'crop'->>'y')::numeric not between 0 and 1 or (appearance->'crop'->>'zoom')::numeric not between 1 and 3 then raise exception 'Enquadramento inválido';end if;
 if photo_source is null or photo_avatar is null or length(photo_source)>1500000 or length(photo_avatar)>200000 or (photo_source='' and photo_avatar<>'') or (photo_source<>'' and (photo_source!~'^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' or photo_avatar!~'^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')) then raise exception 'Foto inválida';end if;
 if photo_source='' then delete from poker_private.character_photos where player_id=target_id;
 else insert into poker_private.character_photos(player_id,source) values(target_id,photo_source) on conflict(player_id) do update set source=excluded.source,updated_at=now();end if;
 p:=p||jsonb_build_object('character',jsonb_build_object('outfit',appearance->>'outfit','crop',appearance->'crop'),'avatar',photo_avatar,'characterRevision',revision+1);
 update public.poker_players set data=p where id=target_id;
 insert into public.poker_operations(id,actor,command) values(operation_id,actor_id,cmd);
 insert into public.poker_audit(id,actor,data) values(operation_id,actor_id,jsonb_build_object('id',operation_id,'type','character','actorId',actor_id,'actor',(select display_name from public.poker_accounts where user_id=actor_id),'targetId',target_id,'at',now(),'before',jsonb_build_object('revision',revision),'after',jsonb_build_object('revision',revision+1,'outfit',appearance->>'outfit')));
 return jsonb_build_object('ok',true,'revision',revision+1);
end;$$;

-- Wrapper reutiliza integralmente regras financeiras, numeração e revisão existentes.
alter function poker_private.poker_command(jsonb) rename to poker_command_before_legacy;
revoke all on function poker_private.poker_command_before_legacy(jsonb) from public,anon,authenticated;
create function poker_private.poker_command(command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_player jsonb;result jsonb;
begin
 perform pg_advisory_xact_lock_shared(730304);
 if command->>'type'='player' then
  if not poker_private.poker_is_organizer() then raise exception 'Organizador obrigatório' using errcode='42501';end if;
  select data into old_player from public.poker_players where id=(command->'payload'->>'id')::uuid for update;
  if coalesce((old_player->>'deletedAccount')::boolean,false) then raise exception 'Perfil histórico anonimizado não pode ser editado';end if;
  if coalesce(command->'payload'->>'avatar','')<>coalesce(old_player->>'avatar','') then raise exception 'Altere a fotografia pelo editor Meu Personagem';end if;
 end if;
 result:=poker_private.poker_command_before_legacy(command);
 if command->>'type'='player' then
  update public.poker_players set data=data||jsonb_strip_nulls(jsonb_build_object('character',old_player->'character','characterRevision',old_player->'characterRevision')) where id=(command->'payload'->>'id')::uuid;
 end if;
 return result;
end;$$;
create or replace function public.poker_command(command jsonb) returns jsonb language sql security invoker set search_path='' as $$select poker_private.poker_command(command);$$;

-- Endpoints de serviço: identidade do ator vem de getUser na Edge Function.
create function public.poker_delete_account_prepare(actor_id uuid,target_id uuid) returns jsonb language sql security invoker set search_path='' as $$select poker_private.delete_account_prepare(actor_id,target_id);$$;
create function public.poker_delete_account_finish(actor_id uuid,target_id uuid) returns jsonb language sql security invoker set search_path='' as $$select poker_private.delete_account_finish(actor_id,target_id);$$;
create function public.poker_character_read(actor_id uuid,target_id uuid) returns jsonb language sql security invoker set search_path='' as $$select poker_private.character_read(actor_id,target_id);$$;
create function public.poker_character_save(actor_id uuid,target_id uuid,operation_id uuid,expected_revision bigint,appearance jsonb,photo_source text,photo_avatar text) returns jsonb language sql security invoker set search_path='' as $$select poker_private.character_save(actor_id,target_id,operation_id,expected_revision,appearance,photo_source,photo_avatar);$$;
revoke all on function poker_private.protect_account_deletion(),poker_private.anonymize(jsonb,text,text[]),poker_private.require_account_admin(uuid,text),poker_private.delete_account_prepare(uuid,uuid),poker_private.delete_account_finish(uuid,uuid),poker_private.require_character_access(uuid,uuid),poker_private.character_read(uuid,uuid),poker_private.character_save(uuid,uuid,uuid,bigint,jsonb,text,text),poker_private.poker_command(jsonb) from public,anon,authenticated;
revoke all on function public.poker_delete_account_prepare(uuid,uuid),public.poker_delete_account_finish(uuid,uuid),public.poker_character_read(uuid,uuid),public.poker_character_save(uuid,uuid,uuid,bigint,jsonb,text,text) from public,anon,authenticated;
grant usage on schema poker_private to service_role;
grant execute on function poker_private.delete_account_prepare(uuid,uuid),poker_private.delete_account_finish(uuid,uuid),poker_private.character_read(uuid,uuid),poker_private.character_save(uuid,uuid,uuid,bigint,jsonb,text,text),public.poker_delete_account_prepare(uuid,uuid),public.poker_delete_account_finish(uuid,uuid),public.poker_character_read(uuid,uuid),public.poker_character_save(uuid,uuid,uuid,bigint,jsonb,text,text) to service_role;
grant execute on function poker_private.poker_command(jsonb) to authenticated;

-- Se o Auth já removeu a identidade mas a confirmação falhou, manter um item
-- recuperável na administração, sem recriar a conta nem seus dados pessoais.
alter function poker_private.poker_snapshot() rename to poker_snapshot_before_legacy;
revoke all on function poker_private.poker_snapshot_before_legacy() from public,anon,authenticated;
create function poker_private.poker_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; pending jsonb;
begin
 result:=poker_private.poker_snapshot_before_legacy();
 if poker_private.poker_is_admin() then
  select coalesce(jsonb_agg(jsonb_build_object('user_id',j.target_id,'username','Exclusão pendente '||left(j.target_id::text,8),'role',j.target_role,'active',false,'approved',false,'deletion_pending',true)),'[]'::jsonb) into pending
  from poker_private.account_deletions j where j.completed_at is null
  and not exists(select 1 from public.poker_accounts a where a.user_id=j.target_id)
  and (j.target_role<>'admin' or poker_private.poker_is_owner());
  result:=jsonb_set(result,'{accounts}',result->'accounts'||pending);
 end if;
 return result;
end;$$;
revoke all on function poker_private.poker_snapshot() from public,anon;
grant execute on function poker_private.poker_snapshot() to authenticated;
create or replace function public.poker_snapshot() returns jsonb language sql security invoker set search_path='' as $$select poker_private.poker_snapshot();$$;
commit;
