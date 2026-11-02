import {initialPixel,type PixelState} from '../pixel/model';
import type {DBState} from '../data/types';
export interface Room {mapId:PixelState['mapId'];owned:string[];lampOn:boolean;deskLightOn:boolean;fireOn:boolean;rainOn:boolean;elapsed:number}
export interface Friend {id:string;nickname:string;room:Room|null;studying:boolean;online:boolean;updated:number|null;weekKey:string;weekSeconds:number}
export interface Person {id:string;nickname:string}
export interface SocialData {me:Person;friends:Friend[];incoming:Person[];outgoing:Person[]}
export function roomFrom(p:PixelState):Room {return {mapId:p.mapId,owned:p.owned,lampOn:p.lampOn,deskLightOn:p.deskLightOn,fireOn:p.fireOn,rainOn:p.rainOn,elapsed:p.session?.activeMs??0};}
export function roomState(room:Room,studying:boolean):PixelState {
 const p={...initialPixel(),...room};
 if(studying||room.elapsed>0)p.session={id:'shared',mapId:p.mapId,songId:'',title:'',startedAt:0,activeMs:room.elapsed,checkpoint:null,earnedCents:0,bonus:0,status:studying?'running':'paused'};
 return p;
}
export function weekKey(now=Date.now()) {const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function weekSeconds(st:DBState,p:PixelState,now=Date.now()) {
 const start=new Date(weekKey(now)+'T00:00:00').getTime();
 const sums=new Map<string,{practice:number;session:number}>();
 const add=(song:string,at:number,seconds:number,type:'practice'|'session')=>{
  const d=new Date(at),day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const key=song+'::'+day,v=sums.get(key)??{practice:0,session:0};v[type]+=Math.max(0,seconds);sums.set(key,v);
 };
 for(const r of st.practices)if(r.date>=weekKey(now)&&new Date(r.date+'T00:00:00').getTime()<=now)add(r.songId,new Date(r.date+'T12:00:00').getTime(),r.seconds,'practice');
 for(const r of st.sessions){const end=Math.min(r.end??now,now);if(end<=start||end<r.start)continue;
  const fraction=(end-Math.max(start,r.start))/Math.max(1,end-r.start);
  add(r.songId,Math.max(start,r.start),(r.activeSeconds??(end-r.start)/1000)*fraction,'session');
 }
 for(const r of p.receipts)if(r.startedAt>=start&&!st.sessions.some(s=>s.id===r.id))add(r.songId,r.startedAt,r.activeMs/1000,'session');
 if(p.session&&p.session.startedAt>=start)add(p.session.songId,p.session.startedAt,p.session.activeMs/1000,'session');
 return Math.min(604800,Math.floor([...sums.values()].reduce((sum,v)=>sum+Math.max(v.practice,v.session),0)));
}
