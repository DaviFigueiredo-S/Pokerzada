// Codec injetado para usar a mesma implementação nos testes e no Deno.
export function photoProcessor(jpeg) {
  const uri=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return 'data:image/jpeg;base64,'+btoa(s);};
  return (source,crop)=>{
    if(!source)return {source:'',avatar:''};
    if(typeof source!=='string'||source.length>1500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(source))throw Error('Fotografia inválida. Escolha novamente JPEG, PNG ou WebP no editor.');
    let decoded;
    try {const bytes=Uint8Array.from(atob(source.split(',')[1]),c=>c.charCodeAt(0));decoded=jpeg.decode(bytes,{useTArray:true,maxResolutionInMP:2,maxMemoryUsageInMB:48,tolerantDecoding:false});}catch{throw Error('Não foi possível decodificar a fotografia.');}
    const {width,height,data}=decoded;
    if(width>1200||height>1200||width<1||height<1)throw Error('Fotografia excede as dimensões permitidas.');
    const clean=uri(jpeg.encode({width,height,data},85).data);
    const side=Math.min(width,height)/crop.zoom,x=(width-side)*crop.x,y=(height-side)*crop.y;
    const output=new Uint8Array(240*240*4);
    // Interpolação bilinear; recorte feito novamente no servidor.
    for(let dy=0;dy<240;dy++)for(let dx=0;dx<240;dx++){
      const fx=Math.min(width-1,x+(dx+.5)*side/240),fy=Math.min(height-1,y+(dy+.5)*side/240);
      const x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),wx=fx-x0,wy=fy-y0;
      for(let k=0;k<3;k++)output[(dy*240+dx)*4+k]=Math.round(data[(y0*width+x0)*4+k]*(1-wx)*(1-wy)+data[(y0*width+x1)*4+k]*wx*(1-wy)+data[(y1*width+x0)*4+k]*(1-wx)*wy+data[(y1*width+x1)*4+k]*wx*wy);
      output[(dy*240+dx)*4+3]=255;
    }
    const avatar=uri(jpeg.encode({width:240,height:240,data:output},80).data);
    if(clean.length>1500000||avatar.length>200000)throw Error('Imagem muito grande após processamento. Escolha uma fotografia menor.');
    return {source:clean,avatar};
  };
}
