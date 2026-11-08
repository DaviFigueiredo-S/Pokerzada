-- Um mesmo identificador em vários envios não deve ocupar todas as conexões
-- enquanto espera por um bloqueio. O cliente conserva o identificador e
-- consulta poker_operation_status antes de reenviar.
create or replace function poker_private.poker_command(command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old_player jsonb; result jsonb; operation_id uuid:=(command->>'id')::uuid;
begin
 if not poker_private.poker_is_member() then raise exception 'Acesso negado' using errcode='42501';end if;
 perform pg_advisory_xact_lock_shared(730304);
 if operation_id is null then raise exception 'Comando inválido';end if;
 if not pg_try_advisory_xact_lock(hashtextextended(operation_id::text,0)) then
  raise exception 'Este envio já está sendo processado. Aguarde a confirmação.' using errcode='55P03';
 end if;
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
