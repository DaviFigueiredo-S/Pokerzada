// Ciclo de vida explícito evita processos órfãos na finalização do Playwright no Windows.
import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['tests/browser-server.mjs'],{stdio:'inherit',windowsHide:true});
try{
 let ready=false;
 for(let attempt=0;attempt<100;attempt++){
  if(server.exitCode!==null)throw Error('O servidor de testes encerrou antes de iniciar.');
  try{const r=await fetch('http://127.0.0.1:4174/fixture/info');if(r.ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 if(!ready)throw Error('Servidor de testes indisponível.');
 const cli=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2)],{stdio:'inherit',windowsHide:true});
 process.exitCode=await new Promise((resolve,reject)=>{cli.once('error',reject);cli.once('exit',code=>resolve(code??1));});
}finally{server.kill();}
