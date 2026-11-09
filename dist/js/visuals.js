import {validSessions,results,statistics,summary,within,localDate,money,HANDS} from './domain.js';

const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors=['#fbbf24','#06b6d4','#818cf8','#d1829b','#a855f7','#c58f60','#66c4bc','#c4c86b','#d17365'];
const color=i=>colors[i]??'hsl('+Math.round((i*137.5)%360)+' 72% 68%)';
const byDate=(a,b)=>a.startedAt.localeCompare(b.startedAt)||a.id.localeCompare(b.id);
const chartSessions=(state,{type,from='',to=''})=>{
 const history=validSessions(state).sort(byDate);
 const sessions=history.filter(s=>within(s,from,to));
 if(type==='net')sessions.push(...state.sessions.filter(s=>s.status==='active'&&!s.deletedAt&&within(s,from,to)));
 return {history,sessions:sessions.sort(byDate)};
};

export function chartPlayersFor(state,options){
 const {sessions}=chartSessions(state,options);
 const participants=new Set(sessions.flatMap(s=>s.participants.map(p=>p.playerId)));
 const nameKey=name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
 const groups=new Map();
 for(const p of state.players){
  const key=nameKey(p.name);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(p.id);
 }
 for(const ids of groups.values())ids.sort();
 return state.players.flatMap(p=>{
  if(!participants.has(p.id))return [];
  const ids=groups.get(nameKey(p.name));
  return [{id:p.id,name:ids.length>1?p.name+' · perfil '+(ids.indexOf(p.id)+1):p.name}];
 });
}

const recorded=value=>({value,status:'recorded'});
const absent=()=>({value:null,status:'absent'});
const pending=()=>({value:null,status:'pending'});

export function chartData(state,options){
 const {type,from='',players=null}=options;
 const {history,sessions}=chartSessions(state,options);
 const eligible=chartPlayersFor(state,options);
 const ps=eligible.map((p,i)=>({...p,color:color(i)})).filter(p=>players===null||players.includes(p.id));
 const currency=!['rebuys','participation','hands'].includes(type);
 const dates=new Map(sessions.map(s=>[s.id,localDate(s.startedAt)]));
 const bySession=new Map(sessions.map(s=>[s.id,new Map(results(s).map(r=>[r.playerId,r]))]));
 let labels=[],series=[];
 if(['cumulative','net','rebuys'].includes(type)){
  labels=sessions.map(s=>s.name+' · '+dates.get(s.id)+(s.status==='active'?' · Em andamento':''));
  const opening=new Map();
  if(type==='cumulative'&&from)for(const s of history){
   if(localDate(s.startedAt)>=from)break;
   for(const r of results(s))opening.set(r.playerId,(opening.get(r.playerId)??0)+r.net);
  }
  series=ps.map(p=>{
   let accumulated=opening.get(p.id);
   const cells=sessions.map(s=>{
    const r=bySession.get(s.id).get(p.id);
    if(!r)return type==='cumulative'&&accumulated!==undefined?{value:accumulated,status:'carried'}:absent();
    if(type==='rebuys')return recorded(r.rebuys);
    if(r.net===null)return pending();
    if(s.status==='active')return {value:r.net,status:'provisional'};
    if(type==='net')return recorded(r.net);
    accumulated=(accumulated??0)+r.net;
    return recorded(accumulated);
   });
   return {...p,cells};
  });
 }else if(type==='comparison'){
  labels=ps.map(p=>p.name);
  const stats=new Map(statistics(state,sessions).map(p=>[p.id,p.net]));
  if(ps.length)series=[{name:'Resultado líquido no período',color:color(0),cells:ps.map(p=>recorded(stats.get(p.id)))}];
 }else if(type==='monthly'||type==='participation'){
  labels=[...new Set(sessions.map(s=>dates.get(s.id).slice(0,7)))];
  series=ps.map(p=>({...p,cells:labels.map(month=>{
   const played=sessions.filter(s=>dates.get(s.id).startsWith(month)&&bySession.get(s.id).has(p.id));
   if(!played.length)return absent();
   return recorded(type==='participation'?played.length:played.reduce((total,s)=>total+bySession.get(s.id).get(p.id).net,0));
  })}));
 }else{
  labels=HANDS;
  series=ps.map(p=>({...p,cells:HANDS.map(hand=>recorded(sessions.reduce((n,s)=>n+s.rounds.filter(r=>!r.deleted&&r.hand===hand&&r.winners.includes(p.id)).length,0)))}));
 }
 return {labels,series,currency,sessions:sessions.length};
}

const cellText=(cell,currency)=>{
 if(cell.status==='absent')return 'Não participou';
 if(cell.status==='pending')return 'Resultado ainda não informado';
 const value=currency?money(cell.value):String(cell.value);
 if(cell.status==='carried')return value+' · saldo anterior, não participou';
 if(cell.status==='provisional')return value+' · provisório, fora do ranking';
 return value;
};
const plottable=cell=>cell.status==='recorded'||cell.status==='carried';
const chartHelp={
 cumulative:'O saldo anterior ao início do filtro é preservado. Pontos vazados mostram saldo carregado de outra partida, sem participação na noite.',
 net:'Partidas em andamento aparecem na tabela. Valores provisórios e apurações pendentes ficam fora dos pontos e dos rankings.',
 hands:'Somente rodadas registradas em partidas conferidas. Uma rodada dividida pode contar para mais de um jogador.'
};

export function renderChart(target,dataTarget,state,options,onPoint){
 const data=chartData(state,options),{labels,series,currency}=data;
 if(!data.sessions||!labels.length||!series.length){
  target.innerHTML='<div class="empty"><span class="symbol" aria-hidden="true">↗</span><h3>Ainda não há dados neste recorte</h3><p>Confira o período e a seleção de jogadores.</p></div>';
  dataTarget.innerHTML='';return;
 }
 const values=series.flatMap(s=>s.cells.filter(plottable).map(c=>c.value));
 const labelPoint=(si,i)=>series[si].name+' · '+labels[i]+': '+cellText(series[si].cells[i],currency);
 const help=chartHelp[options.type]??'Somente partidas finalizadas e conferidas dentro do período selecionado.';
 const legend='<div class="chart-legend" aria-label="Legenda">'+series.map(s=>'<span><i aria-hidden="true" style="background:'+s.color+'"></i>'+esc(s.name)+'</span>').join('')+'</div>';
 if(values.length){
  const min=Math.min(0,...values),max=Math.max(1,...values),w=850,h=340,left=75,top=25,right=25,bottom=55;
  const x=i=>left+(labels.length===1?(w-left-right)/2:i*(w-left-right)/(labels.length-1)),y=v=>top+(max-v)/(max-min)*(h-top-bottom);
  let svg='<svg viewBox="0 0 '+w+' '+h+'" role="group" aria-label="Gráfico dos registros filtrados" aria-describedby="chart-help">';
  for(let i=0;i<=4;i++){
   const value=min+(max-min)*i/4,yy=y(value);
   svg+='<line class="grid" x1="'+left+'" x2="'+(w-right)+'" y1="'+yy+'" y2="'+yy+'"/><text text-anchor="end" x="'+(left-10)+'" y="'+(yy+4)+'">'+esc(currency?money(Math.round(value)):Math.round(value))+'</text>';
  }
  labels.forEach((label,i)=>{
   if(i%Math.max(1,Math.ceil(labels.length/7))===0)svg+='<text x="'+x(i)+'" y="'+(h-20)+'" text-anchor="middle">'+esc(label.length>15?label.slice(0,13)+'…':label)+'</text>';
  });
  series.forEach((s,si)=>{
   const pts=s.cells.map((cell,i)=>plottable(cell)?[x(i),y(cell.value)]:null);
   const segments=[];let segment=[];
   for(const point of [...pts,null]){
    if(point)segment.push(point);
    else if(segment.length){segments.push(segment);segment=[];}
   }
   for(const points of segments)svg+='<polyline fill="none" stroke="'+s.color+'" stroke-width="2.5" points="'+points.map(p=>p.join(',')).join(' ')+'"/>';
   pts.forEach((point,i)=>{
    if(!point)return;
    const carried=s.cells[i].status==='carried';
    svg+='<circle role="img" aria-label="'+esc(labelPoint(si,i))+'" tabindex="0" data-series="'+si+'" data-index="'+i+'" cx="'+point[0]+'" cy="'+point[1]+'" r="'+(carried?6:5)+'" stroke="'+(carried?s.color:'#121520')+'" stroke-width="2" fill="'+(carried?'#121520':s.color)+'"><title>'+esc(labelPoint(si,i))+'</title></circle>';
   });
  });
  target.innerHTML='<div class="chart">'+svg+'</svg></div>'+legend;
  target.querySelectorAll('circle').forEach(c=>{
   const show=()=>onPoint(labelPoint(Number(c.dataset.series),Number(c.dataset.index)));
   c.onclick=show;c.onfocus=show;c.onmouseenter=show;
  });
 }else target.innerHTML='<p class="help">Nenhum resultado conferido para desenhar neste recorte. Veja as apurações na tabela.</p>'+legend;
 const rowName=options.type==='comparison'?'Jogador':'Registro';
 const table='<div class="table-wrap" role="region" tabindex="0" aria-label="Tabela de valores do gráfico"><table><thead><tr><th scope="col">'+rowName+'</th>'+series.map(s=>'<th scope="col">'+esc(s.name)+'</th>').join('')+'</tr></thead><tbody>'+labels.map((label,i)=>'<tr><th scope="row">'+esc(label)+'</th>'+series.map(s=>'<td>'+esc(cellText(s.cells[i],currency))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 dataTarget.innerHTML='<p class="help" id="chart-help">'+help+'</p><details '+(values.length?'':'open')+'><summary>Consultar valores em tabela</summary>'+table+'</details>';
}

export async function exportRetro(state,sessions,{format='vertical',money:showMoney=true,photos=false,period='Toda a história',selected=[0,1,2,3]}={}){const c=document.createElement('canvas');c.width=1080;c.height=format==='square'?1080:1350;const ctx=c.getContext('2d'),sum=summary(state,sessions),h=c.height;const bg=ctx.createLinearGradient(0,0,1080,h);bg.addColorStop(0,'#1e1b4b');bg.addColorStop(.5,'#121520');bg.addColorStop(1,'#0a0b10');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,h);ctx.strokeStyle='#6366f1';ctx.lineWidth=2;ctx.strokeRect(28,28,1024,h-56);ctx.strokeStyle='#6366f133';ctx.strokeRect(40,40,1000,h-80);ctx.fillStyle='#fbbf24';ctx.textAlign='center';ctx.font='75px Georgia';ctx.fillText('♣',540,130);ctx.font='45px Georgia';ctx.fillText('A POKERZADA LENDÁRIA',540,200);ctx.fillStyle='#f8fafc';ctx.font='26px sans-serif';ctx.fillText('RETROSPECTIVA DA TROPA',540,251);ctx.fillStyle='#94a3b8';ctx.font='22px sans-serif';ctx.fillText(period,540,292);ctx.fillStyle='#cbd5e1';ctx.font='22px sans-serif';ctx.fillText(sum.games+' noites  ·  '+sum.people+' pessoas  ·  '+sum.rounds+' rodadas',540,345);
 const names=ps=>ps.length?ps.map(p=>p.name).join(' & '):'Sem registro',items=[['REI DA MESA DO PERÍODO',names(sum.kings),showMoney&&sum.kings.length?money(sum.kings[0].net)+' de saldo líquido acumulado':'Maior lucro positivo do período',sum.kings],['PRESENÇA LENDÁRIA',names(sum.presence),sum.presence.length?sum.presence[0].games+' participações':'Nenhuma participação',sum.presence],['MELHOR RESULTADO DA NOITE',names(sum.bestNight),showMoney&&sum.bestNight.length?money(sum.bestNight[0].best)+' em uma noite':'Maior saldo líquido em uma partida',sum.bestNight],['A MÃO DO PERÍODO',sum.commonHands.map(c=>c.hand).join(' & ')||'Não registrada','Somente rodadas documentadas',[]],['MAIOR PREJUÍZO',names(sum.losses),showMoney&&sum.losses.length?money(sum.losses[0].net)+' acumulados':'Menor resultado líquido do período',sum.losses],['MAIS RE-BUYS',names(sum.rebuyLeaders),sum.rebuyLeaders.length?sum.rebuyLeaders[0].rebuys+' registros':'Sem registros',sum.rebuyLeaders]].filter((_,i)=>selected.includes(i));
 const cellH=format==='square'?270:330;for(let i=0;i<items.length;i++){const [label,name,note,ps]=items[i],x=75+(i%2)*475,y=395+Math.floor(i/2)*cellH;ctx.fillStyle='#ffffff05';ctx.fillRect(x,y,455,cellH-22);ctx.strokeStyle='#fbbf2444';ctx.strokeRect(x,y,455,cellH-22);ctx.textAlign='center';ctx.fillStyle='#fbbf24';ctx.font='17px sans-serif';ctx.fillText(label,x+227,y+39);let nameY=y+88;if(photos&&ps[0]?.avatar){try{const img=await loadImage(ps[0].avatar);ctx.save();ctx.beginPath();ctx.arc(x+227,y+90,32,0,2*Math.PI);ctx.clip();ctx.drawImage(img,x+195,y+58,64,64);ctx.restore();nameY=y+155;}catch{}}ctx.fillStyle='#f8fafc';ctx.font='30px Georgia';wrap(ctx,name,x+227,nameY,400,35,2);ctx.fillStyle='#94a3b8';ctx.font='16px sans-serif';wrap(ctx,note,x+227,y+cellH-55,410,23,2);}
 ctx.fillStyle='#94a3b8';ctx.font='19px sans-serif';ctx.textAlign='center';ctx.fillText('O jogo é presencial. A resenha é eterna.',540,h-83);ctx.font='14px sans-serif';ctx.fillText('Resultados de sessões finalizadas e conferidas',540,h-55);return c.toDataURL('image/png');}
function wrap(ctx,text,x,y,width,line,max){const words=text.split(' ');let row='',rows=[];for(const word of words){if(ctx.measureText(row+' '+word).width>width&&row){rows.push(row);row=word;}else row+=(row?' ':'')+word;}rows.push(row);rows.slice(0,max).forEach((r,i)=>ctx.fillText(i===max-1&&rows.length>max?r+'…':r,x,y+i*line));}
const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});


