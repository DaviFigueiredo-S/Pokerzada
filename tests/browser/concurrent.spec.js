import {test,expect} from '@playwright/test';

const base='http://127.0.0.1:4174';

test('dez contas entram ao mesmo tempo e carregam a mesa',async({browser,request})=>{
 test.setTimeout(120000);
 const fixture=await(await request.post('/fixture/reset')).json();
 const contexts=[];
 const errors=[];
 try{
  const users=fixture.ids.slice(0,10);
  const pages=await Promise.all(users.map(async()=>{
   const context=await browser.newContext();contexts.push(context);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://fixture.supabase.co/**',async route=>{const req=route.request(),u=new URL(req.url());const response=await page.request.fetch(base+u.pathname+u.search,{method:req.method(),headers:req.headers(),data:req.postData()||undefined});await route.fulfill({response});});
   await page.addInitScript(()=>localStorage.setItem('pokerzada-cloud-v1',JSON.stringify({supabaseUrl:'https://fixture.supabase.co',publishableKey:'local-fixture-public'})));
   await page.goto('/');await page.getByRole('button',{name:/Entrar no clube/}).click();
   return page;
  }));
  await Promise.all(pages.map(async(page,i)=>{
   await page.locator('#login-form [name=username]').fill(i===0?'Davi303':i===1?'Marcos':'Jogador'+i);
   await page.locator('#login-form [name=password]').fill('PasswordTeste123');
  }));
  await Promise.all(pages.map(page=>page.getByRole('button',{name:'Entrar e sincronizar'}).click()));
  await Promise.all(pages.map(page=>expect(page.locator('.shell')).toBeVisible({timeout:60000})));
  await Promise.all(pages.map(async page=>{await page.goto('/#mesa');await expect(page.locator('.arena .character')).toHaveCount(10);}));
  expect(errors).toEqual([]);
 }finally{await Promise.all(contexts.map(context=>context.close()));}
});
