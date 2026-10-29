import test from 'node:test';
import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import {OUTFITS,character,cropRect,renderCharacter,outfitSvg} from '../dist/js/characters.js';
import {photoFormat} from '../dist/js/character-editor.js';
import {photoProcessor} from '../supabase/functions/poker-profile/photo.js';
import {validateCharacter,createProfileHandler} from '../supabase/functions/poker-profile/handler.js';
const processPhoto=photoProcessor(jpeg);
test('16 trajes distintos, fallback seguro e proporções comuns',()=>{
 assert.equal(OUTFITS.length,16);assert.equal(new Set(OUTFITS.map(x=>x.id)).size,16);assert.equal(new Set(OUTFITS.map(x=>outfitSvg(x.id))).size,16);
 for(const o of OUTFITS){const html=renderCharacter({character:{outfit:o.id}});assert.ok(html.includes('viewBox="0 0 120 168"'));assert.ok(html.includes('character-face'));assert.ok(!html.includes('<img'));}
 assert.equal(character({outfit:'<script>'}).outfit,'casual');assert.ok(!renderCharacter({avatar:'javascript:alert(1)'}).includes('<img'));assert.ok(!renderCharacter({avatar:'data:image/svg+xml;base64,PHN2Zz4='}).includes('<img'));
});
test('recorte horizontal, vertical, zoom e validação de entradas',()=>{
 assert.deepEqual(cropRect(1000,500,{x:1,y:0,zoom:1}),{x:500,y:0,side:500});assert.deepEqual(cropRect(500,1000,{x:0,y:1,zoom:2}),{x:0,y:750,side:250});
 assert.throws(()=>cropRect(0,500));assert.throws(()=>validateCharacter({outfit:'casual',crop:{x:Infinity,y:.5,zoom:1}}));
 assert.throws(()=>photoFormat(new TextEncoder().encode('<svg>')));assert.equal(photoFormat(new Uint8Array([255,216,255])),'image/jpeg');
});
test('servidor decodifica, recorta em 240px, remove metadados e rejeita fotos corrompidas',()=>{
 const raw={width:400,height:200,data:new Uint8Array(400*200*4).fill(255),comments:['METADADO_PRIVADO']};
 const encoded=jpeg.encode(raw,80).data,source='data:image/jpeg;base64,'+Buffer.from(encoded).toString('base64');
 assert.ok(Buffer.from(encoded).includes(Buffer.from('METADADO_PRIVADO')));
 const photo=processPhoto(source,{x:0,y:.5,zoom:1});const result=jpeg.decode(Buffer.from(photo.avatar.split(',')[1],'base64'));
 assert.equal(result.width,240);assert.equal(result.height,240);assert.ok(!Buffer.from(photo.source.split(',')[1],'base64').includes(Buffer.from('METADADO_PRIVADO')));
 assert.throws(()=>processPhoto('data:image/jpeg;base64,/9j/',{x:0,y:0,zoom:1}),/decodificar/);
 assert.throws(()=>processPhoto('data:image/svg+xml;base64,PHN2Zz4=',{}),/inválida/);
 assert.deepEqual(processPhoto('',{x:.5,y:.5,zoom:1}),{source:'',avatar:''});
});
test('Edge de personagem exige JWT e autorização antes de processar qualquer foto',async()=>{
 const calls=[];let allow=false,processed=0;
 const fetcher=async(url,o)=>{calls.push({url,o});if(url.endsWith('/auth/v1/user'))return Response.json({id:'actor'});if(url.endsWith('poker_character_read'))return allow?Response.json({player:{characterRevision:0},source:''}):Response.json({code:'42501',message:'Você não pode editar este personagem'},{status:403});if(url.endsWith('poker_character_save'))return Response.json({ok:true});throw Error('Rota inesperada');};
 const handler=createProfileHandler({url:'https://test.invalid',publicKey:'public',secretKey:'private',fetcher,processPhoto:()=>{processed++;return {source:'',avatar:''};}});
 const body={action:'save',playerId:'target',revision:0,operationId:crypto.randomUUID(),character:{outfit:'casual',crop:{x:.5,y:.5,zoom:1}}};
 const req=(auth=true)=>new Request('https://test.invalid',{method:'POST',headers:auth?{Authorization:'Bearer jwt'}:{},body:JSON.stringify(body)});
 assert.equal((await handler(req(false))).status,401);assert.equal(calls.length,0);
 assert.equal((await handler(req())).status,403);assert.equal(processed,0);
 allow=true;assert.equal((await handler(req())).status,200);assert.equal(processed,1);
 const last=calls.at(-1);assert.equal(last.o.headers.apikey,'private');assert.equal(JSON.parse(last.o.body).actor_id,'actor');
});
