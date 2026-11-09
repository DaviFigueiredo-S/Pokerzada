import {test,expect} from '@playwright/test';

const base='http://127.0.0.1:4174',project='https://fixture.supabase.co';
const sizes=[[1440,900],[390,844],[320,568]];
const controls=page=>page.locator('#dialog');
const openPage=(page,name)=>page.goto('/#'+name);
async function fixture(request){return (await request.post('/fixture/reset')).json();}
function fixtureApi(request,who){
 async function rpc(name,data={}){
  const r=await request.post('/rest/v1/rpc/'+name,{headers:{authorization:'Bearer test-'+who},data});
  expect(r.ok(),await r.text()).toBeTruthy();
  return r.json();
 }
 const snapshot=()=>rpc('poker_snapshot');
 const session=async id=>(await snapshot()).sessions.find(s=>s.id===id);
 async function command(type,payload,sessionId){
  const s=sessionId&&await session(sessionId);
  return rpc('poker_command',{command:{id:crypto.randomUUID(),type,payload,...(s?{sessionId,expectedRevision:s.revision}:{})}});
 }
 return {rpc,snapshot,session,command};
}

async function isolatedPage(page,who,onCommand=()=>null){
 await page.routeWebSocket('**/*',socket=>socket.close());
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin===base)return route.continue();
  if(url.origin!==project)return route.abort();
  const command=url.pathname.endsWith('/poker_command')?req.postDataJSON()?.command:null;
  const outcome=command&&onCommand(command);
  if(outcome==='offline')return route.abort();
  const response=await page.request.fetch(base+url.pathname+url.search,{method:req.method(),headers:req.headers(),data:req.postData()||undefined});
  return outcome==='lost'?route.abort():route.fulfill({response});
 });
 if(who)await page.addInitScript(({id,project})=>{
  localStorage.setItem('pokerzada-cloud-v1',JSON.stringify({supabaseUrl:project,publishableKey:'local-fixture-public'}));
  sessionStorage.setItem('pokerzada-auth-v1',JSON.stringify({project,session:{access_token:'test-'+id,refresh_token:'test-'+id,user:{id}}}));
 },{id:who,project});
 await page.goto('/');
 await expect(page.locator(who?'.shell':'.welcome')).toBeVisible();
}

async function documentFits(page){
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}
async function onScreen(locator){
 await expect.poll(()=>locator.evaluate(el=>{
  const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;
 })).toBe(true);
}

async function seedHistory(api,f){
 const ids=f.ids.slice(2,8);
 for(const [i,name] of ['Pessoa de teste A','Pessoa de teste B','ApelidoMuitoCompridoSemEspaçosDePropósito','Outra pessoa com nome muito comprido','Pessoa de teste E','Pessoa de teste F'].entries())
  await api.command('player',{id:ids[i],name,active:true});
 const {chips}=(await api.snapshot()).settings;
 async function create(n,people,amounts){
  const id=crypto.randomUUID();
  await api.command('create',{id,name:'Noite fictícia '+n,ancient:'Organizador fictício',startedAt:'2026-11-0'+(n+1)+'T21:00:00Z',mode:'full',variant:'texas',buyin:500,rebuy:500,chips,players:people});
  if(!amounts)return id;
  for(const [i,playerId] of people.entries())await api.command('final',{playerId,amount:amounts[i],expectedCountRevision:0},id);
  for(let i=0;i<12;i++)await api.command('round',{id:crypto.randomUUID(),winners:i===9?people.slice(0,2):people.slice(0,1),hand:'Trinca',cards:i===9?[{owner:'board',rank:'A',suit:'♠'}]:[]},id);
  await api.command('finalize',{},id);
  return id;
 }
 return {first:await create(1,ids.slice(0,5),[750,500,500,0,750]),second:await create(2,[ids[0],ids[1],ids[2],ids[3],ids[5]],[1000,500,500,0,500]),active:await create(3,[ids[0],ids[5]]),ids};
}

test('entrada pública: foco, contraste, adaptação e configuração separada',async({page})=>{
 await isolatedPage(page);
 await page.keyboard.press('Tab');
 await expect(page.getByRole('link',{name:'Pular para o conteúdo'})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page.locator('#main')).toBeFocused();
 const login=page.getByRole('button',{name:/Entrar no clube/});
 await login.focus();await page.keyboard.press('Enter');
 const dialog=controls(page),title=dialog.locator('h2');
 await expect(title).toBeFocused();
 await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Fechar'})).toBeFocused();
 await page.keyboard.press('Tab');await expect(dialog.getByLabel('Nome de usuário')).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Fechar'})).toBeFocused();
 const username=dialog.getByLabel('Nome de usuário'),password=dialog.getByLabel('Senha',{exact:true});
 const submit=dialog.getByRole('button',{name:'Entrar e sincronizar'});
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});await documentFits(page);await onScreen(submit);
  if(width<500){
   expect((await username.boundingBox()).y).toBeLessThan((await password.boundingBox()).y);
   expect(await username.evaluate(el=>getComputedStyle(el).fontSize)).toBe('16px');
  }
 }
 const ratios=()=>dialog.evaluate(d=>{
  const field=d.querySelector('input'),btn=d.querySelector('button[type=submit]');
  const triplet=rgb=>[...rgb.matchAll(/[\d.]+/g)].slice(0,3).map(a=>Number(a[0]));
  const luminance=rgb=>rgb.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  const style=getComputedStyle(field),button=getComputedStyle(btn);
  const [a,b]=[...button.backgroundImage.matchAll(/rgb\([^)]+\)/g)].map(m=>triplet(m[0]));
  const buttonRatios=Array.from({length:21},(_,i)=>ratio(a.map((n,j)=>n+(b[j]-n)*i/20),triplet(button.color)));
  return {button:Math.min(...buttonRatios),outer:ratio(triplet(style.borderColor),triplet(getComputedStyle(d).backgroundColor)),inner:ratio(triplet(style.borderColor),triplet(style.backgroundColor))};
 });
 async function expectContrast(){const r=await ratios();expect(r.button).toBeGreaterThanOrEqual(4.5);expect(r.outer).toBeGreaterThanOrEqual(3);expect(r.inner).toBeGreaterThanOrEqual(3);}
 await expectContrast();
 await username.focus();await expectContrast();
 await submit.hover();await expectContrast();
 await username.fill('inválido!');
 await submit.click();await expect(username).toBeFocused();
 await expect.poll(()=>username.evaluate(el=>el.matches(':user-invalid'))).toBe(true);
 await expectContrast();
 await dialog.getByText('Esqueci a senha',{exact:true}).click();
 await expect(dialog.getByText(/não compartilhe sua senha/)).toBeVisible();
 await dialog.getByRole('button',{name:'Configuração avançada da conexão'}).click();
 await expect(title).toHaveText('Configuração avançada da conexão');
 await expect(title).toBeFocused();
 await expect(dialog.getByLabel('Chave publicável')).toBeVisible();
 await dialog.getByRole('button',{name:'Voltar ao login'}).click();
 await dialog.getByRole('button',{name:'Criar minha conta'}).click();
 await expect(title).toBeFocused();
 await expect(dialog.getByLabel('Senha',{exact:true})).toHaveAccessibleDescription(/8 a 128/);
 await page.keyboard.press('Escape');await expect(login).toBeFocused();
 const direct=page.locator('#main').getByRole('button',{name:'Criar minha conta'});
 await direct.click();await expect(title).toBeFocused();
 await dialog.getByRole('button',{name:'Fechar'}).click();await expect(direct).toBeFocused();
});

test('placar e Hall cabem nas três telas; rodada volta ao mesmo relatório',async({page,request},info)=>{
 const f=await fixture(request),api=fixtureApi(request,f.owner),seed=await seedHistory(api,f);
 await isolatedPage(page,f.owner);
 await openPage(page,'placar');await page.locator('#session-select').selectOption(seed.second);
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});await documentFits(page);
  if(width===1440){await expect(page.locator('main .result-table')).toBeVisible();await expect(page.locator('main .result-cards')).toBeHidden();}
  else {
   await expect(page.locator('main .result-table')).toBeHidden();
   const card=page.locator('.result-card').filter({hasText:'Outra pessoa com nome muito comprido'});
   await expect(card).toContainText('Saldo líquido');await expect(card).toContainText('Recebido');await expect(card).toContainText(/R\$\s*0,00/);
   await card.getByText('Ver investimento').click();await expect(card.getByText('Total investido')).toBeVisible();
   await card.getByText('Ver investimento').click();
  }
  await expect(page.locator('.score-panel .validation')).toContainText('Mesa fechada');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:info.outputPath('placar-'+width+'.png'),fullPage:true});
 }
 const report=page.getByRole('button',{name:'Relatório completo'});await report.click();
 const round=controls(page).getByRole('button',{name:'Ver rodada 10',exact:true});
 for(const closeBy of ['escape','button']){
  await round.scrollIntoViewIfNeeded();
  const before=await controls(page).evaluate(d=>({top:d.scrollTop,left:d.querySelector('[aria-label="Rodadas registradas"]').scrollLeft}));
  await round.click();
  await expect(controls(page).getByText('Empate · pote dividido')).toBeVisible();
  await expect(controls(page).getByText('Trinca')).toBeVisible();
  await expect(controls(page).getByText('A de espadas',{exact:true})).toHaveCount(1);
  await expect(controls(page).locator('fieldset')).toHaveCount(0);
  if(closeBy==='escape')await page.keyboard.press('Escape');else await controls(page).getByRole('button',{name:'Fechar'}).click();
  await expect(round).toBeFocused();
  expect(await controls(page).evaluate(d=>({top:d.scrollTop,left:d.querySelector('[aria-label="Rodadas registradas"]').scrollLeft}))).toEqual(before);
 }
 await page.keyboard.press('Escape');await expect(report).toBeFocused();
 await openPage(page,'hall');
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});
  for(const key of ['finance','rebuys','participation','rounds']){
   await page.locator('[data-action=hallTab][data-id='+key+']').click();
   await documentFits(page);
   await expect(page.locator('.achievement-grid')).toContainText('ApelidoMuitoCompridoSemEspaçosDePropósito');
   expect(await page.locator('.achievement-grid').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  }
 }
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:info.outputPath('hall-320.png'),fullPage:true});
});

test('Estatísticas, navegação e Retrospectiva usam os mesmos critérios na tela',async({page,request})=>{
 const f=await fixture(request),api=fixtureApi(request,f.owner),seed=await seedHistory(api,f);
 await isolatedPage(page,f.owner);await openPage(page,'stats');
 await expect(page.locator('.sidebar [href="#legado"]')).toHaveAttribute('aria-current','location');
 const chart=page.locator('#chart-type'),series=page.locator('.chart-legend span');
 const showTable=async()=>{const details=page.locator('#chart-data details');if(!await details.evaluate(d=>d.open))await details.locator('summary').click();};
 await expect(series).toHaveCount(6);
 await showTable();
 await expect(page.locator('#chart-data tbody')).toContainText('saldo anterior, não participou');
 await expect(page.locator('#chart-data tbody')).toContainText('Não participou');
 await expect(page.locator('#chart circle[aria-label*="saldo anterior"]').first()).toHaveCount(1);
 for(const type of ['net','comparison','monthly','rebuys','participation','hands']){
  await chart.selectOption(type);await showTable();
  expect(await page.locator('#chart-data tbody tr').count()).toBeGreaterThan(0);
  const shown=await series.allTextContents(),headers=(await page.locator('#chart-data thead th').allTextContents()).slice(1);
  expect(shown).toEqual(headers);
 }
 await chart.selectOption('net');await showTable();
 await expect(page.locator('#chart-data tbody')).toContainText('Resultado ainda não informado');
 expect(await page.locator('#chart circle[aria-label*="ainda não informado"]').count()).toBe(0);
 await page.locator('#chart-from').fill('2026-11-04');await expect(series).toHaveCount(2);
 await expect(page.locator('#chart-data tbody')).toContainText('Resultado ainda não informado');
 await openPage(page,'inicio');await expect(page.getByRole('link',{name:'Ver Hall da Fama'})).toBeVisible();
 await expect(page.locator('.home-hero [data-action=open]')).toBeVisible();
 await openPage(page,'retro');await expect(page.getByRole('heading',{name:'Melhor resultado da noite'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Rei da Mesa do período'})).toBeVisible();
 await page.getByRole('button',{name:'Criar cartão para compartilhar'}).click();
 await expect(controls(page).getByLabel('Melhor resultado da noite')).toBeChecked();
 await page.getByRole('button',{name:'Gerar prévia'}).click();
 await expect(controls(page).locator('img')).toBeVisible();
 const downloaded=page.waitForEvent('download');
 await controls(page).getByRole('link',{name:'Baixar PNG'}).click();
 const image=await downloaded;
 expect(image.suggestedFilename()).toBe('retrospectiva-pokerzada.png');
 expect(await image.failure()).toBeNull();
});

for(const mode of ['quick','full']){
 test((mode==='quick'?'Express':'Lendária')+': da abertura à correção, com reenvio e conferência',async({page,request},info)=>{
  const f=await fixture(request),api=fixtureApi(request,f.owner),rebuyRequests=[];
  await page.setViewportSize({width:320,height:568});
  await isolatedPage(page,f.owner,c=>{
   if(c.type!=='rebuy')return null;
   rebuyRequests.push(c);
   return rebuyRequests.length===1?(mode==='quick'?'lost':'offline'):null;
  });
  const open=page.locator('.home-hero [data-action=new]');
  await open.click();
  const form=page.locator('#new-form'),button=form.getByRole('button',{name:'Abrir a mesa'});
  const extras=form.locator('.new-extras > summary'),modeSelect=form.locator('[name=mode]');
  const variant=form.locator('[name=variant]');
  const chosen=form.locator('[name=players][value="'+f.owner+'"]');
  await expect(variant).toBeHidden();
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});await documentFits(page);await onScreen(button);
  }
  await form.locator('[name=ancient]').fill('Organizador fictício');
  await form.locator('[name=buyin]').fill('5,00');
  await form.locator('[name=rebuy]').fill('5,00');
  await chosen.check();
  await extras.click();
  await modeSelect.selectOption('full');await expect(variant).toBeVisible();
  await variant.selectOption('omaha');
  await modeSelect.selectOption('quick');await expect(variant).toBeHidden();
  await modeSelect.selectOption('full');await expect(variant).toHaveValue('omaha');
  await modeSelect.selectOption(mode);
  await expect(chosen).toBeChecked();
  await expect(form.locator('[name=ancient]')).toHaveValue('Organizador fictício');
  await expect(form.locator('[name=buyin]')).toHaveValue('5,00');
  await form.locator('[name=name]').fill('Noite de ensaio '+mode);
  await extras.click();
  await button.click();await expect(form.locator('.error')).toContainText('pelo menos dois jogadores');
  await form.locator('[name=players][value="'+f.member+'"]').check();
  await form.locator('[name=buyin]').fill('5,001');
  await button.click();await expect(form.locator('.error')).toContainText('Entrada inicial');
  await form.locator('[name=buyin]').fill('5,00');
  await page.setViewportSize({width:320,height:330});
  await onScreen(button);
  await page.setViewportSize({width:320,height:568});
  await form.locator('.new-body').evaluate(el=>{el.scrollTop=0;});
  if(mode==='quick'){
   await form.locator('.error').evaluate(el=>el.textContent='');
   await page.screenshot({path:info.outputPath('express-320.png')});
  }
  await button.click();
  await expect(page).toHaveURL(/#mesa$/);
  await expect(page.getByRole('heading',{name:'Noite de ensaio '+mode})).toBeVisible();
  const sid=await page.locator('#session-select').inputValue();
  expect((await api.session(sid)).mode).toBe(mode);

  await page.locator('.arena [data-id="'+f.owner+'"]').click();
  await page.locator('#rebuy-form button.primary').click();
  await expect(page.locator('#rebuy-form .error')).toContainText('Não foi possível conectar');
  expect((await api.session(sid)).entries.filter(e=>e.kind==='rebuy')).toHaveLength(mode==='quick'?1:0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Conferir tentativa'})).toBeVisible();
  if(mode==='quick'){
   await page.reload();
   await expect(page.locator('.shell')).toBeVisible();
   await expect(page.getByRole('button',{name:'Conferir tentativa'})).toHaveCount(0);
   expect(rebuyRequests).toHaveLength(1);
  }else{
   await page.getByRole('button',{name:'Conferir tentativa'}).click();
   await controls(page).getByRole('button',{name:/Reenviar/}).click();
   await expect(page.getByRole('button',{name:'Conferir tentativa'})).toHaveCount(0);
   expect(rebuyRequests.map(c=>c.id)).toEqual([rebuyRequests[0].id,rebuyRequests[0].id]);
  }
  await api.rpc('poker_command',{command:rebuyRequests[0]});
  expect((await api.session(sid)).entries.filter(e=>e.kind==='rebuy')).toHaveLength(1);
  await page.locator('#session-select').selectOption(sid);
  if(mode==='full'){
   await page.locator('[data-action=round]').first().click();
   await page.locator('#round-form [name=winners]').first().check();
   await page.locator('#round-form [name=hand]').selectOption('Trinca');
   await page.locator('#round-form button.primary').click();
   await expect(controls(page)).toBeHidden();
   expect((await api.session(sid)).rounds).toHaveLength(1);
  }else await expect(page.locator('[data-action=round]')).toHaveCount(0);
  await page.locator('main [data-route=placar]').first().click();
  const check=page.locator('.score-panel .validation'),finish=page.locator('[data-action=finish]');
  await expect(check).toContainText('2 apurações pendentes');await expect(finish).toBeDisabled();
  await documentFits(page);
  async function final(id,value,expected){
   await page.locator('#final-'+id).fill(value);
   const row=page.locator('.closing-row').filter({has:page.locator('#final-'+id)});
   await row.locator('[data-action=saveFinal]').click();
   await expect(row.locator('.net')).toContainText(expected);
  }
  await final(f.owner,'14,00',/R\$\s*4,00/);
  await final(f.member,'0,00',/R\$\s*5,00/);
  await expect(check).toContainText(/Faltam distribuir R\$\s*1,00/);await expect(finish).toBeDisabled();
  await page.getByRole('button',{name:'Ajuste de caixa'}).click();
  await controls(page).locator('[name=amount]').fill('1,00');
  await controls(page).locator('[name=reason]').fill('Ajuste fictício conferido');
  await controls(page).locator('button[type=submit]').click();
  await expect(check).toContainText('Valores conferidos');
  await expect(check).toContainText(/ajustes de caixa R\$\s*1,00/);
  await expect(finish).toBeEnabled();
  async function closeGame(){
   await finish.click();await controls(page).getByRole('button',{name:'Confirmar',exact:true}).click();
   await expect(check).toContainText('Mesa fechada');
  }
  await closeGame();
  const original=await api.session(sid);
  expect(original.finals[f.member]).toBe(0);
  expect(original.cashAdjustments[0].amount).toBe(100);
  await page.reload();await expect(page.locator('.shell')).toBeVisible();
  await page.locator('#session-select').selectOption(sid);
  await page.getByRole('button',{name:'Abrir correção auditada'}).click();
  await controls(page).locator('textarea').fill('Correção fictícia conferida');
  await controls(page).locator('button[type=submit]').click();
  await expect(finish).toBeVisible();
  await final(f.owner,'9,00',/R\$\s*1,00/);
  await final(f.member,'5,00',/R\$\s*0,00/);
  await closeGame();
  const current=await api.session(sid);
  expect(current.closures).toHaveLength(2);
  expect(current.closures[0]).toEqual(original.closures[0]);
  expect((await api.snapshot()).audit).toContainEqual(expect.objectContaining({type:'reopen',sessionId:sid,reason:'Correção fictícia conferida'}));
  expect(current.finals[f.member]).toBe(500);
 });
}

test('leitura, organização e administração respeitam permissões e sincronizam em outra sessão',async({page,request,browser})=>{
 const f=await fixture(request),api=fixtureApi(request,f.owner),organizer=f.ids[2];
 await api.command('role',{userId:organizer,role:'organizer'});
 await isolatedPage(page,f.owner);
 await expect(page.locator('.sidebar [href="#tchetche"]')).toBeVisible();
 await openPage(page,'tchetche');
 await expect(page.locator('main').getByRole('heading',{level:1})).toBeVisible();
 const observer=await browser.newContext(),operator=await browser.newContext();
 try{
  const memberPage=await observer.newPage(),organizerPage=await operator.newPage();
  await Promise.all([isolatedPage(memberPage,f.member),isolatedPage(organizerPage,organizer)]);
  await expect(memberPage.locator('.home-hero [data-action=new]')).toHaveCount(0);
  await expect(memberPage.locator('.sidebar [href="#tchetche"]')).toHaveCount(0);
  await expect(organizerPage.locator('.home-hero [data-action=new]')).toBeVisible();
  await expect(organizerPage.locator('.sidebar [href="#tchetche"]')).toHaveCount(0);
  await openPage(memberPage,'placar');
  await expect(memberPage.locator('#final-'+f.member)).toBeEditable();
  await expect(memberPage.locator('#final-'+f.owner)).not.toBeEditable();
  await expect(memberPage.locator('[data-action=finish]')).toHaveCount(0);
  await openPage(organizerPage,'mesa');
  await organizerPage.locator('.arena [data-id="'+f.member+'"]').click();
  await organizerPage.locator('#rebuy-form button.primary').click();
  await expect(organizerPage.locator('#toast')).toContainText('Re-buy registrado');
  await expect(memberPage.locator('.score-panel .validation')).toContainText(/Investido R\$\s*55,00/,{timeout:15000});
 }finally{await Promise.all([observer.close(),operator.close()]);}
});
