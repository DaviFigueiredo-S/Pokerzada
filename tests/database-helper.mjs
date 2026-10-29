import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
export async function database({beforeLatest=false}={}){
 const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key,email text,encrypted_password text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,service_role;
 grant execute on function auth.uid() to authenticated,service_role;
 `);
 await db.exec(await readFile(new URL('../supabase/001_schema.sql',import.meta.url),'utf8'));
 const files=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort();
 for(const f of files){if(beforeLatest&&f.includes('legado_personagens'))continue;await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));}
 return db;
}
export async function user(db,name,{role='member',approved=true}={}){
 const id=crypto.randomUUID();await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[id,id+'@test.invalid',JSON.stringify({poker_account:true,poker_username:name,poker_bootstrap:role==='owner',poker_password_permanent:true})]);
 if(role!=='owner')await db.query('update public.poker_accounts set role=$2,approved=$3 where user_id=$1',[id,role,approved]);return id;
}
export async function asUser(db,id,sql,params=[]){
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 try{return await db.query(sql,params);}finally{await db.exec('reset role');}
}
export async function asService(db,sql,params=[]){await db.exec('set role service_role');try{return await db.query(sql,params);}finally{await db.exec('reset role');}}
export const command=async(db,actor,type,payload,session=null)=>{const c={id:crypto.randomUUID(),type,payload,...(session?{sessionId:session.id,expectedRevision:session.revision}:{})};await asUser(db,actor,'select public.poker_command($1)',[JSON.stringify(c)]);return c;};
export const session=async(db,id)=>(await db.query('select data from public.poker_sessions where id=$1',[id])).rows[0]?.data;
