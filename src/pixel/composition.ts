import {ART_W,ART_H} from './art';
import {MAP_ART,NEW_CORE,type Poly} from './mapArt';
import {itemsForMap} from './model';
import type {MapId} from './maps';
function path(c:CanvasRenderingContext2D,p:Poly){c.moveTo(...p[0] as [number,number]);p.slice(1).forEach(q=>c.lineTo(...q as [number,number]));c.closePath();}
function layer(c:CanvasRenderingContext2D,im:CanvasImageSource,p:Poly,exclude=false){c.save();c.beginPath();path(c,p);c.clip();if(exclude){c.beginPath();c.rect(0,0,ART_W,ART_H);path(c,NEW_CORE);c.clip('evenodd');}c.drawImage(im,0,0,ART_W,ART_H);c.restore();}
function restore(c:CanvasRenderingContext2D,im:CanvasImageSource,q:number[]){c.drawImage(im,...q as [number,number,number,number],...q as [number,number,number,number]);}
function carpet(c:CanvasRenderingContext2D,p:Poly,id:string){const x=Math.min(...p.map(q=>q[0])),y=Math.min(...p.map(q=>q[1])),w=Math.max(...p.map(q=>q[0]))-x,h=Math.max(...p.map(q=>q[1]))-y;const colors=id==='shop'?['#263f3c','#b66e3c','#d59652']:['#813d38','#bb7849','#dba354'];c.fillStyle=colors[1];c.fillRect(x,y,w,h);c.fillStyle=colors[0];c.fillRect(x+12,y+12,w-24,h-24);c.strokeStyle=colors[2];c.lineWidth=5;c.strokeRect(x+25,y+25,w-50,h-50);for(let xx=x+40;xx<x+w-35;xx+=53)for(let yy=y+40;yy<y+h-30;yy+=42){c.fillStyle=colors[((xx+yy)%3)?1:2];c.fillRect(xx,yy,12,4);c.fillRect(xx+4,yy-4,4,12);}c.fillStyle=colors[2];for(let xx=x+5;xx<x+w;xx+=15){c.fillRect(xx,y-4,4,7);c.fillRect(xx,y+h-3,4,7);}}
// Purchases add artwork. Unowned item bounds NEVER erase pixels from another layer.
// Foliage uses a transparent sprite in NewScene; its bounding box is not a room cutout.
export function composeRoom(c:CanvasRenderingContext2D,full:CanvasImageSource,base:CanvasImageSource,id:Exclude<MapId,'home'>,owned:string[]){
 const art=MAP_ART[id];c.clearRect(0,0,ART_W,ART_H);c.drawImage(base,0,0,ART_W,ART_H);
 if(itemsForMap(id).every(i=>owned.includes(i.id))){c.drawImage(full,0,0,ART_W,ART_H);layer(c,base,NEW_CORE);}
 else{
  if(owned.includes(`${id}:rug`))for(const shape of art.layers.rug??[])carpet(c,shape,id);
  for(const [item,shapes]of Object.entries(art.layers))if(item!=='rug'&&item!=='plants'&&owned.includes(`${id}:${item}`))for(const shape of shapes)layer(c,full,shape,true);
 }
 restore(c,base,[22,44,72,66]);restore(c,base,[669,883,90,111]);restore(c,base,art.clock);
 if(owned.includes(`${id}:plants`))for(const pot of art.pots??[])layer(c,full,pot,true);
}
