import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {database,user,asUser,asService,command,session} from './database-helper.mjs';
test('Postgres: migrações, exclusão real, autorização, personagens e rodadas',async t=>{
 const db=await database();
 try{
  const owner=await user(db,'Davi303',{role:'owner'}),admin=await user(db,'AdminTeste',{role:'admin'}),member=await user(db,'MembroTeste'),other=await user(db,'OutroTeste'),org=await user(db,'OrganizadorTeste',{role:'organizer'});
  const chips=(await db.query('select data from public.poker_settings')).rows[0].data.chips;
  const create=async players=>{const id=crypto.randomUUID();await command(db,owner,'create',{id,name:'Mesa de teste',ancient:'Davi303',startedAt:'2026-10-28T12:00:00Z',mode:'full',variant:'texas',buyin:500,rebuy:500,chips,players});return id;};
  const prepare=(actor,target)=>asService(db,'select public.poker_delete_account_prepare($1,$2) as result',[actor,target]);
  const finish=(actor,target)=>asService(db,'select public.poker_delete_account_finish($1,$2) as result',[actor,target]);
  await t.test('RLS e privilégios: tabelas privadas e novas RPCs não são acessíveis pelo cliente',async()=>{
   const open=(await db.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','poker_private') and c.relkind='r' and not c.relrowsecurity")).rows;assert.deepEqual(open,[]);
   for(const role of ['anon','authenticated']){
    const granted=(await db.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('poker_delete_account_prepare','poker_delete_account_finish','poker_character_read','poker_character_save') and has_function_privilege($1,p.oid,'EXECUTE')",[role])).rows;assert.deepEqual(granted,[]);
   }
  });
  await t.test('membro e organizador não excluem contas; principal e TcheTche protegidos',async()=>{
   for(const actor of [member,org])await assert.rejects(prepare(actor,other),/Administrador/);
   await assert.rejects(prepare(admin,owner),/principal/);await assert.rejects(prepare(admin,admin),/Davi303/);
   await assert.rejects(asUser(db,member,'select public.poker_delete_account_prepare($1,$2)',[owner,other]),/permission denied/);
   await assert.rejects(db.query('delete from auth.users where id=$1',[owner]),/principal/);
  });
  await t.test('gatilho não reinserta nome duplicado legado ao suspender integrante',async()=>{
   await db.exec('alter table public.poker_players disable trigger unique_player_identity');
   await db.query("update public.poker_players set data=data||'{\"name\":\"LegadoDuplicado\"}' where id in ($1,$2)",[member,other]);
   await db.exec('alter table public.poker_players enable trigger unique_player_identity');
   await command(db,owner,'deactivate',{userId:other,active:false});await command(db,owner,'deactivate',{userId:other,active:true});
  });
  let sid;
  await t.test('mesa ativa impede exclusão, inclusive mesa removida logicamente',async()=>{
   sid=await create([member,other]);await assert.rejects(prepare(owner,other),/mesa ativa/);
   const s=await session(db,sid);await command(db,owner,'deleteSession',{reason:'Teste'},s);await assert.rejects(prepare(owner,other),/mesa ativa/);
   await command(db,owner,'restoreSession',{reason:'Teste'},await session(db,sid));
  });
  await t.test('excluir primeira, intermediária, última e única rodada preserva centavos e IDs',async()=>{
   const s=await session(db,sid),ids=[];for(let i=0;i<4;i++){const id=crypto.randomUUID();ids.push(id);await command(db,owner,'round',{id,winners:[member],hand:'Trinca',cards:[]},s);}
   const before=await session(db,sid);assert.deepEqual(before.rounds.map(r=>r.number),[1,2,3,4]);
   for(const id of [ids[0],ids[2],ids[3],ids[1]]){const c=await command(db,owner,'deleteRound',{roundId:id,reason:'Lançamento de teste'},await session(db,sid));await asUser(db,owner,'select public.poker_command($1)',[JSON.stringify(c)]);}
   const after=await session(db,sid);assert.deepEqual(after.entries,before.entries);assert.deepEqual(after.finals,before.finals);assert.deepEqual(after.rounds.map(r=>r.id),ids);assert.equal(after.rounds.filter(r=>!r.deleted).length,0);
   await assert.rejects(command(db,owner,'deleteRound',{roundId:ids[0],reason:'Repetido'},after),/Rodada não encontrada/);
   await assert.rejects(command(db,member,'round',{id:crypto.randomUUID(),winners:[member],cards:[]},after),/não autorizado/);
  });
  const appearance={outfit:'rei',crop:{x:.5,y:.5,zoom:1}},op=crypto.randomUUID();
  const saveArgs=[member,member,op,0,JSON.stringify(appearance),'data:image/jpeg;base64,/9j/','data:image/jpeg;base64,/9j/'];
  const save='select public.poker_character_save($1,$2,$3,$4,$5,$6,$7) as result';
  await t.test('foto privada, autorização no backend, versão e idempotência',async()=>{
   await assert.rejects(asService(db,'select public.poker_character_read($1,$2)',[member,other]),/editar/);
   await assert.rejects(asUser(db,member,'select public.poker_character_read($1,$2)',[member,member]),/permission denied/);
   await assert.rejects(asUser(db,member,'select * from poker_private.character_photos'),/permission denied/);
   await asService(db,save,saveArgs);assert.equal((await asService(db,save,saveArgs)).rows[0].result.duplicate,true);
   await assert.rejects(asService(db,save,[...saveArgs.slice(0,2),crypto.randomUUID(),...saveArgs.slice(3)]),/outro aparelho/);
   const snapshot=(await asUser(db,member,'select public.poker_snapshot() as data')).rows[0].data;
   assert.ok(!JSON.stringify(snapshot).includes('photo_source'));assert.ok(!JSON.stringify(snapshot).includes('"source"'));
   const p=snapshot.players.find(p=>p.id===member);await command(db,owner,'player',{id:member,name:'NomeNovo',avatar:p.avatar,active:true});
   const stored=(await db.query('select data from public.poker_players where id=$1',[member])).rows[0].data;assert.equal(stored.character.outfit,'rei');assert.equal(stored.characterRevision,1);
  });
  await t.test('exclusão com histórico apaga Auth, perfil pessoal e foto; valores persistem',async()=>{
   await command(db,owner,'final',{playerId:member,amount:1000,expectedCountRevision:0},await session(db,sid));
   await command(db,owner,'final',{playerId:other,amount:0,expectedCountRevision:0},await session(db,sid));
   await command(db,owner,'finalize',{},await session(db,sid));const before=await session(db,sid);
   await assert.rejects(command(db,owner,'deleteRound',{roundId:before.rounds[0].id,reason:'Sessão encerrada'},before),/Sessão bloqueada; abra uma correção/);
   await prepare(owner,member);
   await assert.rejects(asUser(db,member,'select public.poker_snapshot()'),/não autorizada/);
   await assert.rejects(finish(owner,member),/ainda não foi removida/);
   await assert.rejects(command(db,owner,'deactivate',{userId:member,active:true}),/em exclusão/);
   await db.query('delete from auth.users where id=$1',[member]);
   const pending=(await asUser(db,owner,'select public.poker_snapshot() as data')).rows[0].data.accounts.find(a=>a.user_id===member);
   assert.equal(pending.deletion_pending,true);assert.match(pending.username,/Exclusão pendente/);
   await assert.rejects(asUser(db,member,'select public.poker_snapshot()'),/não autorizada/);
   await finish(owner,member);
   assert.equal((await asUser(db,owner,'select public.poker_snapshot() as data')).rows[0].data.accounts.some(a=>a.user_id===member),false);
   assert.equal((await prepare(owner,member)).rows[0].result.done,true);
   assert.equal((await db.query('select * from public.poker_accounts where user_id=$1',[member])).rows.length,0);
   assert.equal((await db.query('select * from poker_private.character_photos where player_id=$1',[member])).rows.length,0);
   const p=(await db.query('select data from public.poker_players where id=$1',[member])).rows[0].data;
   assert.equal(p.name,'Integrante removido');assert.equal(p.accountId,null);assert.equal(p.avatar,'');
   const after=await session(db,sid);assert.deepEqual(after.finals,before.finals);assert.deepEqual(after.entries.map(e=>e.amount),before.entries.map(e=>e.amount));assert.equal(after.status,'finished');
   await assert.rejects(command(db,owner,'player',{id:member,name:'Voltar',avatar:'',active:true}),/anonimizado/);
   await user(db,'MembroTeste'); // nome de autenticação reutilizável, identidade nova
  });
  await t.test('conta sem histórico também é removida e conclusão pode ser repetida',async()=>{
   const id=await user(db,'SemHistorico');await prepare(admin,id);await db.query('delete from auth.users where id=$1',[id]);await finish(admin,id);await finish(admin,id);
   assert.equal((await db.query('select * from auth.users where id=$1',[id])).rows.length,0);
  });
  for(const name of ['auth-database','auth-metadata','nightclub','collaborative'])await t.test('regressão SQL existente: '+name,async()=>{
   await db.exec(await readFile(new URL('./'+name+'.integration.sql',import.meta.url),'utf8'));
  });
 }finally{await db.close();}
});
