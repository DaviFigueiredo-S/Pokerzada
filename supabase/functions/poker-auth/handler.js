export function normalizeUsername(value){const name=String(value||'').trim();if(!/^[A-Za-z0-9_]{3,32}$/.test(name))throw Error('Use de 3 a 32 letras, números ou sublinhados.');return name;}
export function validatePassword(value){if(typeof value!=='string'||value.length<12||value.length>128)throw Error('A senha precisa ter entre 12 e 128 caracteres.');return value;}
export function createAuthHandler({url,secretKey,publicKey,fetcher=fetch,randomUUID=()=>crypto.randomUUID()}){
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
 const api=async(path,{body,token,admin=false,method=body?'POST':'GET'}={})=>{const key=admin?secretKey:publicKey;const res=await fetcher(url+path,{method,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:admin&&key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{})},body:body?JSON.stringify(body):undefined});const data=await res.json().catch(()=>({}));if(!res.ok){const e=new Error(res.status>=500?'Serviço de autenticação indisponível. Tente novamente.':'Não foi possível concluir esta etapa de autenticação.');e.status=res.status;throw e;}return data;};
 const rate=async(bucket,max_attempts)=>{const ok=await api('/rest/v1/rpc/poker_auth_rate',{body:{bucket,max_attempts},admin:true});if(!ok)throw Error('Muitas tentativas. Aguarde antes de tentar novamente.');};
 return async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({message:'Método não permitido.'},405);
 try{
 const raw=await req.text();if(raw.length>4096)return reply({message:'Solicitação muito grande.'},413);const p=JSON.parse(raw);
 if(p.action==='bootstrap'){
 if(req.headers.get('apikey')!==secretKey)return reply({message:'Inicialização não autorizada.'},403);
 validatePassword(p.password);
 const existing=await api('/rest/v1/rpc/poker_auth_lookup',{body:{username:'Davi303'},admin:true});if(existing)return reply({message:'A conta principal já existe. Inicialização não repetida.'},409);
 await api('/auth/v1/admin/users',{admin:true,body:{email:randomUUID()+'@accounts.pokerzada.invalid',password:p.password,email_confirm:true,app_metadata:{poker_account:true,poker_username:'Davi303',poker_bootstrap:true,poker_password_permanent:true}}});
 return reply({ok:true,username:'Davi303',mustChangePassword:false});
 }
 if(p.action==='register'||p.action==='login'){
 const username=normalizeUsername(p.username);
 await rate(p.action+':global',p.action==='register'?100:1000);
 await rate(p.action+':'+username.toLowerCase(),p.action==='register'?5:30);
 if(p.action==='register'){
 const available=await api('/rest/v1/rpc/poker_name_available',{body:{candidate:username},admin:true});if(available===false)throw Error('Esse nome já está registrado. Escolha outro para continuar.');
 validatePassword(p.password);if(p.password!==p.confirmPassword)throw Error('As senhas não coincidem.');
 if(username.toLowerCase()==='davi303')throw Error('Nome reservado para a conta principal.');
 const existing=await api('/rest/v1/rpc/poker_auth_lookup',{body:{username},admin:true});if(existing)throw Error('Esse nome de usuário já está cadastrado.');
 await api('/auth/v1/admin/users',{admin:true,body:{email:randomUUID()+'@accounts.pokerzada.invalid',password:p.password,email_confirm:true,app_metadata:{poker_account:true,poker_username:username}}});
 const linked=await api('/rest/v1/rpc/poker_auth_lookup',{body:{username},admin:true});if(!linked)throw Error('Conta criada, mas o vínculo de acesso precisa ser conferido. Não repita o cadastro.');
 return reply({ok:true,message:'Conta criada. Entre e aguarde a autorização da turma.'});
 }
 const account=await api('/rest/v1/rpc/poker_auth_lookup',{body:{username},admin:true});
 if(!account||!account.active)throw Error('Usuário ou senha inválidos.');
 try{return reply(await api('/auth/v1/token?grant_type=password',{body:{email:account.email,password:p.password}}));}catch(e){if(e.status>=500)throw e;throw Error('Usuário ou senha inválidos.');}
 }
 if(p.action==='password'){
 validatePassword(p.password);if(p.password!==p.confirmPassword)throw Error('As senhas não coincidem.');
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');if(!token) return reply({message:'Entre na sua conta.'},401);
 const user=await api('/auth/v1/user',{token});await rate('password:'+user.id,20);
 await api('/auth/v1/token?grant_type=password',{body:{email:user.email,password:p.currentPassword}});
 if(p.currentPassword===p.password)throw Error('Escolha uma senha diferente da temporária.');
 await api('/auth/v1/user',{method:'PUT',token,body:{password:p.password}});
 return reply({ok:true});
 }
 return reply({message:'Operação desconhecida.'},400);
 }catch(e){return reply({message:e instanceof SyntaxError?'Solicitação inválida.':e.message||'Não foi possível concluir.'},400);}
 };
}

