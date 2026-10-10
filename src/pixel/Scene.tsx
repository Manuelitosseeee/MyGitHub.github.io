import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { clock, type PixelState } from './model';
import { prepareHands, drawHands } from './motion';
import NewScene from './NewScene';
import {MAP_ART} from './mapArt';
import { ART_W, ART_H, camera,visibleHotspot, CORE_PATH, hasAllArt, HOTSPOTS, ITEM_AREAS } from './art';
const FILES = ['approved-v2','neutral-v2','furniture-v2','empty-v2'] as const;
type Images = Record<typeof FILES[number], HTMLImageElement>;
const UPPER = [[429,708],[474,697],[519,713],[550,741],[556,768],[542,789],[539,812],[576,798],[629,749],[656,744],[686,776],[657,815],[635,836],[628,894],[626,937],[581,974],[577,1035],[478,1040],[358,1020],[350,966],[336,936],[333,865],[347,846],[390,819],[425,816],[424,781],[418,750]];
function path(c:CanvasRenderingContext2D,points:number[][]){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
function patch(c:CanvasRenderingContext2D,im:CanvasImageSource,areas:readonly (readonly number[])[]){c.save();c.beginPath();areas.forEach(([x,y,w,h])=>c.rect(x,y,w,h));c.clip();c.drawImage(im,0,0,ART_W,ART_H);c.restore();}
function polygon(c:CanvasRenderingContext2D,im:CanvasImageSource,points:number[][],dx=0,dy=0){c.save();c.translate(dx,dy);path(c,points);c.clip();c.drawImage(im,0,0,ART_W,ART_H);c.restore();}
function glow(c:CanvasRenderingContext2D,x:number,y:number,r:number,alpha:number){c.save();c.globalCompositeOperation='screen';const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(228,132,36,${alpha})`);g.addColorStop(1,'rgba(100,35,8,0)');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);c.restore();}
function leaves(images:Images){const cv=document.createElement('canvas');cv.width=ART_W;cv.height=ART_H;const c=cv.getContext('2d')!;c.drawImage(images['neutral-v2'],0,0);const d=c.getImageData(0,0,ART_W,ART_H);for(let y=0;y<ART_H;y++)for(let x=0;x<ART_W;x++){const k=(y*ART_W+x)*4;const inside=ITEM_AREAS.plant.some(([px,py,w,h])=>x>=px&&x<px+w&&y>=py&&y<py+h);if(!inside||d.data[k+1]-d.data[k]<7||d.data[k+1]<d.data[k+2]*1.05)d.data[k+3]=0;}c.putImageData(d,0,0);return cv;}
export function Sprite({id}:{id:string}){if(id.includes(':')){const [map,item]=id.split(':');const a=MAP_ART[map as keyof typeof MAP_ART]?.layers[item]?.flat();if(a){const xs=a.map(q=>q[0]),ys=a.map(q=>q[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;return <svg viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true"><image href={`/pixel/${map}-full.webp`} width={ART_W} height={ART_H}/></svg>;}}const [x,y,w,h]=(ITEM_AREAS[id]?.[0]??(id==='fire'?HOTSPOTS.fire:id==='lamp'?[143,732,130,108]:[0,0,1,1]));return <svg viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true"><image href="/pixel/approved-v2.webp" width={ART_W} height={ART_H}/></svg>;}
function HomeScene({state,running,bpm,flash,onClock,onMetro,onBack,onShop,onObject,interactive=true}:{state:PixelState;running:boolean;bpm:number;flash:number;onClock:()=>void;onMetro:()=>void;onBack:()=>void;onShop?:()=>void;onObject:(id:string)=>void;interactive?:boolean}){
 const frame=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);const current=useRef({state,running,bpm,flash});current.current={state,running,bpm,flash};const [size,setSize]=useState({width:1,height:1});const [load,setLoad]=useState('Carico la stanza…');
 useEffect(()=>{if(!frame.current)return;const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(frame.current);return()=>observer.disconnect();},[]);
 const geometry=useRef(size);geometry.current=size;
 useEffect(()=>{let alive=true,raf=0,last=0;const images={} as Images;
 Promise.all(FILES.map(name=>new Promise<void>((resolve,reject)=>{const im=new Image();im.onload=()=>{images[name]=im;resolve();};im.onerror=reject;im.src=`/pixel/${name}.webp`;}))).then(()=>{
 if(!alive)return;setLoad('');const greens=leaves(images);const hands=prepareHands(images['neutral-v2']);const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const draw=(now:number)=>{if(!alive)return;raf=requestAnimationFrame(draw);if(now-last<45||document.hidden)return;last=now;const el=canvas.current;if(!el)return;const {width:w,height:h}=geometry.current;if(w<2||h<2)return;const dpr=Math.min(2,window.devicePixelRatio||1);if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr);}const c=el.getContext('2d');if(!c)return;const {state:p,running:r,bpm:b,flash:f}=current.current;const t=now/1000,decor=reduced?0:t;const cam=camera(w,h);c.setTransform(dpr,0,0,dpr,0,0);c.imageSmoothingEnabled=false;c.translate(cam.x,cam.y);c.scale(cam.scale,cam.scale);
 const complete=hasAllArt(p.owned),lit=p.owned.includes('desk')&&p.deskLightOn;const source=lit?images['approved-v2']:images['neutral-v2'];
 if(complete)c.drawImage(source,0,0,ART_W,ART_H);else{
 c.drawImage(images['empty-v2'],0,0,ART_W,ART_H);
 for(const id of ['shelf','rug','records','desk'])if(p.owned.includes(id))patch(c,images['furniture-v2'],ITEM_AREAS[id]);
 if(p.owned.includes('art'))patch(c,images['neutral-v2'],ITEM_AREAS.art);
 if(p.owned.includes('curtains'))patch(c,images['neutral-v2'],ITEM_AREAS.curtains);
 if(p.owned.includes('plant')){c.drawImage(greens,0,0);polygon(c,images['neutral-v2'],[[0,439],[47,439],[47,491],[0,491]]);polygon(c,images['neutral-v2'],[[606,260],[659,260],[659,307],[606,307]]);polygon(c,images['neutral-v2'],[[929,258],[978,258],[978,307],[929,307]]);polygon(c,images['neutral-v2'],[[956,455],[989,455],[989,484],[956,484]]);polygon(c,images['neutral-v2'],[[951,984],[1004,984],[1004,1090],[951,1090]]);polygon(c,images['neutral-v2'],[[0,1432],[55,1432],[59,1567],[0,1567]]);}
 if(p.owned.includes('guitar'))polygon(c,images['neutral-v2'],[[854,747],[909,747],[924,775],[909,811],[900,842],[889,914],[935,968],[954,1040],[940,1087],[925,1115],[817,1115],[812,1101],[824,1090],[813,1061],[817,1000],[844,948],[860,925],[875,838],[883,792]]);
 if(p.owned.includes('cat'))patch(c,images['neutral-v2'],ITEM_AREAS.cat);
 polygon(c,images['neutral-v2'],CORE_PATH);
 polygon(c,images['neutral-v2'],[[697,886],[720,886],[744,974],[769,981],[786,988],[783,1020],[774,1020],[767,1148],[747,1148],[747,1044],[641,1044],[641,1142],[624,1142],[624,1020],[610,1010],[605,985],[623,973],[669,966]]);
 patch(c,images['neutral-v2'],[[694,244,157,67],[858,270,60,36]]);
 if(lit){patch(c,images['approved-v2'],[[143,732,130,95]]);glow(c,233,789,260,.21);}
 }
 // Remove the painted rain and pendulum before drawing their only live versions.
 patch(c,images['neutral-v2'],[[269,250,83,111],[368,250,99,111],[269,381,83,146],[368,381,99,146],[670,883,88,109]]);
 if(p.rainOn){c.save();c.beginPath();[[269,250,83,111],[368,250,99,111],[269,381,83,146],[368,381,99,146]].forEach(q=>c.rect(...q as [number,number,number,number]));c.clip();for(let i=0;i<44;i++){const x=270+(i*47)%197,y=241+((t*130+i*31)%305);c.globalAlpha=.35+(i%3)*.13;c.fillStyle=i%3?'#7388b0':'#b6b7cf';c.fillRect(x,y,2,10+(i%4)*3);}c.restore();}
 // The hearth is dark at rest; no flame is baked into the source below it.
 patch(c,images['neutral-v2'],[[22,627,106,165]]);
 if(p.owned.includes('fire')&&p.fireOn){c.save();c.beginPath();c.rect(24,634,99,150);c.clip();for(let i=0;i<5;i++){const base=36+i*19,hf=40+(Math.sin(decor*5+i*1.8)+1)*28;for(let row=0;row<hf;row+=7){const fw=Math.max(7,28-Math.floor(row/hf*4)*7),drift=Math.round(Math.sin(decor*4+i+row*.04))*5;c.fillStyle=row<hf*.45?'#ff9229':row<hf*.8?'#ffbe37':'#ffe176';c.fillRect(base-fw/2+drift,778-row,fw,7);}}for(let i=0;i<5;i++){c.fillStyle='#ffd777';c.fillRect(35+i*17,775-((decor*40+i*21)%120),3,4);}c.restore();glow(c,79,719,240,.11+.025*Math.sin(decor*6));}
 // Preserve the original character and posture; breathe without moving the chair or feet.
 if(!reduced&&p.session?.status==='running'){polygon(c,images['furniture-v2'],UPPER);polygon(c,images['neutral-v2'],UPPER,Math.sin(t*1.8)*1.2,Math.sin(t*1.8)*.5);}
 patch(c,hands.clean,hands.hands.map(q=>[q.x,q.y,q.w,q.h]));drawHands(c,hands,t,p.session?.status==='running',reduced);
 // A single pendulum remains visible whether stopped or playing.
 c.save();c.translate(708,971);c.rotate(r?Math.sin(t*Math.PI*b/60)*.45:0);c.fillStyle='#654426';c.fillRect(-3,-79,6,79);c.fillStyle='#ecba55';c.fillRect(-2,-79,4,79);c.fillRect(-7,-72,14,10);c.restore();
 if(r&&f){c.fillStyle='#ffd783';c.fillRect(697,981,22,2);}
 // Both the original desk lamp and the small shelf light toggle by direct touch.
 if(p.owned.includes('lamp')){c.fillStyle='#684129';c.fillRect(864,267,25,39);c.fillStyle='#bd8650';c.fillRect(861,269,31,4);c.fillRect(861,300,31,5);c.fillRect(864,273,3,25);c.fillRect(885,273,3,25);c.fillStyle=p.lampOn?'#ffe5a0':'#3e2c2c';c.fillRect(867,274,18,24);if(p.lampOn)glow(c,876,286,130,.18+.006*Math.sin(decor));}
 if(p.owned.includes('cat')&&!reduced&&decor%7.4<.16){c.fillStyle='#2b2534';c.fillRect(128,455,9,9);c.fillRect(147,455,9,9);}
 if(p.owned.includes('plant')&&!reduced){c.save();c.globalAlpha=.09*(.5+.5*Math.sin(decor*.8));c.drawImage(greens,Math.sin(decor*.6),0);c.restore();}
 // The clock and return arrow use their original reference coordinates and size.
 patch(c,images['neutral-v2'],[[22,47,72,61]]);c.setTransform(dpr,0,0,dpr,0,0);const box=visibleHotspot(cam,w,h,[705,256,133,40]);c.drawImage(images['neutral-v2'],694,244,157,67,box.x-11*cam.scale,box.y-12*cam.scale,157*cam.scale,67*cam.scale);c.fillStyle='#17151e';c.fillRect(box.x,box.y,box.w,box.h);c.fillStyle='#ffb740';c.font=`bold ${25*cam.scale}px monospace`;c.textAlign='center';c.textBaseline='middle';c.fillText(clock(p.session?.activeMs??0),box.x+box.w/2,box.y+box.h/2);
 };raf=requestAnimationFrame(draw);
 }).catch(()=>{if(alive)setLoad('La stanza non si è caricata. Ricarica la pagina.');});return()=>{alive=false;cancelAnimationFrame(raf);};},[]);
 const cam=camera(size.width,size.height);const area=(q:readonly number[]):CSSProperties=>({left:cam.x+q[0]*cam.scale,top:cam.y+q[1]*cam.scale,width:q[2]*cam.scale,height:q[3]*cam.scale});
 const hot=(name:string,q:readonly number[],action:()=>void,pressed?:boolean)=><button key={name} className="px-hot" style={name==='Orologio della sessione'?(()=>{const b=visibleHotspot(cam,size.width,size.height,[705,256,133,40]);return {left:b.x,top:b.y,width:b.w,height:b.h};})():area(q)} aria-label={name} aria-pressed={pressed} onClick={action}/>;
 return <div ref={frame} className="px-scene" role="group" aria-label="Casa di legno, ambiente di studio interattivo"><canvas ref={canvas} aria-label="Stanza pixel art originale, con chitarrista e arredi acquistati"/>{load&&<div className="px-load">{load}</div>}{interactive&&<><button className="px-back" aria-label="Torna alla schermata precedente" onClick={onBack}><svg viewBox="0 0 52 44" aria-hidden="true"><path fill="#ffca92" d="M0 20h4v-4h4v-4h4V8h4V4h4v12h28v12H20v12h-4v-4h-4v-4H8v-4H4v-4H0Z"/></svg></button>{hot('Orologio della sessione',HOTSPOTS.clock,onClock)}{hot('Apri il metronomo originale',HOTSPOTS.metro,onMetro)}{hot(state.rainOn?'Disattiva la pioggia':'Attiva la pioggia',HOTSPOTS.rain,()=>onObject('rain'),state.rainOn)}{state.owned.includes('fire')&&hot('Accendi o spegni il camino',HOTSPOTS.fire,()=>onObject('fire'),state.fireOn)}{state.owned.includes('lamp')&&hot('Accendi o spegni la lampada',HOTSPOTS.lamp,()=>onObject('lamp'),state.lampOn)}{state.owned.includes('desk')&&hot('Accendi o spegni la luce della scrivania',HOTSPOTS.deskLight,()=>onObject('deskLight'),state.deskLightOn)}{onShop&&<button className="px-preview-shop" onClick={onShop}>Arreda la stanza</button>}</>}</div>;
}

export default function Scene(props:Parameters<typeof HomeScene>[0]){return props.state.mapId==='home'?<HomeScene {...props}/>:<NewScene {...props} mapId={props.state.mapId}/>;}
