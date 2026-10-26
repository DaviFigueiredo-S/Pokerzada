
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthHandler,normalizeUsername} from '../supabase/functions/poker-auth/handler.js';
function fixture(){
 const users=[],calls=[];let allowed=true;
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
 const secretKey='test-server-key',publicKey='test-public-key';
 const fetcher=async(url,opts)=>{const p=new URL(url).pathname,b=JSON.parse(opts.body||'{}');calls.push({p,opts,b});
 if(p.endsWith('poker_auth_rate'))return json(allowed);
 if(p.endsWith('poker_auth_lookup')){const u=users.find(u=>u.app_metadata.poker_username.toLowerCase()===b.username.toLowerCase());return json(u?{userId:u.id,email:u.email,active:true}:null);}
 if(p==='/auth/v1/admin/users'){assert.equal(opts.headers.apikey,secretKey);const u={...b,id:crypto.randomUUID()};users.push(u);return json(u);}
 if(p==='/auth/v1/token'){const u=users.find(u=>u.email===b.email&&u.password===b.password);return u?json({access_token:'session-'+u.id,refresh_token:'refresh',user:{id:u.id,email:u.email}}):json({},400);}
 if(p==='/auth/v1/user'){const u=users.find(u=>opts.headers.Authorization==='Bearer session-'+u.id);if(!u)return json({},401);if(opts.method==='PUT')u.password=b.password;return json({id:u.id,email:u.email});}
 return json({},404);
 };
 const handler=createAuthHandler({url:'https://test.supabase.co',secretKey,publicKey,fetcher});
 const call=async(body,headers={})=>{const r=await handler(new Request('https://test/functions/v1/poker-auth',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}));return {status:r.status,data:await r.json()};};
 return {call,users,calls,limit(){allowed=false;}};
}
test('cadastro e login por usuário, sem e-mail fornecido, mantêm metadados administrativos no servidor',async()=>{const f=fixture(),password='SenhaDeTeste123!';assert.equal((await f.call({action:'register',username:'Anthony',password,confirmPassword:password})).status,200);assert.match(f.users[0].email,/^[0-9a-f-]+@accounts.pokerzada.invalid$/);assert.equal(f.users[0].app_metadata.poker_bootstrap,undefined);const login=await f.call({action:'login',username:'ANTHONY',password});assert.equal(login.status,200);assert.ok(login.data.access_token);assert.equal((await f.call({action:'register',username:'anthony',password,confirmPassword:password})).status,400);assert.equal(f.users.length,1);});
test('cadastro valida confirmação, força e nome reservado',async()=>{const f=fixture();for(const body of [{username:'Anthony',password:'x',confirmPassword:'x'},{username:'Anthony',password:'PasswordLong123',confirmPassword:'other'},{username:'Davi303',password:'PasswordLong123',confirmPassword:'PasswordLong123'}])assert.equal((await f.call({action:'register',...body})).status,400);assert.equal(f.users.length,0);assert.throws(()=>normalizeUsername('<script>'));});
test('bootstrap exige segredo administrativo e só cria principal uma vez',async()=>{const f=fixture(),p={action:'bootstrap',password:'TemporaryLong123!'};assert.equal((await f.call(p)).status,403);assert.equal(f.users.length,0);const r=await f.call(p,{apikey:'test-server-key'});assert.equal(r.status,200);assert.equal(r.data.mustChangePassword,true);assert.equal(f.users[0].app_metadata.poker_bootstrap,true);assert.equal((await f.call(p,{apikey:'test-server-key'})).status,409);});
test('troca de senha valida JWT e senha atual; nova senha autentica e antiga falha',async()=>{const f=fixture(),old='OriginalLong123!',password='ReplacementLong456!';await f.call({action:'register',username:'Anthony',password:old,confirmPassword:old});const login=await f.call({action:'login',username:'Anthony',password:old});const p={action:'password',currentPassword:old,password,confirmPassword:password};assert.equal((await f.call(p)).status,401);assert.equal((await f.call({...p,currentPassword:'wrong'},{authorization:'Bearer '+login.data.access_token})).status,400);assert.equal((await f.call(p,{authorization:'Bearer '+login.data.access_token})).status,200);assert.equal((await f.call({action:'login',username:'Anthony',password:old})).status,400);assert.equal((await f.call({action:'login',username:'Anthony',password})).status,200);});
test('limite de tentativas bloqueia autenticação antes de acessar credenciais',async()=>{const f=fixture();f.limit();assert.equal((await f.call({action:'login',username:'Anthony',password:'anything'})).status,400);assert.equal(f.calls.filter(c=>c.p==='/auth/v1/token').length,0);});

