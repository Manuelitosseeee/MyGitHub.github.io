import {useEffect,useRef} from 'react';
import {pixel,usePixel} from '../pixel/state';
import {store} from '../data/store';
import Scene from '../pixel/Scene';
import {social,useSocial} from './client';
import {roomFrom,weekKey,weekSeconds} from './model';
import '../pixel/pixel.css';
import './social.css';
const noop=()=>{};
export default function SocialBridge(){
 const {credential}=useSocial(),p=usePixel(),snapshot=useRef<string|null>(null),asleep=useRef<string|null>(null);
 useEffect(()=>{
  if(!credential)return;
  let dead=false,busy=false,last='';
  const publish=async(force=false,closing=false)=>{
   if(busy||dead||!social.secret())return;busy=true;
   const state=pixel.get(),st=store.state;const body={room:roomFrom(state),studying:!closing&&state.session?.status==='running',weekKey:weekKey(),weekSeconds:weekSeconds(st,state)};
   const key=JSON.stringify({...body,room:{...body.room,elapsed:0},weekSeconds:Math.floor(body.weekSeconds/15)});
   try{if(force||key!==last){await social.call('/presence',closing?body:{...body,snapshot:snapshot.current,asleep:asleep.current},closing);last=key;}}catch{/* Keep local study usable offline; retry on reconnect. */}finally{busy=false;}
  };
  let polling=false;const poll=async()=>{if(polling||dead||document.hidden)return;polling=true;try{await social.refresh();}catch{}finally{polling=false;}};
  const change=()=>{void publish();};const timer=setInterval(()=>{if(!document.hidden){void publish(true);void poll();}},15000);
  const visibility=()=>{if(!document.hidden){void publish(true);void poll();}};
  const close=()=>{void publish(true,true);};const online=()=>{void publish(true);void poll();};
  const clear=()=>{close();social.clear();};
  const off=pixel.subscribe(change),offStore=store.subscribe(change);
  window.addEventListener('pagehide',close);window.addEventListener('online',online);document.addEventListener('visibilitychange',visibility);window.addEventListener('mygithub:reset-data',clear);
  void publish(true);void poll();
  return()=>{dead=true;clearInterval(timer);off();offStore();window.removeEventListener('pagehide',close);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('mygithub:reset-data',clear);};
 },[credential]);
 return credential?<><div className="social-capture px-root" aria-hidden="true"><Scene state={p} interactive={false} running={false} bpm={100} flash={0} onSnapshot={s=>{snapshot.current=s;}} onClock={noop} onMetro={noop} onBack={noop} onObject={noop}/></div><div className="social-capture px-root" aria-hidden="true"><Scene state={{...p,session:null}} interactive={false} running={false} bpm={100} flash={0} onSnapshot={s=>{asleep.current=s;}} onClock={noop} onMetro={noop} onBack={noop} onObject={noop}/></div></>:null;
}
