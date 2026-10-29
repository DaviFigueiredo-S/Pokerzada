begin;
alter table public.poker_accounts drop constraint poker_accounts_role_check;
alter table public.poker_accounts add constraint poker_accounts_role_check check(role in ('owner','admin','organizer','member'));
create or replace function poker_private.poker_is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.poker_accounts where user_id=auth.uid() and active and approved and not must_change_password and role in ('owner','admin')); $$;
revoke all on function poker_private.poker_is_admin() from public,anon;grant execute on function poker_private.poker_is_admin() to authenticated;
create or replace function poker_private.poker_is_organizer() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.poker_accounts where user_id=auth.uid() and active and approved and not must_change_password and role in ('owner','admin','organizer')); $$;
create or replace function poker_private.name_key(value text) returns text language sql immutable set search_path='' as $$ select regexp_replace(lower(translate(trim(value),'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç','AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')),'\s+',' ','g'); $$;
create or replace function poker_private.unique_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare label text; uid uuid; k text;
begin
 if tg_table_name='poker_accounts' then
 if tg_op='UPDATE' and new.username=old.username and new.display_name=old.display_name then return new;end if;
 uid:=new.user_id;
 else
 if new.data->>'accountId' is null then return new;end if;
 if tg_op='UPDATE' and new.data->>'name'=old.data->>'name' then return new;end if;
 uid:=new.id;
 end if;
 -- Serializa verificações entre cadastro e edição, inclusive nomes distintos da mesma conta.
 perform pg_advisory_xact_lock(730303);
 for label in select unnest(case when tg_table_name='poker_accounts' then array[to_jsonb(new)->>'username',to_jsonb(new)->>'display_name'] else array[to_jsonb(new)->'data'->>'name'] end) loop
 k:=poker_private.name_key(label);
 if exists(select 1 from public.poker_accounts a where a.user_id<>uid and (poker_private.name_key(a.username)=k or poker_private.name_key(a.display_name)=k)) or exists(select 1 from public.poker_players p where p.id<>uid and p.data->>'accountId' is not null and poker_private.name_key(p.data->>'name')=k) then raise exception 'Esse nome já está registrado. Escolha outro para continuar.' using errcode='23505';end if;
 end loop;return new;
end;$$;
revoke all on function poker_private.unique_identity(),poker_private.name_key(text) from public,anon,authenticated;
create trigger unique_account_identity before insert or update of username,display_name on public.poker_accounts for each row execute function poker_private.unique_identity();
create trigger unique_player_identity before insert or update of data on public.poker_players for each row execute function poker_private.unique_identity();
create or replace function poker_private.poker_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare account jsonb; base jsonb; owner boolean; organizer boolean;
begin
 select to_jsonb(a) into account from public.poker_accounts a where user_id=auth.uid() and active;
 if account is null then raise exception 'Conta não autorizada' using errcode='42501';end if;
 base:=jsonb_build_object('schema',1,'revision',(select count(*) from public.poker_operations),'account',account,'players','[]'::jsonb,'sessions','[]'::jsonb,'settings',(select data from public.poker_settings where id=1),'audit','[]'::jsonb,'operations','[]'::jsonb,'accounts','[]'::jsonb,'deletedSessions','[]'::jsonb);
 if not poker_private.poker_is_member() then return base;end if;
 owner:=poker_private.poker_is_owner();organizer:=poker_private.poker_is_organizer();
 return base||jsonb_build_object(
 'players',coalesce((select jsonb_agg(data order by created_at,id) from public.poker_players),'[]'::jsonb),
 'sessions',coalesce((select jsonb_agg(data order by data->>'startedAt',id) from public.poker_sessions where data->>'deletedAt' is null),'[]'::jsonb),
 'audit',case when owner then coalesce((select jsonb_agg(data order by created_at,id) from public.poker_audit),'[]'::jsonb) else '[]'::jsonb end,
 'accounts',case when poker_private.poker_is_admin() then coalesce((select jsonb_agg(to_jsonb(a) order by lower(username)) from public.poker_accounts a),'[]'::jsonb) else '[]'::jsonb end,
 'deletedSessions',case when owner then coalesce((select jsonb_agg(data order by data->>'deletedAt') from public.poker_sessions where data->>'deletedAt' is not null),'[]'::jsonb) else '[]'::jsonb end);
end;$$;



create or replace function poker_private.poker_command(command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare op uuid:=(command->>'id')::uuid; action text:=command->>'type'; p jsonb:=command->'payload'; sid uuid; s jsonb; before_value jsonb; after_value jsonb; stored_command jsonb; stored_actor uuid; actor_id uuid:=auth.uid(); actor_name text; pid text; e jsonb; r jsonb; arr jsonb; parts jsonb:='[]'; entries jsonb:='[]'; i integer; found_item boolean; amount bigint; count_value bigint:=0; at_time text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 if action='preferences' then
 if not poker_private.poker_is_member() then raise exception 'Acesso negado' using errcode='42501';end if;
 elsif action in ('count','final') then
 if not poker_private.poker_is_organizer() and not (poker_private.poker_is_member() and p->>'playerId'=actor_id::text) then raise exception 'Somente sua própria contagem' using errcode='42501';end if;
 elsif action in ('role','access','deactivate') then
 if not poker_private.poker_is_admin() then raise exception 'Administrador obrigatório' using errcode='42501';end if;
 elsif action in ('settings','restoreSession') then
 if not poker_private.poker_is_owner() then raise exception 'Administrador principal obrigatório' using errcode='42501';end if;
 elsif not poker_private.poker_is_organizer() then raise exception 'Organizador não autorizado' using errcode='42501';end if;
 if op is null or p is null or jsonb_typeof(p)<>'object' or action is null then raise exception 'Comando inválido';end if;
 if action in ('rebuy','adjust','final','count','presence') then perform poker_private.poker_text(p->>'playerId',36);end if;
 if action='mode' and coalesce(p->>'mode','') not in ('quick','full') then raise exception 'Modo inválido';end if;
 if action='presence' and jsonb_typeof(p->'present') is distinct from 'boolean' then raise exception 'Presença inválida';end if;
 select display_name into actor_name from public.poker_accounts where user_id=actor_id;
 perform pg_advisory_xact_lock(hashtextextended(op::text,0));
 select x.command,x.actor into stored_command,stored_actor from public.poker_operations x where id=op;
 if found then if stored_command<>command or stored_actor<>actor_id then raise exception 'Identificador reutilizado com conteúdo diferente';end if;return jsonb_build_object('ok',true,'duplicate',true);end if;
 if action not in ('create','player','settings','role','access','deactivate','preferences') then
 sid:=(command->>'sessionId')::uuid;
 select data into s from public.poker_sessions where id=sid for update;
 if s is null then raise exception 'Sessão não encontrada';end if;
 if (command->'expectedRevision' is null or (command->>'expectedRevision')::bigint is distinct from (s->>'revision')::bigint) and action not in ('count','final') and not (action='round' and not exists(select 1 from jsonb_array_elements(s->'rounds') item where item->>'id'=p->>'id')) then raise exception 'A sessão mudou em outro aparelho. Atualize e confira.';end if;
 if s->>'deletedAt' is not null and action<>'restoreSession' then raise exception 'Partida removida';end if;
 if s->>'status'<>'active' and action not in ('reopen','deleteSession','restoreSession') then raise exception 'Sessão bloqueada; abra uma correção';end if;
 if action in ('count','final') then
 if not exists(select 1 from jsonb_array_elements(s->'participants') x where x->>'playerId'=p->>'playerId') then raise exception 'Jogador não participa';end if;
 if coalesce((p->>'expectedCountRevision')::bigint,-1)<>coalesce((s->'countRevisions'->> (p->>'playerId'))::bigint,0) then raise exception 'A contagem deste jogador mudou. Confira os dados atuais antes de salvar.' using errcode='40001';end if;
 s:=jsonb_set(s,'{countRevisions}',coalesce(s->'countRevisions','{}'::jsonb)||jsonb_build_object(p->>'playerId',coalesce((s->'countRevisions'->>(p->>'playerId'))::bigint,0)+1));
 end if;
 before_value:=s;
 end if;
 if action='preferences' then
 perform poker_private.poker_validate_chips(p->'chips');
 select preferences into before_value from public.poker_accounts where user_id=actor_id for update;
 after_value:=jsonb_build_object('chips',p->'chips','reducedMotion',coalesce((p->>'reducedMotion')::boolean,false));
 update public.poker_accounts set preferences=after_value where user_id=actor_id;
 elsif action in ('role','access','deactivate') then
 sid:=null;
 select to_jsonb(a) into before_value from public.poker_accounts a where user_id=(p->>'userId')::uuid for update;
 if before_value is null then raise exception 'Usuário não encontrado';end if;

 if before_value->>'role'='owner' then raise exception 'A conta principal é protegida';end if;
 if before_value->>'role'='admin' and not poker_private.poker_is_owner() then raise exception 'Somente Davi303 administra TcheTches' using errcode='42501';end if;
 if action='deactivate' then
 if jsonb_typeof(p->'active') is distinct from 'boolean' then raise exception 'Situação inválida';end if;
 update public.poker_accounts set active=(p->>'active')::boolean where user_id=(p->>'userId')::uuid;
 elsif action='role' then
 if p->>'role'='admin' and not poker_private.poker_is_owner() then raise exception 'Somente Davi303 concede TcheTche' using errcode='42501';end if;
 if coalesce(p->>'role','') not in ('member','organizer','admin') then raise exception 'Permissão inválida';end if;
 update public.poker_accounts set role=p->>'role',approved=case when p->>'role' in ('organizer','admin') then true else approved end where user_id=(p->>'userId')::uuid;
 else
 if jsonb_typeof(p->'approved') is distinct from 'boolean' then raise exception 'Acesso inválido';end if;
 update public.poker_accounts set approved=(p->>'approved')::boolean where user_id=(p->>'userId')::uuid;
 end if;
 select to_jsonb(a) into after_value from public.poker_accounts a where user_id=(p->>'userId')::uuid;
 elsif action='player' then
 sid:=null;pid:=(p->>'id')::uuid::text;perform poker_private.poker_text(p->>'name',60);
 if length(coalesce(p->>'avatar',''))>200000 or (coalesce(p->>'avatar','')<>'' and (p->>'avatar')!~'^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') then raise exception 'Foto inválida';end if;
 select data into before_value from public.poker_players where id=pid::uuid for update;
 if before_value is null then raise exception 'Novos jogadores devem criar uma conta';end if;
 after_value:=jsonb_build_object('id',pid,'name',trim(p->>'name'),'avatar',coalesce(p->>'avatar',''),'active',coalesce((p->>'active')::boolean,true),'accountId',before_value->'accountId','archived',coalesce(before_value->'archived','false'::jsonb));
 insert into public.poker_players(id,data) values(pid::uuid,after_value) on conflict(id) do update set data=excluded.data;
 elsif action='settings' then
 perform poker_private.poker_integer(p->'buyin',1);perform poker_private.poker_integer(p->'rebuy',1);perform poker_private.poker_validate_chips(p->'chips');
 select data into before_value from public.poker_settings where id=1 for update;
 after_value:=jsonb_build_object('buyin',p->'buyin','rebuy',p->'rebuy','chips',p->'chips','reducedMotion',coalesce((p->>'reducedMotion')::boolean,false),'achievements',coalesce((p->>'achievements')::boolean,true));
 update public.poker_settings set data=after_value where id=1;
 elsif action='create' then
 sid:=(p->>'id')::uuid;perform poker_private.poker_integer(p->'buyin',1);perform poker_private.poker_integer(p->'rebuy',1);perform poker_private.poker_text(p->>'ancient',60);perform poker_private.poker_validate_chips(p->'chips');
 if jsonb_typeof(p->'players') is distinct from 'array' then raise exception 'Participantes obrigatórios';end if;
 i:=0;
 for pid in select * from jsonb_array_elements_text(p->'players') loop
 if not exists(select 1 from public.poker_players where id=pid::uuid and (data->>'active')::boolean and data->>'accountId' is not null and exists(select 1 from public.poker_accounts a where a.user_id=pid::uuid and a.active and a.approved)) then raise exception 'Jogador indisponível';end if;
 parts:=parts||jsonb_build_array(jsonb_build_object('playerId',pid,'seat',i,'present',true));i:=i+1;
 entries:=entries||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'playerId',pid,'kind','buyin','amount',p->'buyin','at',at_time,'actor',actor_name,'voided',false));
 end loop;
 s:=jsonb_build_object('id',sid,'name',coalesce(nullif(trim(p->>'name'),''),'Pokerzada da noite'),'ancient',trim(p->>'ancient'),'startedAt',p->>'startedAt','endedAt',null,'status','active','mode',p->>'mode','variant',p->>'variant','buyin',p->'buyin','rebuy',p->'rebuy','chips',p->'chips','participants',parts,'entries',entries,'finals','{}'::jsonb,'counts','[]'::jsonb,'rounds','[]'::jsonb,'cashAdjustments','[]'::jsonb,'revision',0,'closures','[]'::jsonb);
 elsif action in ('rebuy','adjust') then
 amount:=poker_private.poker_integer(p->'amount',case when action='adjust' then -100000000 else 1 end);
 if action='adjust' then perform poker_private.poker_text(p->>'reason');if amount=0 then raise exception 'Ajuste zero';end if;end if;
 e:=jsonb_build_object('id',op,'playerId',p->>'playerId','kind',case when action='adjust' then 'adjustment' else 'rebuy' end,'amount',amount,'reason',coalesce(p->>'reason',''),'at',at_time,'actor',actor_name,'voided',false);
 s:=jsonb_set(s,'{entries}',s->'entries'||jsonb_build_array(e));
 elsif action='void' then
 perform poker_private.poker_text(p->>'reason');arr:='[]';found_item:=false;
 for e in select * from jsonb_array_elements(s->'entries') loop
 if e->>'id'=p->>'entryId' and not (e->>'voided')::boolean then
 if e->>'kind'='buyin' then raise exception 'Corrija a entrada inicial com um ajuste';end if;
 e:=e||jsonb_build_object('voided',true,'voidReason',p->>'reason');found_item:=true;
 end if;arr:=arr||jsonb_build_array(e);
 end loop;
 if not found_item then raise exception 'Lançamento não encontrado';end if;
 s:=jsonb_set(s,'{entries}',arr);
 elsif action='cash' then
 amount:=poker_private.poker_integer(p->'amount',-100000000);perform poker_private.poker_text(p->>'reason');if amount=0 then raise exception 'Ajuste zero';end if;
 s:=jsonb_set(s,'{cashAdjustments}',s->'cashAdjustments'||jsonb_build_array(jsonb_build_object('id',op,'amount',amount,'reason',p->>'reason','at',at_time,'actor',actor_name)));
 elsif action='final' then
 amount:=poker_private.poker_integer(p->'amount');s:=jsonb_set(s,array['finals',p->>'playerId'],to_jsonb(amount));
 elsif action='count' then
 if jsonb_typeof(p->'quantities') is distinct from 'array' or jsonb_array_length(p->'quantities')<>5 then raise exception 'Contagem inválida';end if;
 for i in 0..4 loop count_value:=count_value+poker_private.poker_integer(p->'quantities'->i,0,1000000)*(array[5,10,25,50,100])[i+1];end loop;
 perform poker_private.poker_integer(to_jsonb(count_value));
 s:=jsonb_set(s,'{counts}',s->'counts'||jsonb_build_array(jsonb_build_object('id',op,'playerId',p->>'playerId','quantities',p->'quantities','amount',count_value,'at',at_time,'actor',actor_name)));
 if coalesce((p->>'useFinal')::boolean,false) then s:=jsonb_set(s,array['finals',p->>'playerId'],to_jsonb(count_value));end if;
 elsif action='mode' then s:=jsonb_set(s,'{mode}',p->'mode');
 elsif action='chips' then perform poker_private.poker_validate_chips(p->'chips');s:=jsonb_set(s,'{chips}',p->'chips');
 elsif action='presence' then
 arr:='[]';found_item:=false;for e in select * from jsonb_array_elements(s->'participants') loop if e->>'playerId'=p->>'playerId' then e:=jsonb_set(e,'{present}',to_jsonb((p->>'present')::boolean));found_item:=true;end if;arr:=arr||jsonb_build_array(e);end loop;
 if not found_item then raise exception 'Participante não encontrado';end if;s:=jsonb_set(s,'{participants}',arr);
 elsif action='round' then
 select item into r from jsonb_array_elements(s->'rounds') item where item->>'id'=p->>'id';
 if r is not null then
 p:=p||jsonb_build_object('number',r->'number','note',coalesce(r->>'note',''));
 else
 p:=p||jsonb_build_object('number',(select coalesce(max((item->>'number')::integer),0)+1 from jsonb_array_elements(s->'rounds') item),'note','');
 end if;
 r:=jsonb_build_object('id',(p->>'id')::uuid,'number',p->'number','winners',p->'winners','hand',coalesce(p->>'hand',''),'note',coalesce(p->>'note',''),'cards',p->'cards','at',at_time,'actor',actor_name,'deleted',false);
 arr:='[]';found_item:=false;for e in select * from jsonb_array_elements(s->'rounds') loop if e->>'id'=p->>'id' then e:=r;found_item:=true;end if;arr:=arr||jsonb_build_array(e);end loop;
 if not found_item then arr:=arr||jsonb_build_array(r);end if;s:=jsonb_set(s,'{rounds}',arr);
 elsif action='deleteRound' then
 perform poker_private.poker_text(p->>'reason');arr:='[]';found_item:=false;
 for e in select * from jsonb_array_elements(s->'rounds') loop if e->>'id'=p->>'roundId' and not (e->>'deleted')::boolean then e:=e||jsonb_build_object('deleted',true,'deleteReason',p->>'reason');found_item:=true;end if;arr:=arr||jsonb_build_array(e);end loop;
 if not found_item then raise exception 'Rodada não encontrada';end if;s:=jsonb_set(s,'{rounds}',arr);
 elsif action='deleteSession' then
 perform poker_private.poker_text(p->>'reason');s:=s||jsonb_build_object('deletedAt',at_time,'deletedBy',actor_id,'deleteReason',p->>'reason');
 elsif action='restoreSession' then
 if s->>'deletedAt' is null then raise exception 'A partida não está removida';end if;
 perform poker_private.poker_text(p->>'reason');s:=(s-'deletedAt'-'deletedBy'-'deleteReason')||jsonb_build_object('restoredAt',at_time,'restoredBy',actor_id);
 elsif action='finalize' then
 s:=s||jsonb_build_object('status','finished','endedAt',coalesce(s->>'endedAt',at_time));
 perform poker_private.poker_validate_session(s);
 s:=jsonb_set(s,'{closures}',s->'closures'||jsonb_build_array(jsonb_build_object('at',at_time,'actor',actor_name,'revision',(s->>'revision')::integer+1,'snapshot',s-'closures')));
 elsif action='cancel' then
 perform poker_private.poker_text(p->>'reason');s:=s||jsonb_build_object('status','cancelled','endedAt',at_time,'cancelReason',p->>'reason');
 elsif action='reopen' then
 if s->>'status'<>'finished' then raise exception 'Apenas sessões finalizadas podem ser reabertas';end if;
 perform poker_private.poker_text(p->>'reason');s:=s||jsonb_build_object('status','active','correctionReason',p->>'reason');

 else raise exception 'Operação desconhecida';
 end if;
 if s is not null then
 s:=jsonb_set(s,'{revision}',to_jsonb((s->>'revision')::integer+1));perform poker_private.poker_validate_session(s);
 if action='create' then insert into public.poker_sessions(id,data) values(sid,s);else update public.poker_sessions set data=s,updated_at=now() where id=sid;end if;
 after_value:=s;
 end if;
 insert into public.poker_operations(id,actor,command) values(op,actor_id,command);
 insert into public.poker_audit(id,session_id,actor,data) values(op,sid,actor_id,jsonb_build_object('id',op,'sessionId',sid,'type',action,'actor',actor_name,'actorId',actor_id,'at',at_time,'reason',coalesce(p->>'reason',''),'before',before_value,'after',after_value));
 return jsonb_build_object('ok',true,'sessionId',sid);
end; $$;



commit;