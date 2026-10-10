import {ART_W,ART_H} from './art';
import {ITEM_ART,itemId,drawPart,type SceneAssets,character} from './itemArt';
import type {MapId} from './maps';
// Fixed tools belong to the base room. Restore only their solid silhouette after
// floor purchases: NEVER paste the rectangular background around the metronome.
export function drawFixedTools(c:CanvasRenderingContext2D,base:CanvasImageSource){
 c.save();c.beginPath();
 const p=[[623,973],[628,958],[668,958],[695,886],[720,886],[745,973],[765,974],[786,986],[781,1020],[774,1020],[767,1148],[747,1148],[747,1044],[641,1044],[641,1142],[624,1142],[624,1020],[610,1010],[605,985]];
 p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();c.drawImage(base,0,0,ART_W,ART_H);c.restore();
}
export function composeRoom(c:CanvasRenderingContext2D,base:CanvasImageSource,id:MapId,owned:string[],assets:SceneAssets,actor=true){
 c.clearRect(0,0,ART_W,ART_H);c.drawImage(base,0,0,ART_W,ART_H);c.imageSmoothingEnabled=false;
 const parts=Object.entries(ITEM_ART[id]).filter(([key])=>owned.includes(itemId(id,key))).flatMap(([,p])=>p).sort((a,b)=>a.z-b.z);
 for(const p of parts.filter(p=>p.z<100))drawPart(c,assets,p);
 drawFixedTools(c,assets.toolsBase??base);
 if(actor)drawPart(c,assets,character);
 for(const p of parts.filter(p=>p.z>=100))drawPart(c,assets,p);
}
