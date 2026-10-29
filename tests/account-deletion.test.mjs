import test from 'node:test';import assert from 'node:assert/strict';
import {deleteAccount} from '../supabase/functions/poker-auth/account-deletion.js';
test('exclusão confirma somente depois do Auth e permite retomar falhas parciais',async()=>{
 const id=crypto.randomUUID(),calls=[];let fail=true,removed=false,done=false;
 const api=async(path,opts)=>{calls.push(path);if(path==='/auth/v1/user')return {id:'actor'};if(path.endsWith('_prepare'))return {done};if(path.includes('/admin/users/')){assert.equal(opts.admin,true);assert.equal(opts.method,'DELETE');if(fail)throw Object.assign(Error('offline'),{status:503});if(removed)throw Object.assign(Error('gone'),{status:404});removed=true;return {};}if(path.endsWith('_finish')){assert.ok(removed);done=true;return {ok:true};}throw Error('unexpected');};
 await assert.rejects(deleteAccount({api,token:'jwt',userId:id}),/Exclusão pendente/);assert.equal(done,false);assert.ok(!calls.some(x=>x.endsWith('_finish')));
 fail=false;assert.equal((await deleteAccount({api,token:'jwt',userId:id})).deleted,true);assert.equal(done,true);
 const count=calls.filter(x=>x.includes('/admin/users/')).length;await deleteAccount({api,token:'jwt',userId:id});assert.equal(calls.filter(x=>x.includes('/admin/users/')).length,count);
});
test('nenhuma remoção é enviada quando banco recusa autorização',async()=>{
 const calls=[];await assert.rejects(deleteAccount({token:'jwt',userId:crypto.randomUUID(),api:async p=>{calls.push(p);if(p==='/auth/v1/user')return {id:'actor'};throw Error('Administrador obrigatório');}}),/Administrador/);assert.ok(!calls.some(p=>p.includes('/admin/users/')));
});
