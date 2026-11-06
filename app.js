'use strict';
const pages=window.PlasmatioPages,primary=window.PlasmatioPrimaryPages;
const stage=document.getElementById('screen'),pageLayer=document.getElementById('page-layer');
const behavior=new Heptagon({root:document}),sources=new Map();
let current=null,transitioning=false,requested=null;
function position(node,[x,y,w,h]){Object.assign(node.style,{left:`${x}px`,top:`${y}px`,width:`${w}px`,height:`${h}px`});}
function resize(){stage.style.transform=`translate(-50%,-50%) scale(${Math.min(innerWidth/1366,innerHeight/768)})`;}
addEventListener('resize',resize);resize();
async function source(n){
 if(!sources.has(n))sources.set(n,(async()=>{const im=new Image();im.src=`assets/${n}.png`;await im.decode();return new PlasmatioLayers(im);})());
 return sources.get(n);
}
function element(spec,art,parent=pageLayer){
 const node=document.createElement(spec.to?'button':'div');node.className='element';node.dataset.element=spec.id;
 node.setAttribute('aria-label',spec.label);if(!spec.to)node.setAttribute('role','img');
 if(spec.to)node.addEventListener('click',()=>navigate(spec.to));
 position(node,spec.box);const canvas=art.crop(spec.box);
 for(const[x,y,w,h]of(spec.cutouts||[]))canvas.getContext('2d').clearRect(x-spec.box[0],y-spec.box[1],w,h);
 node.append(canvas);parent.append(node);behavior.register(node);return node;
}
async function makeNavigator(page,art,toolbar){
 const nav=document.createElement('nav');nav.className='page-nav';nav.setAttribute('aria-label','Page directory');nav.id='page-symbols';
 const ids=[current,...primary.filter(id=>id!==current)];let closeTimer;
 function expand(value){
  clearTimeout(closeTimer);nav.classList.toggle('expanded',value);toolbar.classList.toggle('shifted',value);
  nav.firstElementChild?.setAttribute('aria-expanded',String(value));
  nav.querySelectorAll('[data-destination]').forEach(el=>{el.tabIndex=value?0:-1;el.inert=!value;});
 }
 for(const [i,id]of ids.entries()){
  const p=pages[id],src=await source(p.image),button=document.createElement('button');
  button.className='page-symbol';button.setAttribute('aria-label',i===0?`${p.title}: open page directory`:p.title);
  button.append(src.crop(p.icon,false));button.style.top=`${i*56}px`;
  if(i===0){
   art.crop(page.icon);button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','page-symbols');
   button.addEventListener('pointerenter',()=>expand(true));button.addEventListener('focus',()=>expand(true));button.addEventListener('click',()=>expand(true));
  }else{
   button.dataset.destination=id;button.tabIndex=-1;button.inert=true;button.addEventListener('click',()=>navigate(id));
  }
  nav.append(button);behavior.register(button);
 }
 nav.addEventListener('pointerleave',()=>{closeTimer=setTimeout(()=>{if(!nav.contains(document.activeElement))expand(false)},120)});
 nav.addEventListener('focusout',()=>queueMicrotask(()=>{if(!nav.contains(document.activeElement))expand(false)}));
 nav.addEventListener('keydown',e=>{
  const buttons=[...nav.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);
  if(e.key==='Escape'){expand(false);buttons[0].blur();}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();expand(true);buttons[(i+(e.key==='ArrowDown'?1:3))%4].focus();}
 });
 pageLayer.append(nav);
}
async function render(name){
 behavior.unregisterAll();pageLayer.replaceChildren();current=name;
 const p=pages[name],art=await source(p.image);art.used.fill(0);
 const bg=document.createElement('div');bg.className='page-background';bg.dataset.element='background';bg.setAttribute('aria-label','Gradient background');bg.append(art.background());pageLayer.append(bg);behavior.register(bg);
 for(const spec of p.elements)element(spec,art);
 if(p.toolbar){const toolbar=document.createElement('div');toolbar.className='toolbar';
  for(const[id,label,box,to]of p.toolbar)element({id,label,box,to},art,toolbar);
  pageLayer.append(toolbar);await makeNavigator(p,art,toolbar);
 }
 const remaining=art.crop([0,0,1366,768],false,true);
 if(remaining.dataset.visible==='true'){
  const decor=document.createElement('div');decor.className='residual';decor.dataset.element='fine-artwork';decor.setAttribute('aria-label','Fine artwork');decor.append(remaining);pageLayer.insertBefore(decor,bg.nextSibling);behavior.register(decor);
 }
 document.querySelectorAll('.window-control').forEach(node=>behavior.register(node));
 document.title=`PLASMATIO — ${p.title}`;stage.setAttribute('aria-label',p.title);stage.dataset.page=name;
 if(primary.includes(name))localStorage.setItem('plasmatio.lastPage',name);
 await behavior.enter();document.dispatchEvent(new CustomEvent('plasmatio:page-ready',{detail:{page:name}}));
}
async function navigate(name){
 if(!pages[name])return;requested=name;if(transitioning)return;transitioning=true;
 try{while(requested){const next=requested;requested=null;if(next===current)continue;
  if(current)await behavior.leave();history.replaceState(null,'',`#${next}`);await render(next);
 }}finally{transitioning=false;}
}
addEventListener('hashchange',()=>navigate(location.hash.slice(1)));
document.querySelector('[data-window="minimize"]').addEventListener('click',()=>window.desktop?.minimize());
document.querySelector('[data-window="maximize"]').addEventListener('click',()=>window.desktop?.maximize());
document.querySelector('[data-window="close"]').addEventListener('click',()=>window.desktop?.close());
window.desktop?.onMaximized(value=>{const el=document.querySelector('[data-window="maximize"]');el.classList.toggle('restoring',value);el.setAttribute('aria-label',value?'Restore window':'Maximize window');});
window.desktop?.onBeforeClose(async()=>{await behavior.leave();window.desktop.finishClose();});
window.Plasmatio={navigate,behavior,get current(){return current},get transitioning(){return transitioning}};
const initial=location.hash.slice(1)||localStorage.getItem('plasmatio.lastPage')||'welcome';
navigate(pages[initial]?initial:'welcome');
