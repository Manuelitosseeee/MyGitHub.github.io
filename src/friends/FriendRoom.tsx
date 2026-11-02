import {initialPixel} from '../pixel/model';
import Scene from '../pixel/Scene';
import type {Friend} from './client';
import '../pixel/pixel.css';
export default function FriendRoom({friend}:{friend:Friend}){
 const p=friend.presence,studying=!!p?.studying&&friend.fresh;
 const state={...initialPixel(),...p,session:studying?{id:'remote',mapId:p!.mapId,songId:'',title:'',startedAt:0,activeMs:p!.activeMs,checkpoint:null,earnedCents:0,bonus:0,status:'running' as const}:null};
 return <div className="friend-room"><Scene state={state} interactive={false} running={false} bpm={100} flash={0} onBack={()=>{}} onClock={()=>{}} onMetro={()=>{}} onObject={()=>{}}/></div>;
}
