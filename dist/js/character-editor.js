import {OUTFITS,character,cropRect,renderCharacter} from './characters.js';
export const MAX_PHOTO_BYTES=5*1024*1024;
export function photoFormat(bytes){
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 throw Error('Conteúdo inválido. Escolha uma fotografia JPEG, PNG ou WebP.');
}
export async function preparePhoto(file){
 if(!file||file.size>MAX_PHOTO_BYTES||file.size===0)throw Error('Escolha uma fotografia de até 5 MB.');
 const type=photoFormat(new Uint8Array(await file.slice(0,16).arrayBuffer()));
 if(file.type&&file.type!==type)throw Error('O formato informado não corresponde ao conteúdo da foto.');
 let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw Error('Fotografia corrompida ou formato não suportado neste navegador.');}
 try{
  if(bitmap.width>8192||bitmap.height>8192||bitmap.width*bitmap.height>24000000)throw Error('Use uma foto de até 24 megapixels e 8192 pixels por lado.');
  const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#e2e8f0';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  let quality=.88,result=canvas.toDataURL('image/jpeg',quality);
  while(result.length>1400000&&quality>.5){quality-=.1;result=canvas.toDataURL('image/jpeg',quality);}
  if(result.length>1400000)throw Error('Escolha uma fotografia menor para salvar com segurança.');
  return result;
 }finally{bitmap.close();}
}
export class CharacterEditor{
 constructor(root,{player,context,save,cancel,saved}){
  this.root=root;this.player=player;this.draft=character(context.player?.character||player.character);this.source=context.source||'';this.revision=context.player?.characterRevision||0;
  this.save=save;this.cancel=cancel;this.saved=saved;this.busy=false;this.disposed=false;this.loadVersion=0;this.abort=new AbortController();
  root.innerHTML='<form id="character-form"><p class="help">Seu retrato e traje aparecem para os integrantes autorizados. A foto de edição fica privada. JPEG, PNG ou WebP, até 5 MB; a cópia de edição é otimizada para até 1200 pixels.</p><div class="character-workbench"><div class="character-preview" aria-label="Prévia do personagem"></div><div class="character-photo-tools"><label class="field">Adicionar ou substituir foto<input id="character-photo" type="file" accept="image/jpeg,image/png,image/webp"></label><canvas class="crop-stage" width="240" height="240" aria-label="Arraste para enquadrar a foto; ou use os controles abaixo"></canvas><p class="help">Arraste a foto para enquadrar.</p>'+[['zoom','Zoom',1,3,.01],['x','Posição horizontal',0,1,.01],['y','Posição vertical',0,1,.01]].map(([id,label,min,max,step])=>'<label class="field">'+label+'<input type="range" name="'+id+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+this.draft.crop[id]+'"></label>').join('')+'<button type="button" class="btn ghost small" data-character="remove">Remover somente a foto</button></div></div><fieldset class="outfit-fieldset"><legend>Escolha seu traje · 16 originais</legend><div class="outfit-grid">'+OUTFITS.map(o=>'<label class="outfit-choice"><input type="radio" name="outfit" value="'+o.id+'" '+(this.draft.outfit===o.id?'checked':'')+'>'+renderCharacter({character:{outfit:o.id}},{size:'card'})+'<span>'+o.name+'</span></label>').join('')+'</div></fieldset><p class="error" role="alert"></p><p class="character-save-status help" role="status" aria-live="polite">Experimente à vontade. Só salvamos quando você confirmar.</p><div class="form-actions"><button type="button" class="btn ghost" data-character="reset">Restaurar padrão (foto e traje)</button><button type="button" class="btn ghost" data-character="cancel">Cancelar</button><button type="submit" class="btn primary">Salvar meu personagem</button></div></form>';
  const opts={signal:this.abort.signal};
  root.addEventListener('input',e=>{if(e.target.name==='outfit')this.draft.outfit=e.target.value;else if(['x','y','zoom'].includes(e.target.name))this.draft.crop[e.target.name]=Number(e.target.value);this.paint();},opts);
  root.addEventListener('change',async e=>{if(e.target.id!=='character-photo')return;const v=++this.loadVersion;this.loading=true;this.message('Preparando fotografia…');root.querySelector('.error').textContent='';try{const source=await preparePhoto(e.target.files[0]);if(this.disposed||v!==this.loadVersion)return;await this.loadImage(source);if(this.disposed||v!==this.loadVersion)return;this.source=source;this.photoUnavailable=false;this.draft.crop={x:.5,y:.5,zoom:1};this.paint();this.message('Foto preparada. Confirme para salvar.');}catch(err){this.error(err);}finally{if(v===this.loadVersion)this.loading=false;}},opts);
  root.addEventListener('click',e=>{const action=e.target.closest('[data-character]')?.dataset.character;if(!action||this.busy)return;if(action==='cancel')this.cancel();else{++this.loadVersion;this.loading=false;this.photoUnavailable=false;this.source='';this.bitmap?.close();this.bitmap=null;if(action==='reset'){this.draft=character();root.querySelector('[name=outfit][value=casual]').checked=true;}this.draft.crop={x:.5,y:.5,zoom:1};this.paint();}},opts);
  root.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();e.stopPropagation();if(this.busy)return;if(this.loading){this.error(Error('Aguarde o carregamento da fotografia.'));return;}if(this.photoUnavailable){this.error(Error('Não foi possível abrir sua foto atual. Substitua ou remova a foto explicitamente antes de salvar.'));return;}const value={source:this.source,character:this.draft,revision:this.revision};const signature=JSON.stringify(value);if(signature!==this.lastSignature){this.operationId=crypto.randomUUID();this.lastSignature=signature;}this.busy=true;this.setDisabled(true);this.message('Salvando e validando no servidor…');root.querySelector('.error').textContent='';try{await this.save({...value,operationId:this.operationId});this.busy=false;this.saved();}catch(err){this.error(err);this.message('Não foi confirmado. Seu rascunho continua aberto; tente salvar novamente.');}finally{this.busy=false;if(!this.disposed)this.setDisabled(false);}},opts);
  const canvas=root.querySelector('canvas');
  canvas.addEventListener('pointerdown',e=>{if(!this.bitmap||this.busy)return;canvas.setPointerCapture(e.pointerId);this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,crop:{...this.draft.crop}};},opts);
  canvas.addEventListener('pointermove',e=>{if(!this.drag||e.pointerId!==this.drag.id)return;const side=Math.min(this.bitmap.width,this.bitmap.height)/this.draft.crop.zoom,scale=canvas.getBoundingClientRect().width/side;const clamp=v=>Math.max(0,Math.min(1,v));this.draft.crop.x=clamp(this.drag.crop.x-(e.clientX-this.drag.x)/(scale*(this.bitmap.width-side)||Infinity));this.draft.crop.y=clamp(this.drag.crop.y-(e.clientY-this.drag.y)/(scale*(this.bitmap.height-side)||Infinity));this.paint();},opts);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>this.drag=null,opts);
  this.paint();if(this.source){const v=this.loadVersion;this.loading=true;(async()=>{let source=this.source;if(!source.startsWith('data:image/jpeg;'))source=await preparePhoto(await(await fetch(source)).blob());if(v!==this.loadVersion||this.disposed)return;this.source=source;await this.loadImage(source,v);this.paint();})().catch(e=>{if(v===this.loadVersion){this.photoUnavailable=true;this.error(Error('Não foi possível abrir sua foto atual. Feche e tente novamente, ou substitua/remova a foto.'));this.paint();}}).finally(()=>{if(v===this.loadVersion)this.loading=false;});}
 }
 async loadImage(source,version=this.loadVersion){const blob=await(await fetch(source)).blob(),bitmap=await createImageBitmap(blob);if(this.disposed||version!==this.loadVersion){bitmap.close();return;}this.bitmap?.close();this.bitmap=bitmap;}
 paint(){if(this.disposed)return;const canvas=this.root.querySelector('canvas'),ctx=canvas.getContext('2d');ctx.fillStyle='#1e293b';ctx.fillRect(0,0,240,240);let avatar='';if(this.bitmap){const r=cropRect(this.bitmap.width,this.bitmap.height,this.draft.crop);ctx.drawImage(this.bitmap,r.x,r.y,r.side,r.side,0,0,240,240);avatar=canvas.toDataURL('image/jpeg',.8);}this.root.querySelector('.character-preview').innerHTML=renderCharacter({...this.player,avatar,character:this.draft},{size:'preview'});for(const k of ['x','y','zoom'])this.root.querySelector('[name='+k+']').value=this.draft.crop[k];}
 setDisabled(value){for(const el of this.root.querySelectorAll('input,button'))el.disabled=value;}
 message(text){if(!this.disposed)this.root.querySelector('.character-save-status').textContent=text;}
 error(err){if(!this.disposed)this.root.querySelector('.error').textContent=err.message;}
 destroy(){this.disposed=true;this.abort.abort();this.bitmap?.close();}
}
