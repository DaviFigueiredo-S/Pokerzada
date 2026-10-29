
const url=process.env.SUPABASE_URL;
const secret=process.env.SUPABASE_SECRET_KEY;
if(!url||!secret)throw Error('Defina SUPABASE_URL e SUPABASE_SECRET_KEY somente no ambiente deste terminal.');
if(new URL(url).protocol!=='https:')throw Error('Use HTTPS.');
const password=process.env.POKER_ADMIN_PASSWORD;
if(!password||password.length<12||password.length>128)throw Error('Escolha uma senha definitiva entre 12 e 128 caracteres.');
const res=await fetch(url+'/functions/v1/poker-auth',{method:'POST',headers:{apikey:secret,'Content-Type':'application/json'},body:JSON.stringify({action:'bootstrap',password})});
const data=await res.json();
if(!res.ok)throw Error(data.message||'Inicialização recusada.');
console.log('Conta Davi303 criada. Entre com a senha definitiva que você escolheu. Não há troca obrigatória.');
