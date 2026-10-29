// Catálogo original. Fotografias nunca são interpretadas como SVG/HTML.
export const OUTFITS = Object.freeze([
  ['executivo','O Executivo','#334155','#cbd5e1','suit'],
  ['praiano','O Praiano','#06b6d4','#fde68a','beach'],
  ['magnata','O Magnata','#312e81','#fbbf24','suit'],
  ['palhaco','O Palhaço','#a855f7','#fb7185','clown'],
  ['mafioso','O Mafioso','#27272a','#e2e8f0','suit'],
  ['cowboy','O Cowboy','#92400e','#fcd34d','western'],
  ['rei','O Rei do Poker','#7c3aed','#fbbf24','royal'],
  ['heroi','O Super-Herói','#0369a1','#f43f5e','hero'],
  ['mago','O Mago das Cartas','#4338ca','#c4b5fd','wizard'],
  ['pirata','O Pirata','#7f1d1d','#fde68a','pirate'],
  ['piloto','O Piloto','#dc2626','#f8fafc','racing'],
  ['casual','O Casual','#475569','#06b6d4','hoodie'],
  ['lorde','O Lorde','#292524','#d6d3d1','formal'],
  ['chef','O Chef','#e2e8f0','#334155','chef'],
  ['lutador','O Lutador','#d6d3d1','#171717','fighter'],
  ['coringa','O Coringa','#6d28d9','#2dd4bf','cards']
].map(([id,name,color,accent,cut])=>Object.freeze({id,name,color,accent,cut})));
export const DEFAULT_CHARACTER = Object.freeze({outfit:'casual',crop:{x:.5,y:.5,zoom:1}});
export const safePhoto = value => typeof value==='string' && value.length<=200000 && /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value);
export function character(value={}) {
  const outfit=OUTFITS.find(o=>o.id===value.outfit)?.id||'casual';
  const c=value.crop||{}, clamp=(v,a,b,d)=>typeof v==='number'&&Number.isFinite(v)?Math.max(a,Math.min(b,v)):d;
  return {outfit,crop:{x:clamp(c.x,0,1,.5),y:clamp(c.y,0,1,.5),zoom:clamp(c.zoom,1,3,1)}};
}
export function cropRect(width,height,crop={}) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw Error('Dimensões inválidas.');
  const c=character({crop}).crop,side=Math.min(width,height)/c.zoom;
  return {x:(width-side)*c.x,y:(height-side)*c.y,side};
}
function detail(o){
  const a=o.accent;
  switch(o.cut){
    case 'suit':return '<path d="M47 67L60 100 73 67 69 105H51Z" fill="#f1f5f9"/><path d="M58 75h4l3 27-5 6-5-6Z" fill="'+a+'"/><path d="M44 68l-5 15 16 20-9-32m30-3 5 15-16 20 9-32" fill="#0f172a"/>'+(o.id==='magnata'?'<path d="M39 91q21 24 42 0" fill="none" stroke="#fbbf24" stroke-width="3"/>':o.id==='mafioso'?'<path d="M35 83v33m7-39v42m36-42v42m7-36v33" stroke="#94a3b8" opacity=".3"/>':'');
    case 'beach':return '<path d="M60 72v54M47 69l13 15 13-15" fill="none" stroke="#fde68a" stroke-width="3"/><g fill="#fde68a"><path d="M39 88l4-6 4 6-4 7Zm33 17 4-6 4 6-4 7Zm-25 9 4-6 4 6-4 7Z"/></g>';
    case 'clown':return '<path d="M43 72l17 7 17-7v17l-17-7-17 7Z" fill="#fbbf24"/><circle cx="60" cy="80" r="5" fill="#fb7185"/><g fill="#67e8f9"><circle cx="60" cy="100" r="5"/><circle cx="60" cy="116" r="5"/></g>';
    case 'western':return '<path d="M45 68l-10 54h18V87l7-8 7 8v35h18L75 68" fill="#422006"/><path d="M60 81v42" stroke="#fde68a" stroke-width="2"/><path d="m77 92 2 4 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1Z" fill="#fbbf24"/>';
    case 'royal':return '<path d="M35 76l10 50h30l10-50-13-7-12 12-12-12Z" fill="#581c87" stroke="#fbbf24" stroke-width="3"/><path d="M60 83v42M46 108h28" stroke="#fbbf24" stroke-width="3"/><path d="m60 88 6 7-6 7-6-7Z" fill="#fef08a"/>';
    case 'hero':return '<path d="m60 82 16 8-4 19-12 8-12-8-4-19Z" fill="#fbbf24"/><path d="m60 87-7 13h6l-3 11 12-16h-7l4-8Z" fill="#0369a1"/>';
    case 'wizard':return '<path d="M45 71l15 49 15-49M60 120v11" fill="none" stroke="#c4b5fd" stroke-width="4"/><g fill="#fde68a"><path d="m40 93 2-5 2 5 5 2-5 2-2 5-2-5-5-2Zm37 17 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z"/></g>';
    case 'pirate':return '<path d="M48 68h24v58H48Z" fill="#f1f5f9"/><path d="M48 89h24m-24 12h24m-24 12h24" stroke="#334155" stroke-width="6"/><path d="m38 77 42 47" stroke="#422006" stroke-width="9"/><path d="M34 119h52" stroke="#fbbf24" stroke-width="6"/>';
    case 'racing':return '<path d="M60 70v58" stroke="#f8fafc" stroke-width="3"/><path d="M42 75v42M78 75v42" stroke="#111827" stroke-width="6"/><path d="M67 88h12v13H67Z" fill="#fff"/><path d="M67 88h6v6h6v7h-6v-7h-6Z" fill="#111827"/>';
    case 'hoodie':return '<path d="M45 68q15 30 30 0M47 72v23m26-23v23M46 111h28l4 14H42Z" fill="none" stroke="#94a3b8" stroke-width="3"/><path d="M55 98h10" stroke="#06b6d4" stroke-width="4"/>';
    case 'formal':return '<path d="M45 68l15 52 15-52-15 8Z" fill="#fafaf9"/><path d="m46 74 14 6 14-6v15l-14-6-14 6Z" fill="#a8a29e"/><circle cx="60" cy="102" r="2" fill="#292524"/>';
    case 'chef':return '<path d="M48 70v54M60 73v50" stroke="#94a3b8" stroke-width="2"/><g fill="#334155"><circle cx="55" cy="90" r="2"/><circle cx="70" cy="90" r="2"/><circle cx="55" cy="105" r="2"/><circle cx="70" cy="105" r="2"/></g><path d="M35 121h50" stroke="#334155" stroke-width="7"/>';
    case 'fighter':return '<path d="m43 69 26 41m8-41-26 41" stroke="#fafaf9" stroke-width="7"/><path d="M35 116h50m-27 0-7 17m12-17 8 17" stroke="#171717" stroke-width="7"/>';
    case 'cards':return '<path d="M60 72v56h25l-5-52Z" fill="#0f766e"/><g fill="#fef08a"><path d="m47 89 7 10-7 10-7-10Zm26 21 6 8-6 8-6-8Z"/></g><path d="M44 70l16 12 16-12" fill="none" stroke="#f8fafc" stroke-width="4"/>';
  }
  return '';
}
export function outfitSvg(id){
  const o=OUTFITS.find(x=>x.id===id)||OUTFITS[11];
  const cape=['hero','royal','wizard'].includes(o.cut)?'<path d="M39 70 20 143q40 11 80 0L81 70Z" fill="'+(o.cut==='hero'?'#881337':'#312e81')+'"/>':'';
  const hat=o.id==='rei'?'<path d="m42 27-4-16 14 7 8-13 8 13 14-7-4 16Z" fill="#fbbf24" stroke="#92400e" stroke-width="2"/>':o.id==='lorde'?'<path d="M39 24h42M46 23V5h28v18" fill="#292524" stroke="#d6d3d1" stroke-width="4"/>':o.id==='cowboy'?'<path d="M32 26q28 9 56 0M44 25l3-15 13 4 13-4 3 15" fill="#92400e" stroke="#fcd34d" stroke-width="3"/>':o.id==='chef'?'<path d="M44 26V17C25 0 48-7 53 6 66-9 76 1 72 8 94 4 89 24 76 19v7Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>':o.id==='mago'?'<path d="M34 26 61 1 81 26Z" fill="#4338ca" stroke="#c4b5fd" stroke-width="2"/>':'';
  return '<svg class="character-body" viewBox="0 0 120 168" aria-hidden="true">'+cape+'<path d="M40 120h18l-3 36H37Zm22 0h18l3 36H65Z" fill="'+(o.cut==='beach'?'#e9b995':'#1e293b')+'"/><path d="M35 151h22v11H31q-1-7 4-11Zm28 0h22q5 4 4 11H63Z" fill="#0f172a"/><path d="m43 67-15 9-13 38 11 5 13-28-5 38h52l-5-38 13 28 11-5-13-38-15-9Z" fill="'+o.color+'" stroke="#0f172a" stroke-width="2"/><path d="M54 61h12v13H54Z" fill="#cbd5e1"/>'+detail(o)+'<circle cx="19" cy="120" r="6" fill="#cbd5e1"/><circle cx="101" cy="120" r="6" fill="#cbd5e1"/>'+hat+'</svg>';
}
const neutral='<svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="29" fill="#1e293b"/><path d="M12 54q1-17 18-17t18 17" fill="#64748b"/><circle cx="30" cy="24" r="12" fill="#cbd5e1"/><circle cx="26" cy="24" r="1.5" fill="#334155"/><circle cx="34" cy="24" r="1.5" fill="#334155"/><path d="M26 30q4 3 8 0" fill="none" stroke="#334155" stroke-width="1.5"/></svg>';
export function renderCharacter(player={}, {size='seat',compact=false}={}) {
  const c=character(player.character),photo=safePhoto(player.avatar)?'<img src="'+player.avatar+'" alt="" loading="lazy">':'';
  const safeSize=['seat','profile','preview','card'].includes(size)?size:'seat';
  return '<span class="character character-'+safeSize+(compact?' character-compact':'')+'" data-outfit="'+c.outfit+'">'+(compact?'':outfitSvg(c.outfit))+'<span class="character-face">'+neutral+photo+'</span></span>';
}
