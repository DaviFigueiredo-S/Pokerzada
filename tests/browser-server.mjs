// Servidor exclusivo de testes: Auth simulado, SQL real em Postgres/PGlite isolado.
// Não usa configurações, contas ou chaves do Supabase compartilhado.
import http from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';
import {database,user,asUser,asService,command,session} from './database-helper.mjs';
import {createAuthHandler} from '../supabase/functions/poker-auth/handler.js';
import {createProfileHandler} from '../supabase/functions/poker-profile/handler.js';
import {photoProcessor} from '../supabase/functions/poker-profile/photo.js';import jpeg from 'jpeg-js';
let db,fixture,failFinish=false,queue=Promise.resolve();
const key='local-fixture-secret',pub='local-fixture-public',url='https://fixture.supabase.co';
const rpcs={poker_purge_session:['session_id','expected_revision'],poker_snapshot:[],poker_command:['command'],poker_operation_status:['operation_id'],poker_delete_account_prepare:['actor_id','target_id'],poker_delete_account_finish:['actor_id','target_id'],poker_character_read:['actor_id','target_id'],poker_character_save:['actor_id','target_id','operation_id','expected_revision','appearance','photo_source','photo_avatar'],poker_auth_lookup:['username'],poker_name_available:['candidate'],poker_auth_rate:['bucket','max_attempts']};
const sessionToken=id=>({access_token:'test-'+id,refresh_token:'test-'+id,user:{id}});
async function reset(){failFinish=false;if(db)await db.close();db=await database();const owner=await user(db,'Davi303',{role:'owner'}),member=await user(db,'Marcos'),remove=await user(db,'ExcluirTeste');const ids=[owner,member];for(let i=2;i<16;i++)ids.push(await user(db,'Jogador'+i));
 const chips=(await db.query('select data from public.poker_settings')).rows[0].data.chips,sid=crypto.randomUUID();
 await command(db,owner,'create',{id:sid,name:'Noite de validação',ancient:'Davi303',startedAt:'2026-10-28T12:00:00Z',mode:'full',variant:'texas',buyin:500,rebuy:500,chips,players:ids.slice(0,10)});
 fixture={owner,member,remove,ids,sid};return fixture;}
async function api(pathname,body={},token='',admin=false,method='POST'){
 const id=token.replace(/^test-/,'');
 if(pathname.startsWith('/rest/v1/rpc/')){
  const fn=pathname.split('/').at(-1),names=rpcs[fn];if(!names)return Response.json({message:'RPC indisponível'},{status:404});
  if(fn==='poker_delete_account_finish'&&failFinish){failFinish=false;return Response.json({message:'Falha simulada após Auth'},{status:503});}
  try{const values=names.map(n=>typeof body[n]==='object'?JSON.stringify(body[n]):body[n]);const sql='select public.'+fn+'('+names.map((_,i)=>'$'+(i+1)).join(',')+') as value';const result=await (admin?asService(db,sql,values):asUser(db,id,sql,values));return Response.json(result.rows[0].value);}
  catch(e){return Response.json({message:e.message,code:e.code},{status:e.code==='42501'?403:400});}
 }
 if(pathname==='/auth/v1/user'){const u=(await db.query('select id,email from auth.users where id::text=$1',[id])).rows[0];return u?Response.json(u):Response.json({message:'Sessão inválida'},{status:401});}
 if(pathname.startsWith('/auth/v1/token')){
  if(body.refresh_token)return Response.json(sessionToken(body.refresh_token.replace('test-','')));
  const u=(await db.query('select id from auth.users where email=$1',[body.email])).rows[0];return u&&body.password==='PasswordTeste123'?Response.json(sessionToken(u.id)):Response.json({message:'Inválido'},{status:400});
 }
 if(pathname.startsWith('/auth/v1/admin/users/')&&admin&&method==='DELETE'){
  try{const r=await db.query('delete from auth.users where id=$1 returning id',[pathname.split('/').at(-1)]);return r.rows.length?Response.json({ok:true}):Response.json({},{status:404});}catch(e){return Response.json({message:e.message},{status:400});}
 }
 if(pathname==='/auth/v1/admin/users'&&admin){try{await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[crypto.randomUUID(),body.email,JSON.stringify(body.app_metadata)]);return Response.json({ok:true});}catch(e){return Response.json({message:e.message},{status:400});}}
 if(pathname==='/auth/v1/logout')return Response.json({ok:true});
 return Response.json({message:'Rota inexistente'},{status:404});
}
const fetcher=async(href,opts={})=>{const u=new URL(href);return api(u.pathname+u.search,JSON.parse(opts.body||'{}'),(opts.headers?.Authorization||'').replace('Bearer ',''),opts.headers?.apikey===key,opts.method);};
const auth=createAuthHandler({url,secretKey:key,publicKey:pub,fetcher});
const profile=createProfileHandler({url,secretKey:key,publicKey:pub,fetcher,processPhoto:photoProcessor(jpeg)});
await reset();
http.createServer((req,res)=>{queue=queue.then(async()=>{
 try{const u=new URL(req.url,'http://127.0.0.1:4174'),chunks=[];for await(const c of req)chunks.push(c);const raw=Buffer.concat(chunks).toString();
 let response;
 if(u.pathname==='/fixture/reset')response=Response.json(await reset());
 else if(u.pathname==='/fixture/info')response=Response.json(fixture);
 else if(u.pathname==='/fixture/fail-finish'){failFinish=true;response=Response.json({ok:true});}
 else if(u.pathname==='/fixture/many'){const s=await session(db,fixture.sid),id=crypto.randomUUID();await command(db,fixture.owner,'create',{...s,id,players:fixture.ids});response=Response.json({sid:id});}
 else if(u.pathname==='/functions/v1/poker-auth'||u.pathname==='/functions/v1/poker-profile')response=await(u.pathname.endsWith('poker-auth')?auth:profile)(new Request(url+u.pathname,{method:'POST',headers:req.headers,body:raw}));
 else if(u.pathname.startsWith('/auth/')||u.pathname.startsWith('/rest/'))response=await api(u.pathname+u.search,raw?JSON.parse(raw):{},(req.headers.authorization||'').replace('Bearer ',''));
 else{const root=path.resolve('dist'),file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))throw Error('Path');const bytes=await readFile(file);response=new Response(bytes,{headers:{'Content-Type':({'html':'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'})[file.split('.').at(-1)]||'application/octet-stream'}});}
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({message:e.message}));}
 }).catch(e=>{res.writeHead(500);res.end(e.message);});}).listen(4174,'127.0.0.1',()=>console.log('Fixture pronta: http://127.0.0.1:4174'));
