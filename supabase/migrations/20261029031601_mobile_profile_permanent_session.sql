begin;
create function poker_private.purge_session(session_id uuid,expected_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb; op uuid:=gen_random_uuid();
begin
 if not poker_private.poker_is_owner() then raise exception 'Somente Davi303 pode deletar permanentemente' using errcode='42501';end if;
 perform pg_advisory_xact_lock_shared(730304);
 select data into s from public.poker_sessions where id=session_id for update;
 if s is null then return jsonb_build_object('ok',true,'alreadyDeleted',true);end if;
 if s->>'deletedAt' is null then raise exception 'Remova a partida no Arquivo antes de deletar permanentemente';end if;
 if (s->>'revision')::bigint is distinct from expected_revision then raise exception 'A partida mudou. Atualize antes de confirmar.' using errcode='40001';end if;
 delete from public.poker_audit a where a.session_id=purge_session.session_id;
 update public.poker_operations set command=jsonb_build_object('type','purgedOperation','sessionId',session_id) where command->>'sessionId'=session_id::text or command->'payload'->>'id'=session_id::text;
 delete from public.poker_sessions where id=session_id;
 insert into public.poker_operations(id,actor,command) values(op,auth.uid(),jsonb_build_object('id',op,'type','purgeSession','targetId',session_id));
 insert into public.poker_audit(id,actor,data) values(op,auth.uid(),jsonb_build_object('id',op,'type','purgeSession','targetId',session_id,'actorId',auth.uid(),'at',now()));
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function poker_private.purge_session(uuid,bigint) from public,anon;
grant execute on function poker_private.purge_session(uuid,bigint) to authenticated;
create function public.poker_purge_session(session_id uuid,expected_revision bigint) returns jsonb language sql security invoker set search_path='' as $$select poker_private.purge_session(session_id,expected_revision);$$;
revoke all on function public.poker_purge_session(uuid,bigint) from public,anon;
grant execute on function public.poker_purge_session(uuid,bigint) to authenticated;
create function poker_private.prevent_purged_session() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.poker_operations where command->>'type'='purgeSession' and command->>'targetId'=new.id::text) then raise exception 'Partida deletada permanentemente';end if;
 return new;
end;$$;
revoke all on function poker_private.prevent_purged_session() from public,anon,authenticated;
create trigger prevent_purged_session before insert on public.poker_sessions for each row execute function poker_private.prevent_purged_session();
commit;
