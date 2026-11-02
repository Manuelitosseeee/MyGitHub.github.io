import {useEffect} from 'react';
import {store} from '../data/store';
import {buildDays} from '../data/selectors';
import {pixel} from '../pixel/state';
import {getIdentity,requestFriends, type Room} from './api';
import {localDayKey} from '../lib/time';
/** Monday of the user's local week, including daylight-saving transitions. */
export function weekStart(date=new Date()){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-(d.getDay()+6)%7);return localDayKey(d.getTime());}
export function currentPresence(){
 const p=pixel.get(),monday=weekStart(),committed=buildDays(store.state).filter(day=>day.date>=monday).reduce((n,day)=>n+day.totalSeconds,0);
 const session=p.session;const current=session&&session.startedAt>=new Date(monday+'T00:00:00').getTime()?session.activeMs/1000:0;
 const room:Room={mapId:p.mapId,owned:p.owned,lampOn:p.lampOn,deskLightOn:p.deskLightOn,fireOn:p.fireOn,rainOn:p.rainOn,activeMs:session?.activeMs??0};
 return {room,studying:session?.status==='running',weekKey:monday,weekSeconds:Math.round(committed+current)};
}
let published=false;
export function triggerPresenceSync(){window.dispatchEvent(new Event('mygithub:sync-friends'));}
/** Always mounted; sends updates for a logged-in identity while the site is open. */
export function FriendPresenceSync(){useEffect(()=>{
 let busy=false,lastSent=0,pending=false,alive=true;
 const push=async(force=false)=>{
  if(!getIdentity()||!navigator.onLine||!alive)return;
  if(busy){pending=true;return;}
  if(!force&&Date.now()-lastSent<6000)return;
  busy=true;try{await requestFriends('presence','POST',currentPresence());lastSent=Date.now();published=true;}catch{ /* UI explicitly reports API errors. */ }
  finally{busy=false;if(pending){pending=false;void push(true);}}
 };
 const onChange=()=>{void push();};const onVisible=()=>{if(!document.hidden)void push(true);};
 const onHide=()=>{if(!published||!getIdentity())return;const identity=getIdentity();if(!identity)return;
  // Best effort: mark as resting when leaving. The server also expires active presence after 45 seconds.
  void fetch('/api/friends/presence',{method:'POST',headers:{authorization:'Bearer '+identity.token,'content-type':'application/json'},body:JSON.stringify({...currentPresence(),studying:false}),keepalive:true}).catch(()=>{});
 };
 const unsubPixel=pixel.subscribe(onChange),unsubStore=store.subscribe(onChange);
 const interval=window.setInterval(()=>{if(!document.hidden)void push();},12000);
 window.addEventListener('online',onVisible);document.addEventListener('visibilitychange',onVisible);window.addEventListener('pagehide',onHide);window.addEventListener('mygithub:sync-friends',onVisible);
 void push(true);
 return()=>{alive=false;unsubPixel();unsubStore();window.clearInterval(interval);window.removeEventListener('online',onVisible);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('pagehide',onHide);window.removeEventListener('mygithub:sync-friends',onVisible);};
 },[]);return null;}
