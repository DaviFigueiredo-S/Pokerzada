import {test,expect} from '@playwright/test';
import jpeg from 'jpeg-js';
const base='http://127.0.0.1:4174';
async function connect(page,fixture,role='owner'){
 await page.route('https://fonts.googleapis.com/**',r=>r.abort());
 await page.route('https://fonts.gstatic.com/**',r=>r.abort());
 await page.route('https://fixture.supabase.co/**',async r=>{const u=new URL(r.request().url());const response=await page.request.fetch(base+u.pathname+u.search,{method:r.request().method(),headers:r.request().headers(),data:r.request().postData()||undefined});await r.fulfill({response});});
 await page.addInitScript(({id})=>{const project='https://fixture.supabase.co';localStorage.setItem('pokerzada-cloud-v1',JSON.stringify({supabaseUrl:project,publishableKey:'local-fixture-public'}));sessionStorage.setItem('pokerzada-auth-v1',JSON.stringify({project,session:{access_token:'test-'+id,refresh_token:'test-'+id,user:{id}}}));},{id:fixture[role]});
 await page.goto('/');await expect(page.locator('.shell')).toBeVisible();
}
let fixture,errors;
test.beforeEach(async({request,page})=>{errors=[];page.on('pageerror',error=>errors.push(error.message));fixture=await(await request.post('/fixture/reset')).json();});
test.afterEach(()=>expect(errors).toEqual([]));
test('Legado mantém links, Home limpa, mesa responsiva e 16 assentos',async({page,request})=>{
 await connect(page,fixture);await expect(page.getByText('Sua retrospectiva lendária',{exact:true})).toHaveCount(0);
 await page.goto('/#legado');await expect(page.locator('.legacy-card')).toHaveCount(4);await page.locator('.legacy-card[href="#stats"]').click();await expect(page.locator('.sidebar a[href="#legado"]')).toHaveClass('active');
 for(const route of ['arquivo','hall','stats','retro']){await page.goto('/#'+route);await expect(page.locator('main')).toBeVisible();}
 await page.goto('/#mesa');await expect(page.locator('.arena .character')).toHaveCount(10);await expect(page.locator('.my-seat')).toHaveCount(1);
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:1000});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const boxes=await page.locator('.arena .seat').evaluateAll(xs=>xs.map(x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];expect(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,JSON.stringify({width,i,j,a,b})).toBeTruthy();}
  await page.screenshot({path:'test-results/mesa-'+width+'.png',fullPage:true});
 }
 const many=await(await request.post('/fixture/many')).json();await page.reload();await page.locator('#session-select').selectOption(many.sid);await expect(page.locator('.arena-many .seat')).toHaveCount(16);
});
test('personagem: foto, 16 trajes, rascunho, salvar, recarregar, remover e padrão',async({page})=>{
 await connect(page,fixture,'member');await page.getByRole('button',{name:'Abrir minha conta'}).click();await page.getByRole('button',{name:'🎭 Meu Personagem'}).click();
 await expect(page.locator('.outfit-choice')).toHaveCount(16);
 const data=new Uint8Array(400*300*4).fill(255);for(let i=0;i<data.length;i+=4){data[i]=70;data[i+1]=110;data[i+2]=190;}
 const buffer=Buffer.from(jpeg.encode({width:400,height:300,data},80).data);
 await page.locator('#character-photo').setInputFiles({name:'retrato.jpg',mimeType:'image/jpeg',buffer});await expect(page.locator('.character-save-status')).toContainText('Foto preparada');
 await page.locator('[name=outfit][value=rei]').check();await page.locator('[name=zoom]').fill('1.8');await page.locator('[name=x]').fill('0.2');
 await expect(page.locator('.character-preview .character')).toHaveAttribute('data-outfit','rei');await page.getByRole('button',{name:'Salvar meu personagem',exact:true}).click();await expect(page.locator('#dialog')).not.toBeVisible();
 await page.goto('/#mesa');await expect(page.locator('.my-seat .character')).toHaveAttribute('data-outfit','rei');await page.reload();await expect(page.locator('.my-seat .character')).toHaveAttribute('data-outfit','rei');
 const edit=async()=>{await page.getByRole('button',{name:'Abrir minha conta'}).click();await page.getByRole('button',{name:'🎭 Meu Personagem'}).click();};
 await edit();await page.locator('[name=outfit][value=pirata]').check();await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.locator('.my-seat .character')).toHaveAttribute('data-outfit','rei');
 await edit();await page.getByRole('button',{name:'Remover somente a foto'}).click();await page.getByRole('button',{name:'Salvar meu personagem',exact:true}).click();await expect(page.locator('#dialog')).not.toBeVisible();await expect(page.locator('.my-seat .character img')).toHaveCount(0);await expect(page.locator('.my-seat .character')).toHaveAttribute('data-outfit','rei');
 await edit();await page.getByRole('button',{name:'Restaurar padrão (foto e traje)'}).click();await page.getByRole('button',{name:'Salvar meu personagem',exact:true}).click();await expect(page.locator('#dialog')).not.toBeVisible();await expect(page.locator('.my-seat .character')).toHaveAttribute('data-outfit','casual');
});
test('rodada automática e exclusão confirmada; fichas sincronizam 10 reais e zero',async({page})=>{
 await connect(page,fixture);await page.goto('/#mesa');await page.getByRole('button',{name:'＋ Registrar rodada',exact:true}).click();
 await expect(page.locator('#round-form [name=note],#round-form [name=number]')).toHaveCount(0);await expect(page.locator('#round-form select[name=hand] option')).toHaveCount(11);
 await page.locator('#round-form input[name=winners]').first().check();await page.locator('#round-form select[name=hand]').selectOption('Trinca');await page.getByRole('button',{name:'Salvar rodada'}).click();await expect(page.locator('#dialog')).not.toBeVisible();
 await page.getByRole('button',{name:'Excluir rodada',exact:true}).click();await expect(page.locator('#reason-form')).toContainText('rodada #1');await page.locator('#reason-form textarea').fill('Teste de exclusão');await page.locator('#reason-form button.primary').click();await expect(page.getByText('Nenhuma rodada registrada',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Contar minhas fichas'}).click();await page.locator('#count-form [name=q4]').fill('10');await expect(page.locator('#count-status')).toContainText('confirmados no banco');await page.getByRole('button',{name:'Fechar',exact:true}).last().click();await page.goto('/#placar');await expect(page.locator('#final-'+fixture.owner)).toHaveValue('10.00');await page.reload();await expect(page.locator('#final-'+fixture.owner)).toHaveValue('10.00');
 await page.goto('/#mesa');await page.getByRole('button',{name:'Contar minhas fichas'}).click();await page.getByRole('button',{name:'Registrar zero',exact:true}).click();await expect(page.locator('#count-status')).toContainText('confirmados no banco');await page.getByRole('button',{name:'Fechar',exact:true}).last().click();await page.goto('/#placar');await expect(page.locator('#final-'+fixture.owner)).toHaveValue('0.00');
});
test('conta realmente removida, principal protegido e erro de mesa ativa específico',async({page})=>{
 await connect(page,fixture);await page.goto('/#tchetche');
 const row=page.locator('.admin-users .crew').filter({has:page.getByText('ExcluirTeste',{exact:true})});await row.getByRole('button',{name:'Excluir conta',exact:true}).click();await page.locator('#delete-account-form input').fill('errado');await page.getByRole('button',{name:'Excluir conta definitivamente'}).click();await expect(page.locator('#delete-account-form .error')).toContainText('exatamente');
 await page.locator('#delete-account-form input').fill('ExcluirTeste');await page.getByRole('button',{name:'Excluir conta definitivamente'}).click();await expect(page.locator('#dialog')).not.toBeVisible();await expect(row).toHaveCount(0);await page.reload();await expect(row).toHaveCount(0);
 await expect(page.locator('.admin-users .crew').filter({has:page.getByText('Davi303',{exact:true})}).getByRole('button')).toHaveCount(0);
 await page.locator('.admin-users .crew').filter({has:page.getByText('Marcos',{exact:true})}).getByRole('button',{name:'Excluir conta',exact:true}).click();await page.locator('#delete-account-form input').fill('Marcos');await page.getByRole('button',{name:'Excluir conta definitivamente'}).click();await expect(page.locator('#delete-account-form .error')).toContainText('mesa ativa');
});

test('foto: resposta perdida preserva rascunho, repetição é idempotente e outro acesso sincroniza',async({page,context})=>{
 await connect(page,fixture,'member');await page.goto('/#mesa');
 const observer=await context.newPage();await connect(observer,fixture);await observer.goto('/#mesa');
 await page.getByRole('button',{name:'Abrir minha conta'}).click();await page.getByRole('button',{name:'🎭 Meu Personagem'}).click();
 await page.locator('[name=outfit][value=pirata]').check();let lose=true;
 await page.route('**/functions/v1/poker-profile',async route=>{
  const body=route.request().postDataJSON();
  if(body.action==='save'&&lose){lose=false;await page.request.fetch(base+'/functions/v1/poker-profile',{method:'POST',headers:route.request().headers(),data:body});await route.abort();}else await route.fallback();
 });
 await page.getByRole('button',{name:'Salvar meu personagem',exact:true}).click();await expect(page.locator('.character-save-status')).toContainText('Não foi confirmado');await expect(page.locator('#dialog')).toBeVisible();
 await page.getByRole('button',{name:'Salvar meu personagem',exact:true}).click();await expect(page.locator('#dialog')).not.toBeVisible();
 await expect(observer.locator('[data-id="'+fixture.member+'"] .character').first()).toHaveAttribute('data-outfit','pirata',{timeout:15000});
 const saved=await(await page.request.post(base+'/functions/v1/poker-profile',{headers:{Authorization:'Bearer test-'+fixture.member},data:{action:'read',playerId:fixture.member}})).json();expect(saved.player.characterRevision).toBe(1);
 await observer.close();
});

test('exclusão incompleta continua disponível após Auth e recarga',async({page,request})=>{
 await connect(page,fixture);await page.goto('/#tchetche');await request.post('/fixture/fail-finish');
 await page.locator('.crew').filter({has:page.getByText('ExcluirTeste',{exact:true})}).getByRole('button',{name:'Excluir conta',exact:true}).click();
 await page.locator('#delete-account-form input').fill('ExcluirTeste');await page.getByRole('button',{name:'Excluir conta definitivamente'}).click();await expect(page.locator('#delete-account-form .error')).toBeVisible();
 await page.reload();const pending=page.locator('.crew').filter({has:page.getByRole('button',{name:'Concluir exclusão'})});await expect(pending).toHaveCount(1);
 const confirmation=await pending.locator('.info b').innerText();await pending.getByRole('button',{name:'Concluir exclusão'}).click();await page.locator('#delete-account-form input').fill(confirmation);await page.getByRole('button',{name:'Excluir conta definitivamente'}).click();await expect(page.locator('#dialog')).not.toBeVisible();await expect(pending).toHaveCount(0);
});

test('editor móvel: PNG/WebP, conteúdo inválido, tamanho, dimensões e enquadramento por toque',async({page})=>{
 await page.setViewportSize({width:390,height:844});await connect(page,fixture,'member');
 await page.getByRole('button',{name:'Abrir minha conta'}).click();await page.getByRole('button',{name:'🎭 Meu Personagem'}).click();
 const upload=page.locator('#character-photo');
 await upload.setInputFiles({name:'arquivo.jpg',mimeType:'image/jpeg',buffer:Buffer.from('<svg/>')});await expect(page.locator('#character-form .error')).toContainText('Conteúdo inválido');
 await upload.setInputFiles({name:'grande.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(5*1024*1024+1)});await expect(page.locator('#character-form .error')).toContainText('5 MB');
 const image=async(type,width=400,height=300)=>Buffer.from(await page.evaluate(({type,width,height})=>{const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.fillStyle='#a855f7';ctx.fillRect(0,0,width,height);return c.toDataURL(type).split(',')[1];},{type,width,height}),'base64');
 await upload.setInputFiles({name:'comprida.png',mimeType:'image/png',buffer:await image('image/png',8193,1)});await expect(page.locator('#character-form .error')).toContainText('8192');
 for(const type of ['image/png','image/webp']){await upload.setInputFiles({name:'foto.'+type.split('/')[1],mimeType:type,buffer:await image(type)});await expect(page.locator('.character-save-status')).toContainText('Foto preparada');}
 await page.locator('[name=zoom]').fill('2');
 const canvas=page.locator('.crop-stage');await canvas.scrollIntoViewIfNeeded();const rect=await canvas.boundingBox();
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+90,y:rect.y+90,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rect.x+120,y:rect.y+110,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
 expect(Number(await page.locator('[name=x]').inputValue())).toBeLessThan(.5);
 expect(await page.locator('#dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.screenshot({path:'test-results/personagem-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Salvar meu personagem',exact:true}).click();await expect(page.locator('#dialog')).not.toBeVisible();
});
