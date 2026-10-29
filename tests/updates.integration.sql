
begin;
-- Todos os usuários e registros deste teste são revertidos.
do $$declare owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid();begin
 assert not exists(select 1 from public.poker_accounts where role='owner'),'Use um projeto de teste sem administrador existente';
 insert into auth.users(id,email,encrypted_password,raw_app_meta_data)
 values(owner_id,owner_id||'@example.invalid','test-hash-before',jsonb_build_object('poker_account',true,'poker_username','Davi303','poker_bootstrap',true)),
 (member_id,member_id||'@example.invalid','member-test-hash',jsonb_build_object('poker_account',true,'poker_username','Anthony'));
 perform set_config('test.owner_id',owner_id::text,true);perform set_config('test.member_id',member_id::text,true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 assert (select role='owner' and must_change_password from public.poker_accounts where user_id=owner_id),'Bootstrap';
end;$$;
set local role authenticated;
do $$declare denied boolean:=false;begin
 assert jsonb_array_length(public.poker_snapshot()->'players')=0,'Senha temporária bloqueia leitura';
 begin perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','settings','payload','{}'::jsonb));exception when insufficient_privilege then denied:=true;end;
 assert denied,'Senha temporária bloqueia organização';
end;$$;
reset role;
update auth.users set encrypted_password='test-hash-after' where id=current_setting('test.owner_id')::uuid;
set local role authenticated;
do $test$
declare oid uuid:=current_setting('test.owner_id')::uuid; mid uuid:=current_setting('test.member_id')::uuid; sid uuid:=gen_random_uuid();
 p1 text:='00000000-0000-4000-8000-000000000001';p2 text:='00000000-0000-4000-8000-000000000002';s jsonb;snap jsonb;rev integer;denied boolean;i integer;original_revision integer;
begin
 snap:=public.poker_snapshot();assert not (snap->'account'->>'must_change_password')::boolean,'Troca libera acesso';
 assert (select count(*) from jsonb_array_elements(snap->'accounts') a where a->>'username' in ('Davi303','Anthony'))=2,'Principal lista cadastros';
 perform set_config('request.jwt.claim.sub',mid::text,true);
 assert jsonb_array_length(public.poker_snapshot()->'players')=0,'Cadastro aguarda liberação';
 perform set_config('request.jwt.claim.sub',oid::text,true);
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','access','payload',jsonb_build_object('userId',mid,'approved',true)));
 perform set_config('request.jwt.claim.sub',mid::text,true);
 assert jsonb_array_length(public.poker_snapshot()->'players')=9,'Membro autorizado lê';
 assert jsonb_array_length(public.poker_snapshot()->'accounts')=0,'Membro não lista contas';
 denied:=false;begin perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','settings','payload','{}'::jsonb));exception when insufficient_privilege then denied:=true;end;assert denied,'Membro não escreve';
 denied:=false;begin perform public.poker_auth_lookup('Davi303');exception when insufficient_privilege then denied:=true;end;assert denied,'Lookup de identidade privado';
 denied:=false;begin update public.poker_accounts set role='owner' where user_id=mid;exception when insufficient_privilege then denied:=true;end;assert denied,'Promoção direta negada';
 perform set_config('request.jwt.claim.sub',oid::text,true);
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','role','payload',jsonb_build_object('userId',mid,'role','organizer')));
 perform set_config('request.jwt.claim.sub',mid::text,true);
 assert public.poker_snapshot()->'account'->>'role'='organizer','Promoção aplicada';
 denied:=false;begin perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','role','payload',jsonb_build_object('userId',oid,'role','member')));exception when insufficient_privilege then denied:=true;end;assert denied,'Organizador não concede nem remove poderes';
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','create','payload',jsonb_build_object('id',sid,'name','TESTE atualizações','ancient','Ancião independente','startedAt','2026-10-25T20:00:00Z','mode','full','variant','texas','buyin',500,'rebuy',500,'chips',snap->'settings'->'chips','players',jsonb_build_array(p1,p2))));
 select value into s from jsonb_array_elements(public.poker_snapshot()->'sessions') where value->>'id'=sid::text;rev:=(s->>'revision')::int;
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','count','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('playerId',p1,'quantities',jsonb_build_array(0,0,0,10,5),'useFinal',true)));rev:=rev+1;
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','count','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('playerId',p2,'quantities',jsonb_build_array(0,0,0,0,0),'useFinal',true)));rev:=rev+1;
 original_revision:=rev;
 for i in 1..3 loop
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','round','sessionId',sid,'expectedRevision',original_revision,'payload',jsonb_build_object('id',gen_random_uuid(),'number',99,'winners',jsonb_build_array(p1),'hand','Trinca','cards','[]'::jsonb,'note','Não incluir observação nova')));rev:=rev+1;
 end loop;
 select value into s from jsonb_array_elements(public.poker_snapshot()->'sessions') where value->>'id'=sid::text;
 assert s->'finals'->>p1='1000' and s->'finals'->>p2='0','Apuração automática e zero';
 assert jsonb_array_length(s->'entries')=2,'Rodadas e contagem não mudam entradas';
 assert (select jsonb_agg(value->'number' order by (value->>'number')::int) from jsonb_array_elements(s->'rounds'))='[1,2,3]'::jsonb,'Número único com revisão compartilhada';
 assert s->'rounds'->0->>'note'='','Novas notas não criadas';
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','finalize','sessionId',sid,'expectedRevision',rev,'payload','{}'::jsonb));rev:=rev+1;
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','deleteSession','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('reason','Teste exclusão lógica')));rev:=rev+1;
 assert not exists(select 1 from jsonb_array_elements(public.poker_snapshot()->'sessions') v where v->>'id'=sid::text),'Excluída sai do snapshot';
 assert not exists(select 1 from public.poker_sessions where id=sid),'RLS oculta partida excluída';
 denied:=false;begin perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','restoreSession','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('reason','Teste')));exception when insufficient_privilege then denied:=true;end;assert denied,'Organizador não restaura';
 perform set_config('request.jwt.claim.sub',oid::text,true);
 assert exists(select 1 from jsonb_array_elements(public.poker_snapshot()->'deletedSessions') v where v->>'id'=sid::text),'Principal vê lixeira';
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','restoreSession','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('reason','Teste recuperação')));rev:=rev+1;
 assert exists(select 1 from jsonb_array_elements(public.poker_snapshot()->'sessions') v where v->>'id'=sid::text and v->>'status'='finished'),'Recuperação preserva fechamento';
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','role','payload',jsonb_build_object('userId',mid,'role','member')));
 denied:=false;begin perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','role','payload',jsonb_build_object('userId',oid,'role','member')));exception when others then denied:=true;end;assert denied,'Principal protegido de rebaixamento';
 perform set_config('request.jwt.claim.sub',mid::text,true);
 assert public.poker_snapshot()->'account'->>'role'='member','Rebaixamento preserva conta';
 denied:=false;begin perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','deleteSession','sessionId',sid,'expectedRevision',rev,'payload',jsonb_build_object('reason','Tentativa sem permissão')));exception when insufficient_privilege then denied:=true;end;assert denied,'Membro não exclui por RPC';
 perform set_config('request.jwt.claim.sub',oid::text,true);
 assert exists(select 1 from jsonb_array_elements(public.poker_snapshot()->'audit') a where a->>'type'='role' and a->>'actor'='Davi303'),'Mudança de permissão auditada';
 perform set_config('test.session_id',sid::text,true);
end;$test$;
reset role;
-- Notas históricas continuam existindo após editar uma rodada.
update public.poker_sessions set data=jsonb_set(data,'{rounds,0,note}','"Memória antiga"'::jsonb) where id=current_setting('test.session_id')::uuid;
set local role authenticated;
do $$declare s jsonb;sid uuid:=current_setting('test.session_id')::uuid;begin
 select value into s from jsonb_array_elements(public.poker_snapshot()->'sessions') where value->>'id'=sid::text;
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','reopen','sessionId',sid,'expectedRevision',(s->>'revision')::int,'payload',jsonb_build_object('reason','Teste nota antiga')));
 select value into s from jsonb_array_elements(public.poker_snapshot()->'sessions') where value->>'id'=sid::text;
 perform public.poker_command(jsonb_build_object('id',gen_random_uuid(),'type','round','sessionId',sid,'expectedRevision',(s->>'revision')::int,'payload',(s->'rounds'->0)||jsonb_build_object('number',100,'note','Apagar?')));
 select value into s from jsonb_array_elements(public.poker_snapshot()->'sessions') where value->>'id'=sid::text;
 assert s->'rounds'->0->>'note'='Memória antiga' and s->'rounds'->0->>'number'='1','Edição preserva nota e número antigos';
end;$$;
reset role;
select 'PASS: bootstrap, troca obrigatória, leitura, promoção/rebaixamento, RLS/RPC, contagem 1000/zero, rodadas 1/2/3, exclusão/recuperação, auditoria e notas históricas; rollback integral' as update_result;
rollback;

