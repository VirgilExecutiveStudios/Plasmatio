'use strict';
// Extract independently animatable artwork against the exact original gradient.
window.PlasmatioLayers = class {
 constructor(image) {
  const canvas=document.createElement('canvas');canvas.width=1366;canvas.height=768;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  this.source=ctx.getImageData(0,0,1366,768);this.used=new Uint8Array(1366*768);
 }
 background() {
  const canvas=document.createElement('canvas');canvas.width=1366;canvas.height=768;
  const ctx=canvas.getContext('2d');
  for(let y=0;y<768;y++) {const i=(y*1366+1365)*4,d=this.source.data;ctx.fillStyle=`rgb(${d[i]},${d[i+1]},${d[i+2]})`;ctx.fillRect(0,y,1366,1);}
  return canvas;
 }
 crop(box,mark=true,residual=false) {
  const [x,y,w,h]=box,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d'),out=ctx.createImageData(w,h),src=this.source.data;let visible=false;
  for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++) {
   const pos=(y+dy)*1366+x+dx,from=pos*4,to=(dy*w+dx)*4,bg=((y+dy)*1366+1365)*4;
   if(residual&&this.used[pos])continue;if(mark)this.used[pos]=1;
   let a=0;
   for(let c=0;c<3;c++){const p=src[from+c],b=src[bg+c];a=Math.max(a,p>b?(p-b)/(255-b||1):(b-p)/(b||1));}
   if(a===0)continue;visible=true;a=Math.ceil(a*255)/255;
   for(let c=0;c<3;c++)out.data[to+c]=Math.round((src[from+c]-src[bg+c]*(1-a))/a);
   out.data[to+3]=Math.round(a*255);
  }
  ctx.putImageData(out,0,0);canvas.setAttribute('aria-hidden','true');canvas.dataset.visible=String(visible);return canvas;
 }
};
