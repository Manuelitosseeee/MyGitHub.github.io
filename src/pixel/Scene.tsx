import { useEffect,useRef,useState } from 'react';
import { clock,type PixelState } from './model';
const ASSETS=['room','guitarist','objects','clock'];
export const RECTS = [[95,0,270,514],[445,80,375,430],[924,38,225,473],[18,610,482,203],[515,525,279,327],[904,552,270,251],[109,813,307,414],[487,848,310,377],[888,848,270,384]];
export function Sprite({tile}:{tile:number}) {const [x,y,w,h]=RECTS[tile];return <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><image href="/pixel/objects.webp" width="1280" height="1280" x={-x} y={-y}/></svg>;}
export default function Scene({state,running,bpm,flash,onClock,onMetro,onBack,onShop,onObject,interactive=true}:{state:PixelState;running:boolean;bpm:number;flash:number;onClock:()=>void;onMetro:()=>void;onBack:()=>void;onShop?:()=>void;onObject:(id:string)=>void;interactive?:boolean}) {
 const canvas=useRef<HTMLCanvasElement>(null);const current=useRef({state,running,bpm,flash});current.current={state,running,bpm,flash};
 const [load,setLoad]=useState('Carico la stanza…');
 useEffect(()=>{let alive=true;let raf=0;const imgs:Record<string,HTMLImageElement>={};let last=0;
  Promise.all(ASSETS.map(name=>new Promise<void>((resolve,reject)=>{const im=new Image();im.onload=()=>{imgs[name]=im;resolve();};im.onerror=reject;im.src=`/pixel/${name}.${name==='clock'?'png':'webp'}`;}))).then(()=>{if(!alive)return;setLoad('');
   const draw=(now:number)=>{if(!alive)return;raf=requestAnimationFrame(draw);if(now-last<45)return;last=now;const c=canvas.current?.getContext('2d');if(!c)return;const {state:p,running:r,bpm}=current.current;const t=now/1000;c.imageSmoothingEnabled=false;c.clearRect(0,0,1004,1566);c.drawImage(imgs.room,0,0,1004,1566);
    const object=(tile:number,x:number,y:number,w:number,h:number)=>{const [sx,sy,sw,sh]=RECTS[tile];const k=imgs.objects.width/1280;c.drawImage(imgs.objects,sx*k,sy*k,sw*k,sh*k,x,y,w,h);};
    // Rain is clipped to the four glass panes: it never crosses the frame.
    if(p.rainOn){c.save();c.beginPath();[[251,240,108,130],[376,240,111,130],[251,390,108,136],[376,390,111,136]].forEach(q=>c.rect(q[0],q[1],q[2],q[3]));c.clip();for(let i=0;i<40;i++){const x=250+(i*47)%238;const y=225+((t*130+i*31)%325);c.fillStyle=i%3?'#5d779b':'#94a3c0';c.globalAlpha=.35+(i%3)*.13;c.fillRect(x,y,2,10+(i%4)*3);}c.restore();}
    if(p.owned.includes('art'))object(5,574,420,133,128);
    if(p.owned.includes('shelf'))object(0,745,350,237,551);
    if(p.owned.includes('rug'))object(3,170,1115,640,215);
    if(p.owned.includes('records'))object(7,30,1170,155,173);
    if(p.owned.includes('plant'))object(4,870,1030,124,147);
    if(p.owned.includes('desk')){object(1,10,875,302,285);c.save();c.globalCompositeOperation='screen';const glow=c.createRadialGradient(230,883,0,230,883,170);glow.addColorStop(0,'#a35a1f55');glow.addColorStop(1,'#0000');c.fillStyle=glow;c.fillRect(40,710,370,330);c.restore();}
    if(p.owned.includes('guitar'))object(2,800,853,152,285);
    if(p.owned.includes('lamp')){object(6,680,735,110,350);if(p.lampOn){c.save();c.globalCompositeOperation='screen';const g=c.createRadialGradient(743,788,0,743,788,235);g.addColorStop(0,'#a15b1f70');g.addColorStop(1,'#0000');c.fillStyle=g;c.fillRect(510,570,470,500);c.restore();}else{c.fillStyle='#362b2388';c.fillRect(710,750,70,85);}}
    if(p.owned.includes('fire')&&p.fireOn){c.save();c.beginPath();c.rect(20,638,131,153);c.clip();c.fillStyle='#4d2214';c.fillRect(27,750,117,30);for(let i=0;i<5;i++){const base=38+i*21;const h=45+((Math.sin(t*5+i*1.8)+1)*24);for(let row=0;row<h;row+=7){const width=Math.max(7,28-Math.floor(row/h*4)*7);const drift=Math.round(Math.sin(t*4+i+row*.04))*7;c.fillStyle=row<h*.45?'#ff9229':row<h*.8?'#ffbe37':'#ffe176';c.fillRect(base-width/2+drift,778-row,width,7);}c.fillStyle='#ffe68d';c.fillRect(base-5,766,14,14);}for(let i=0;i<5;i++){c.fillStyle='#ffd777';c.fillRect(40+i*20,775-((t*40+i*21)%120),3,4);}c.restore();c.save();c.globalCompositeOperation='screen';const g=c.createRadialGradient(78,720,0,78,720,275);g.addColorStop(0,`rgba(190,75,10,${.13+.04*Math.sin(t*6)})`);g.addColorStop(1,'#0000');c.fillStyle=g;c.fillRect(0,490,380,530);c.restore();}
    // Chair and feet are fixed; the upper body gently breathes above the hip pivot.
    const ch=imgs.guitarist;const x=320,y=710,w=320,h=510;const cut=.67;const sway=p.session?.status==='running'?Math.sin(t*1.9)*.006:Math.sin(t)*.002;
    c.drawImage(ch,0,ch.height*cut,ch.width,ch.height*(1-cut),x,y+h*cut,w,h*(1-cut));
    c.save();c.translate(x+w*.5,y+h*cut);c.rotate(sway);c.drawImage(ch,0,0,ch.width,ch.height*cut,-w*.5,-h*cut,w,h*cut);c.restore();
    object(8,615,941,162,255);
    if(r){c.save();c.translate(706,1020);c.rotate(Math.sin(t*Math.PI*bpm/60)*.48);c.fillStyle='#f5c165';c.fillRect(-2,-105,4,105);c.fillRect(-7,-99,14,8);c.restore();}
    // The approved clock frame is preserved; its digits are rendered live.
    c.drawImage(imgs.clock,695,240,168,71);c.fillStyle='#17151e';c.fillRect(706,251,146,49);c.fillStyle='#ffb740';c.font='bold 26px monospace';c.textAlign='center';c.textBaseline='middle';c.fillText(clock(p.session?.activeMs??0),779,277);
   };raf=requestAnimationFrame(draw);
  }).catch(()=>{if(alive)setLoad('La stanza non si è caricata. Ricarica la pagina.');});return()=>{alive=false;cancelAnimationFrame(raf);};
 },[]);
 return <div className="px-scene" role="group" aria-label="Casa di legno, ambiente di studio interattivo"><canvas ref={canvas} width="1004" height="1566" aria-label="Stanza pixel art con chitarrista, pioggia e arredi acquistati"/>{load&&<div className="px-load">{load}</div>}{interactive&&<><button className="px-back" aria-label="Torna alla schermata precedente" onClick={onBack}><svg viewBox="0 0 52 44" aria-hidden="true"><path fill="#ffca92" d="M0 20h4v-4h4v-4h4V8h4V4h4v12h28v12H20v12h-4v-4h-4v-4H8v-4H4v-4H0Z"/></svg></button><button className="px-hot px-clock-hot" aria-label="Orologio della sessione" onClick={onClock}><span className="sr-only">{clock(state.session?.activeMs??0)}</span></button><button className="px-hot px-metro-hot" aria-label="Apri il metronomo originale" onClick={onMetro}/><button className="px-hot px-window-hot" aria-label={state.rainOn?'Disattiva la pioggia':'Attiva la pioggia'} onClick={()=>onObject('rain')}/>{state.owned.includes('fire')&&<button className="px-hot px-fire-hot" aria-label="Accendi o spegni il camino" onClick={()=>onObject('fire')}/ >}{state.owned.includes('lamp')&&<button className="px-hot px-lamp-hot" aria-label="Accendi o spegni la lampada" onClick={()=>onObject('lamp')}/ >}{onShop&&<button className="px-preview-shop" onClick={onShop}>Arreda la stanza</button>}</>}</div>;
}
