begin;
do $$ declare uid uuid:=gen_random_uuid();begin
 insert into auth.users(id,email) values(uid,'sql-test-'||uid||'@example.invalid');
 insert into public.poker_accounts(user_id,display_name,username,role,approved) values(uid,'Teste transacional','sql_'||substr(replace(uid::text,'-',''),1,20),'organizer',true);
 perform set_config('request.jwt.claim.sub',uid::text,true);
end;$$;
set local role authenticated;
do $test$
declare sid uuid:=gen_random_uuid(); op uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid();
 p1 text:='00000000-0000-4000-8000-000000000001';p2 text:='00000000-0000-4000-8000-000000000009';
 cmd jsonb; snap jsonb;s jsonb;rev integer:=1;failed boolean; item jsonb;
begin
 snap:=public.poker_snapshot();assert jsonb_array_length(snap->'players')=9,'Seed';
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','create','payload',jsonb_build_object('id',sid,'name','Teste integrado','ancient','Ancião','startedAt','2026-01-01T20:00:00Z','mode','quick','variant','texas','buyin',500,'rebuy',500,'chips',snap->'settings'->'chips','players',jsonb_build_array(p1,p2))));
 cmd:=jsonb_build_object('id',op,'type','rebuy','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('playerId',p2,'amount',500));
 perform public.poker_command(cmd);rev:=rev+1;
 assert (public.poker_command(cmd)->>'duplicate')::boolean,'Idempotência';
 failed:=false;begin perform public.poker_command(jsonb_set(cmd,'{id}',to_jsonb(gen_random_uuid())));exception when others then failed:=true;end;assert failed,'Conflito';
 for item in select value from jsonb_array_elements('[{"type":"rebuy","payload":{"amount":500}},{"type":"mode","payload":{}},{"type":"presence","payload":{"playerId":"00000000-0000-4000-8000-000000000001"}},{"type":"rebuy","payload":{"playerId":"00000000-0000-4000-8000-000000000001","amount":-1}}]') loop
 failed:=false;begin perform public.poker_command(item||jsonb_build_object('id',gen_random_uuid(),'sessionId',sid,'expectedRevision',rev));exception when others then failed:=true;end;assert failed,'Payload inválido aceito';end loop;
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','count','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('playerId',p1,'quantities',jsonb_build_array(0,0,4,2,3),'useFinal',false)));rev:=rev+1;
 select value into s from jsonb_array_elements(public.poker_snapshot()->'sessions') where value->>'id'=sid::text;
 assert (s->'counts'->0->>'amount')::integer=500 and s->'finals'='{}'::jsonb and jsonb_array_length(s->'entries')=3,'Contagem independente';
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','round','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('id',rid,'number',1,'winners',jsonb_build_array(p1,p2),'hand','Full House','cards','[]'::jsonb,'note','Empate')));rev:=rev+1;
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','mode','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('mode','full')));rev:=rev+1;
 select value into s from jsonb_array_elements(public.poker_snapshot()->'sessions') where value->>'id'=sid::text;
 assert jsonb_array_length(s->'rounds')=1 and jsonb_array_length(s->'entries')=3,'Rodada independente';
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','final','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('playerId',p1,'amount',500)));rev:=rev+1;
 failed:=false;begin perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','finalize','sessionId',sid,'expectedRevision',rev,'payload','{}'::jsonb));exception when others then failed:=true;end;assert failed,'Apuração incompleta';
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','final','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('playerId',p2,'amount',999)));rev:=rev+1;
 failed:=false;begin perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','finalize','sessionId',sid,'expectedRevision',rev,'payload','{}'::jsonb));exception when others then failed:=true;end;assert failed,'Divergência de um centavo';
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','final','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('playerId',p2,'amount',1000)));rev:=rev+1;
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','finalize','sessionId',sid,'expectedRevision',rev,'payload','{}'::jsonb));rev:=rev+1;
 select value into s from jsonb_array_elements(public.poker_snapshot()->'sessions') where value->>'id'=sid::text;
 assert s->>'status'='finished' and jsonb_array_length(s->'closures')=1,'Fechamento e snapshot';
 failed:=false;begin perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','final','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('playerId',p2,'amount',0)));exception when others then failed:=true;end;assert failed,'Sessão bloqueada';
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','reopen','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('reason','Correção testada')));rev:=rev+1;
 select value into s from jsonb_array_elements(public.poker_snapshot()->'sessions') where value->>'id'=sid::text;
 assert s->>'status'='active' and jsonb_array_length(s->'closures')=1,'Reabertura preserva fechamento';
 failed:=false;begin update public.poker_players set data='{}';exception when insufficient_privilege then failed:=true;end;assert failed,'Escrita direta bloqueada';
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 assert (select count(*) from public.poker_players)=0,'RLS organizador não autorizado';
 failed:=false;begin perform public.poker_snapshot();exception when insufficient_privilege then failed:=true;end;assert failed,'RPC não autorizado';
end;$test$;
set local role anon;
do $$declare failed boolean:=false;begin begin perform public.poker_snapshot();exception when insufficient_privilege then failed:=true;end;assert failed,'Anônimo bloqueado';end;$$;
reset role;
select 'PASS: finanças, idempotência, conflitos, contagens, rodadas, fechamento, correção e permissões; rollback integral' as integration_result;
rollback;
