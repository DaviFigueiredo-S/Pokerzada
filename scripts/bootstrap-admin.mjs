import {randomBytes} from 'node:crypto';
const url=process.env.SUPABASE_URL;
const secret=process.env.SUPABASE_SECRET_KEY;
if(!url||!secret)throw Error('Defina SUPABASE_URL e SUPABASE_SECRET_KEY somente no ambiente deste terminal.');
if(new URL(url).protocol!=='https:')throw Error('Use HTTPS.');
const password=randomBytes(24).toString('base64url');
const res=await fetch(url+'/functions/v1/poker-auth',{method:'POST',headers:{apikey:secret,'Content-Type':'application/json'},body:JSON.stringify({action:'bootstrap',password})});
const data=await res.json();
if(!res.ok)throw Error(data.message||'Inicialização recusada.');
console.log('Conta Davi303 criada. Senha temporária (não será gravada em arquivo):');
console.log(password);
console.log('Entre no site e troque a senha imediatamente. Não compartilhe este terminal.');

