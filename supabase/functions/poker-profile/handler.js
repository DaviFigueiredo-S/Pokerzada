const ids=new Set(['executivo','praiano','magnata','palhaco','mafioso','cowboy','rei','heroi','mago','pirata','piloto','casual','lorde','chef','lutador','coringa']);
export function validateCharacter(p){
  if(!p||!ids.has(p.outfit))throw Error('Escolha um traje do catálogo.');
  const c=p.crop;
  if(!c||!['x','y','zoom'].every(k=>typeof c[k]==='number'&&Number.isFinite(c[k]))||c.x<0||c.x>1||c.y<0||c.y>1||c.zoom<1||c.zoom>3)throw Error('Enquadramento inválido.');
  return {outfit:p.outfit,crop:{x:c.x,y:c.y,zoom:c.zoom}};
}
export function createProfileHandler({url,secretKey,publicKey,processPhoto,fetcher=fetch}){
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json'}});
  return async req=>{
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return reply({message:'Método não permitido.'},405);
    try{
      const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');if(!token)return reply({message:'Entre na sua conta.'},401);
      const call=async(path,body,admin=false)=>{
        const key=admin?secretKey:publicKey;
        const r=await fetcher(url+path,{method:body?'POST':'GET',headers:{apikey:key,'Content-Type':'application/json',...(!admin?{Authorization:'Bearer '+token}:key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{})},body:body?JSON.stringify(body):undefined});
        const d=await r.json().catch(()=>({}));if(!r.ok){const e=Error(r.status<500&&['P0001','42501','40001'].includes(d.code)?d.message:'Não foi possível acessar o perfil.');e.status=r.status;throw e;}return d;
      };
      const user=await call('/auth/v1/user');
      // Limite aplicado ao stream, antes de materializar o JSON completo.
      const reader=req.body?.getReader();let size=0,chunks=[];
      if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1600000){await reader.cancel();return reply({message:'Fotografia muito grande.'},413);}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
      const p=JSON.parse(new TextDecoder().decode(bytes));
      if(!['read','save'].includes(p.action))throw Error('Operação desconhecida.');
      const target=p.playerId||user.id;
      const context=await call('/rest/v1/rpc/poker_character_read',{actor_id:user.id,target_id:target},true);
      if(p.action==='read')return reply(context);
      const character=validateCharacter(p.character);
      if(!Number.isSafeInteger(p.revision)||p.revision<0)throw Error('Versão inválida. Reabra o editor.');
      if(!/^[a-f0-9-]{36}$/i.test(p.operationId||''))throw Error('Identificador inválido.');
      const photos=processPhoto(p.source===undefined?context.source:p.source,character.crop);
      return reply(await call('/rest/v1/rpc/poker_character_save',{actor_id:user.id,target_id:target,operation_id:p.operationId,expected_revision:p.revision,appearance:character,photo_source:photos.source,photo_avatar:photos.avatar},true));
    }catch(e){return reply({message:e instanceof SyntaxError?'Solicitação inválida.':e.message},e.status===401?401:e.status===403?403:400);}
  };
}
