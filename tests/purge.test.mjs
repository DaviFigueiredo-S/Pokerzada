import test from 'node:test';import assert from 'node:assert/strict';
import {database,user,asUser,command,session} from './database-helper.mjs';
test('exclusão definitiva: proprietário, revisão, recibos, repetição e bloqueio de recuperação',async()=>{
 const db=await database();try{
 const owner=await user(db,'Davi303',{role:'owner'}),member=await user(db,'Membro'),admin=await user(db,'Admin',{role:'admin'}),id=crypto.randomUUID();
 const chips=(await db.query('select data from public.poker_settings')).rows[0].data.chips;
 const create=await command(db,owner,'create',{id,name:'Teste',ancient:'Davi303',startedAt:new Date().toISOString(),mode:'full',variant:'texas',buyin:500,rebuy:500,chips,players:[owner,member]});
 const purge=(actor,rev)=>asUser(db,actor,'select public.poker_purge_session($1,$2)',[id,rev]);
 await assert.rejects(purge(owner,1),/Arquivo/);await command(db,owner,'deleteSession',{reason:'Teste'},await session(db,id));
 const s=await session(db,id),before=(await asUser(db,owner,'select public.poker_snapshot() as s')).rows[0].s.revision;
 for(const actor of [member,admin])await assert.rejects(purge(actor,s.revision),/Somente/);
 await assert.rejects(purge(owner,0),/mudou/);await purge(owner,s.revision);await purge(owner,s.revision);
 assert.equal(await session(db,id),undefined);assert.ok((await asUser(db,owner,'select public.poker_snapshot() as s')).rows[0].s.revision>before);
 await assert.rejects(command(db,owner,'restoreSession',{reason:'Voltar'},s));
 await assert.rejects(asUser(db,owner,'select public.poker_command($1)',[JSON.stringify({...create,id:crypto.randomUUID()})]),/permanentemente/);
 assert.equal((await db.query('select * from public.poker_players where id=$1',[member])).rows.length,1);
 }finally{await db.close();}
});
