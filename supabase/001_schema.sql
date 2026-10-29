-- A Pokerzada Lendária / migração 001. Execute no SQL Editor de um projeto Supabase dedicado.
-- Dados privados; todas as escritas passam por poker_command. Sem acesso anônimo.
begin;
create schema if not exists poker_private;
revoke all on schema poker_private from public,anon;
grant usage on schema poker_private to authenticated;
create table if not exists public.poker_organizers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 1 and 100),
 active boolean not null default true
);
create table if not exists public.poker_players (id uuid primary key, data jsonb not null, created_at timestamptz not null default now());
create table if not exists public.poker_sessions (id uuid primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.poker_settings (id integer primary key check(id=1), data jsonb not null);
create table if not exists public.poker_operations (id uuid primary key, actor uuid not null references auth.users(id), command jsonb not null, created_at timestamptz not null default now());
create table if not exists public.poker_audit (id uuid primary key, session_id uuid references public.poker_sessions(id), actor uuid not null references auth.users(id), data jsonb not null, created_at timestamptz not null default now());
create index if not exists poker_audit_session on public.poker_audit(session_id,created_at);
create index if not exists poker_sessions_status on public.poker_sessions((data->>'status'));
create index if not exists poker_sessions_date on public.poker_sessions((data->>'startedAt'));
create or replace function poker_private.poker_is_organizer() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.poker_organizers where user_id=auth.uid() and active);
$$;
revoke all on function poker_private.poker_is_organizer() from public,anon;
grant execute on function poker_private.poker_is_organizer() to authenticated;
alter table public.poker_organizers enable row level security;
alter table public.poker_players enable row level security;
alter table public.poker_sessions enable row level security;
alter table public.poker_settings enable row level security;
alter table public.poker_operations enable row level security;
alter table public.poker_audit enable row level security;
revoke all on public.poker_organizers,public.poker_players,public.poker_sessions,public.poker_settings,public.poker_operations,public.poker_audit from anon,authenticated;
grant select on public.poker_players,public.poker_sessions,public.poker_settings,public.poker_audit to authenticated;
create policy poker_read_players on public.poker_players for select to authenticated using ((select poker_private.poker_is_organizer()));
create policy poker_read_sessions on public.poker_sessions for select to authenticated using ((select poker_private.poker_is_organizer()));
create policy poker_read_settings on public.poker_settings for select to authenticated using ((select poker_private.poker_is_organizer()));
create policy poker_read_audit on public.poker_audit for select to authenticated using ((select poker_private.poker_is_organizer()));
create or replace function poker_private.poker_integer(v jsonb,low_value bigint default 0,high_value bigint default 100000000) returns bigint language plpgsql immutable set search_path='' as $$
declare n numeric;
begin
 if v is null or jsonb_typeof(v)<>'number' then raise exception 'Valor numérico obrigatório'; end if;
 n:=(v#>>'{}')::numeric;
 if n<>trunc(n) or n<low_value or n>high_value then raise exception 'Valor inteiro fora do limite'; end if;
 return n::bigint;
end; $$;
create or replace function poker_private.poker_text(v text,max_length integer default 500) returns text language plpgsql immutable set search_path='' as $$
begin if v is null or length(trim(v))=0 or length(trim(v))>max_length then raise exception 'Texto obrigatório ou muito longo'; end if; return trim(v); end; $$;
create or replace function poker_private.poker_validate_chips(chips jsonb) returns void language plpgsql immutable set search_path='' as $$
declare i integer;
begin
 if jsonb_typeof(chips) is distinct from 'array' or jsonb_array_length(chips)<>5 then raise exception 'São necessárias cinco denominações'; end if;
 for i in 0..4 loop
 if (chips->i->>'value')::integer<>(array[5,10,25,50,100])[i+1] or coalesce(chips->i->>'color','')!~'^#[0-9a-fA-F]{6}$' then raise exception 'Configuração de fichas inválida'; end if;
 perform poker_private.poker_integer(chips->i->'value',1);
 end loop;
end; $$;
create or replace function poker_private.poker_invested(s jsonb,pid text) returns bigint language sql immutable set search_path='' as $$
 select coalesce(sum((e->>'amount')::bigint),0)::bigint from jsonb_array_elements(s->'entries') e where e->>'playerId'=pid and not (e->>'voided')::boolean;
$$;
create or replace function poker_private.poker_validate_session(s jsonb) returns void language plpgsql set search_path='' as $$
declare p jsonb; e jsonb; r jsonb; c jsonb; v jsonb; pid text; ids text[]; ranks text[]:=array['A','K','Q','J','10','9','8','7','6','5','4','3','2']; hands text[]:=array['Royal Flush','Straight Flush','Quadra','Full House','Flush','Sequência','Trinca','Dois Pares','Um Par','Carta Alta']; total bigint:=0; final_total bigint:=0; cash_total bigint:=0; count_value bigint; i integer;
begin
 if jsonb_typeof(s) is distinct from 'object' or jsonb_typeof(s->'participants') is distinct from 'array' or jsonb_typeof(s->'entries') is distinct from 'array' or jsonb_typeof(s->'rounds') is distinct from 'array' or jsonb_typeof(s->'counts') is distinct from 'array' or jsonb_typeof(s->'cashAdjustments') is distinct from 'array' or jsonb_typeof(s->'finals') is distinct from 'object' then raise exception 'Estrutura da sessão inválida';end if;
 if coalesce(s->>'status','') not in ('active','finished','cancelled') or coalesce(s->>'mode','') not in ('quick','full') or coalesce(s->>'variant','') not in ('texas','omaha','draw') then raise exception 'Modo ou situação inválida'; end if;
 perform poker_private.poker_text(s->>'name',100); perform poker_private.poker_text(s->>'ancient',60);
 perform poker_private.poker_integer(s->'buyin',1);perform poker_private.poker_integer(s->'rebuy',1);perform poker_private.poker_validate_chips(s->'chips');
 if s->>'startedAt' is null then raise exception 'Data obrigatória'; end if; perform (s->>'startedAt')::timestamptz;
 if jsonb_array_length(s->'participants')<2 then raise exception 'Selecione pelo menos dois jogadores'; end if;
 select array_agg(x->>'playerId') into ids from jsonb_array_elements(s->'participants') x;
 if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Jogador duplicado'; end if;
 for p in select * from jsonb_array_elements(s->'participants') loop
 pid:=p->>'playerId';
 if not exists(select 1 from public.poker_players where id=pid::uuid) then raise exception 'Jogador inexistente'; end if;
 if (select count(*) from jsonb_array_elements(s->'entries') item where item->>'playerId'=pid and item->>'kind'='buyin' and not (item->>'voided')::boolean)<>1 then raise exception 'Cada participante precisa de uma entrada'; end if;
 if poker_private.poker_invested(s,pid)<0 then raise exception 'Investimento negativo'; end if;
 total:=total+poker_private.poker_invested(s,pid);
 if s->'finals' ? pid then final_total:=final_total+poker_private.poker_integer(s->'finals'->pid); elsif s->>'status'='finished' then raise exception 'Apuração incompleta'; end if;
 end loop;
 for pid in select jsonb_object_keys(s->'finals') loop if not coalesce(pid,'')=any(ids) then raise exception 'Apuração de não participante'; end if; end loop;
 for e in select * from jsonb_array_elements(s->'entries') loop
 if not coalesce(e->>'playerId','')=any(ids) or coalesce(e->>'kind','') not in ('buyin','rebuy','adjustment') then raise exception 'Lançamento inválido'; end if;
 perform (e->>'id')::uuid; perform poker_private.poker_integer(e->'amount',case when e->>'kind'='adjustment' then -100000000 else 1 end);
 if e->>'kind'='adjustment' then perform poker_private.poker_text(e->>'reason'); end if;
 end loop;
 if (select count(*)<>count(distinct item->>'id') from jsonb_array_elements(s->'entries') item) then raise exception 'Lançamento duplicado'; end if;
 for e in select * from jsonb_array_elements(s->'cashAdjustments') loop cash_total:=cash_total+poker_private.poker_integer(e->'amount',-100000000);perform poker_private.poker_text(e->>'reason');end loop;
 for e in select * from jsonb_array_elements(s->'counts') loop
 if not coalesce(e->>'playerId','')=any(ids) or jsonb_array_length(e->'quantities')<>5 then raise exception 'Contagem inválida'; end if;
 count_value:=0;for i in 0..4 loop count_value:=count_value+poker_private.poker_integer(e->'quantities'->i,0,1000000)*(array[5,10,25,50,100])[i+1];end loop;
 if poker_private.poker_integer(e->'amount')<>count_value then raise exception 'Total da contagem incorreto';end if;
 end loop;
 if (select count(*)<>count(distinct item->>'number') from jsonb_array_elements(s->'rounds') item where not (item->>'deleted')::boolean) then raise exception 'Número de rodada duplicado'; end if;
 for r in select * from jsonb_array_elements(s->'rounds') loop
 if jsonb_typeof(r->'winners') is distinct from 'array' or jsonb_typeof(r->'cards') is distinct from 'array' then raise exception 'Vencedores e cartas devem ser listas';end if;
 perform poker_private.poker_text(r->>'id',36);perform (r->>'id')::uuid; perform poker_private.poker_integer(r->'number',1,100000);
 if coalesce(r->>'hand','')<>'' and not (r->>'hand')=any(hands) then raise exception 'Categoria inválida'; end if;
 if length(coalesce(r->>'note',''))>1000 or jsonb_array_length(r->'winners')<1 then raise exception 'Rodada inválida'; end if;
 if (select count(*)<>count(distinct x) from jsonb_array_elements_text(r->'winners') x) then raise exception 'Vencedor duplicado'; end if;
 for pid in select * from jsonb_array_elements_text(r->'winners') loop if not coalesce(pid,'')=any(ids) then raise exception 'Vencedor não participa';end if;end loop;
 if jsonb_array_length(r->'cards')>52 or (select count(*)<>count(distinct (item->>'rank')||(item->>'suit')) from jsonb_array_elements(r->'cards') item) then raise exception 'Carta duplicada'; end if;
 for c in select * from jsonb_array_elements(r->'cards') loop
 if not coalesce(c->>'rank','')=any(ranks) or not coalesce(c->>'suit','')=any(array['♠','♥','♦','♣']) or (coalesce(c->>'owner','')<>'board' and not coalesce(c->>'owner','')=any(ids)) then raise exception 'Carta inválida'; end if;
 end loop;
 if (select count(*) from jsonb_array_elements(r->'cards') item where item->>'owner'='board')>(case when s->>'variant'='draw' then 0 else 5 end) then raise exception 'Quantidade de cartas comunitárias inválida';end if;
 foreach pid in array ids loop

 if (select count(*) from jsonb_array_elements(r->'cards') item where item->>'owner'=pid)>(case s->>'variant' when 'texas' then 2 when 'omaha' then 4 else 5 end) then raise exception 'Cartas individuais em excesso';end if;
 end loop;
 end loop;
 if s->>'status'='finished' then
 if total<>final_total+cash_total then raise exception 'Divergência no fechamento';end if;
 if (s->>'endedAt')::timestamptz<(s->>'startedAt')::timestamptz then raise exception 'Início no futuro';end if;
 end if;
end; $$;
create or replace function poker_private.poker_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not poker_private.poker_is_organizer() then raise exception 'Organizador não autorizado' using errcode='42501';end if;
 return jsonb_build_object('schema',1,'revision',(select count(*) from public.poker_operations),
 'players',coalesce((select jsonb_agg(data order by created_at,id) from public.poker_players),'[]'::jsonb),
 'sessions',coalesce((select jsonb_agg(data order by data->>'startedAt',id) from public.poker_sessions),'[]'::jsonb),
 'settings',(select data from public.poker_settings where id=1),

 'audit',coalesce((select jsonb_agg(data order by created_at,id) from public.poker_audit),'[]'::jsonb),
 'operations',coalesce((select jsonb_agg(id order by created_at) from public.poker_operations),'[]'::jsonb));
end; $$;
create or replace function poker_private.poker_command(command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare op uuid:=(command->>'id')::uuid; action text:=command->>'type'; p jsonb:=command->'payload'; sid uuid; s jsonb; before_value jsonb; after_value jsonb; stored_command jsonb; stored_actor uuid; actor_id uuid:=auth.uid(); actor_name text; pid text; e jsonb; r jsonb; arr jsonb; parts jsonb:='[]'; entries jsonb:='[]'; i integer; found_item boolean; amount bigint; count_value bigint:=0; at_time text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 if not poker_private.poker_is_organizer() then raise exception 'Organizador não autorizado' using errcode='42501';end if;
 if op is null or p is null or jsonb_typeof(p)<>'object' or action is null then raise exception 'Comando inválido';end if;
 if action in ('rebuy','adjust','final','count','presence') then perform poker_private.poker_text(p->>'playerId',36);end if;
 if action='mode' and coalesce(p->>'mode','') not in ('quick','full') then raise exception 'Modo inválido';end if;
 if action='presence' and jsonb_typeof(p->'present') is distinct from 'boolean' then raise exception 'Presença inválida';end if;
 select display_name into actor_name from public.poker_organizers where user_id=actor_id;
 perform pg_advisory_xact_lock(hashtextextended(op::text,0));
 select x.command,x.actor into stored_command,stored_actor from public.poker_operations x where id=op;
 if found then if stored_command<>command or stored_actor<>actor_id then raise exception 'Identificador reutilizado com conteúdo diferente';end if;return jsonb_build_object('ok',true,'duplicate',true);end if;
 if action not in ('create','player','settings') then
 sid:=(command->>'sessionId')::uuid;
 select data into s from public.poker_sessions where id=sid for update;
 if s is null then raise exception 'Sessão não encontrada';end if;
 if command->'expectedRevision' is null or (command->>'expectedRevision')::bigint is distinct from (s->>'revision')::bigint then raise exception 'A sessão mudou em outro aparelho. Atualize e confira.';end if;
 if s->>'status'<>'active' and action<>'reopen' then raise exception 'Sessão bloqueada; abra uma correção';end if;
 before_value:=s;
 end if;
 if action='player' then
 sid:=null;pid:=(p->>'id')::uuid::text;perform poker_private.poker_text(p->>'name',60);
 if length(coalesce(p->>'avatar',''))>200000 or (coalesce(p->>'avatar','')<>'' and (p->>'avatar')!~'^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') then raise exception 'Foto inválida';end if;
 select data into before_value from public.poker_players where id=pid::uuid for update;
 after_value:=jsonb_build_object('id',pid,'name',trim(p->>'name'),'avatar',coalesce(p->>'avatar',''),'active',coalesce((p->>'active')::boolean,true));
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
 if not exists(select 1 from public.poker_players where id=pid::uuid and (data->>'active')::boolean) then raise exception 'Jogador indisponível';end if;
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
 r:=jsonb_build_object('id',(p->>'id')::uuid,'number',p->'number','winners',p->'winners','hand',coalesce(p->>'hand',''),'note',coalesce(p->>'note',''),'cards',p->'cards','at',at_time,'actor',actor_name,'deleted',false);
 arr:='[]';found_item:=false;for e in select * from jsonb_array_elements(s->'rounds') loop if e->>'id'=p->>'id' then e:=r;found_item:=true;end if;arr:=arr||jsonb_build_array(e);end loop;
 if not found_item then arr:=arr||jsonb_build_array(r);end if;s:=jsonb_set(s,'{rounds}',arr);
 elsif action='deleteRound' then
 perform poker_private.poker_text(p->>'reason');arr:='[]';found_item:=false;
 for e in select * from jsonb_array_elements(s->'rounds') loop if e->>'id'=p->>'roundId' and not (e->>'deleted')::boolean then e:=e||jsonb_build_object('deleted',true,'deleteReason',p->>'reason');found_item:=true;end if;arr:=arr||jsonb_build_array(e);end loop;
 if not found_item then raise exception 'Rodada não encontrada';end if;s:=jsonb_set(s,'{rounds}',arr);
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
-- Revogar acesso direto a helpers e expor apenas as duas operações autenticadas.
revoke all on function poker_private.poker_integer(jsonb,bigint,bigint),poker_private.poker_text(text,integer),poker_private.poker_validate_chips(jsonb),poker_private.poker_invested(jsonb,text),poker_private.poker_validate_session(jsonb),poker_private.poker_snapshot(),poker_private.poker_command(jsonb) from public,anon,authenticated;
grant execute on function poker_private.poker_snapshot(),poker_private.poker_command(jsonb) to authenticated;
create or replace function public.poker_snapshot() returns jsonb language sql security invoker set search_path='' as $$ select poker_private.poker_snapshot(); $$;
create or replace function public.poker_command(command jsonb) returns jsonb language sql security invoker set search_path='' as $$ select poker_private.poker_command(command); $$;
revoke all on function public.poker_snapshot(),public.poker_command(jsonb) from public,anon,authenticated;
grant execute on function public.poker_snapshot(),public.poker_command(jsonb) to authenticated;
-- Projeções relacionais somente de leitura; security_invoker mantém as regras das tabelas.
create or replace view public.poker_participations with(security_invoker=true) as select s.id session_id,(p->>'playerId')::uuid player_id,p from public.poker_sessions s cross join lateral jsonb_array_elements(s.data->'participants') p;

create or replace view public.poker_entries with(security_invoker=true) as select s.id session_id,(e->>'id')::uuid id,(e->>'playerId')::uuid player_id,e from public.poker_sessions s cross join lateral jsonb_array_elements(s.data->'entries') e;
create or replace view public.poker_chip_counts with(security_invoker=true) as select s.id session_id,c from public.poker_sessions s cross join lateral jsonb_array_elements(s.data->'counts') c;
create or replace view public.poker_rounds with(security_invoker=true) as select s.id session_id,(r->>'id')::uuid id,r from public.poker_sessions s cross join lateral jsonb_array_elements(s.data->'rounds') r;
create or replace view public.poker_round_winners with(security_invoker=true) as select r.session_id,r.id round_id,w#>>'{}' player_id from public.poker_rounds r cross join lateral jsonb_array_elements(r.r->'winners') w;
create or replace view public.poker_cards with(security_invoker=true) as select r.session_id,r.id round_id,c from public.poker_rounds r cross join lateral jsonb_array_elements(r.r->'cards') c;
create or replace view public.poker_results with(security_invoker=true) as select s.id session_id,f.key::uuid player_id,f.value::bigint received_cents from public.poker_sessions s cross join lateral jsonb_each_text(s.data->'finals') f;
grant select on public.poker_participations,public.poker_entries,public.poker_chip_counts,public.poker_rounds,public.poker_round_winners,public.poker_cards,public.poker_results to authenticated;
revoke all on public.poker_participations,public.poker_entries,public.poker_chip_counts,public.poker_rounds,public.poker_round_winners,public.poker_cards,public.poker_results from anon;
insert into public.poker_settings(id,data) values(1,'{"buyin":500,"rebuy":500,"reducedMotion":false,"achievements":true,"chips":[{"value":5,"color":"#dfdfd7"},{"value":10,"color":"#c73c46"},{"value":25,"color":"#357ac0"},{"value":50,"color":"#16966c"},{"value":100,"color":"#222a33"}]}') on conflict do nothing;
insert into public.poker_players(id,data)
 select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,jsonb_build_object('id','00000000-0000-4000-8000-'||lpad(n::text,12,'0'),'name',name,'avatar','','active',true)
 from unnest(array['Marcos Aurélio','Anthony','Brunão','Guto','Joao Victor','Broken','Wilson','Rezende','Davi']) with ordinality as names(name,n)
 on conflict do nothing;
-- Realtime é opcional; a aplicação também reconcilia a cada 10 segundos.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='poker_sessions') then alter publication supabase_realtime add table public.poker_sessions;end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='poker_players') then alter publication supabase_realtime add table public.poker_players;end if;
 end if;
end; $$;
create policy poker_private_organizers on public.poker_organizers for all to authenticated using (false) with check (false);
create policy poker_private_operations on public.poker_operations for all to authenticated using (false) with check (false);
create index if not exists poker_operations_actor on public.poker_operations(actor);
create index if not exists poker_audit_actor on public.poker_audit(actor);
commit;






