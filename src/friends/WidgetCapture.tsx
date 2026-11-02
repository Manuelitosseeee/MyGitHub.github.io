import {useEffect,useRef} from 'react';
import NewScene from '../pixel/NewScene';
import {initialPixel} from '../pixel/model';
import type {PixelState} from '../pixel/model';
export default function WidgetCapture({state,onImages}:{state:PixelState;onImages:(light:string,dark:string)=>void}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{let alive=true;let tries=0;let timer=0;const capture=()=>{
  if(!alive)return;const list=Array.from(root.current?.querySelectorAll<HTMLCanvasElement>('.px-scene canvas')??[]);
  if(list.length<2||list.some(x=>x.width<100||x.height<100)){if(tries++<12)timer=window.setTimeout(capture,500);return;}
  const images=list.map((el,i)=>{const out=document.createElement('canvas');out.width=320;out.height=500;const c=out.getContext('2d')!;
   c.imageSmoothingEnabled=false;if(i===1)c.filter='grayscale(1) brightness(.46)';c.drawImage(el,0,0,320,500);return out.toDataURL('image/webp',.82)});
  onImages(images[0],images[1]);
 };timer=window.setTimeout(capture,1500);return()=>{alive=false;window.clearTimeout(timer)};
 },[state.mapId,state.owned.join('|'),state.session?.status]);
 const noop=()=>{};
 const lit={...state,lampOn:true,deskLightOn:true,session:{id:'widget',mapId:state.mapId,songId:'',title:'',startedAt:0,activeMs:0,checkpoint:null,earnedCents:0,bonus:0,status:'running' as const}};
 const dark={...initialPixel(),...state,session:null};
 return <div ref={root} aria-hidden="true" style={{position:'fixed',left:'-2000px',top:'-2000px',width:320,height:500,opacity:0,pointerEvents:'none'}}>{[lit,dark].map((s,i)=><div key={i} style={{width:320,height:500,position:'absolute',inset:0}}><NewScene state={s} mapId={s.mapId} running={false} bpm={100} flash={0} interactive={false} onClock={noop} onMetro={noop} onBack={noop} onObject={noop}/></div>)}</div>;
}
