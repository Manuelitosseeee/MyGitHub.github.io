import {ART_W,ART_H} from './art';
import {MAP_ART,NEW_CORE,type Poly} from './mapArt';
import {itemsForMap} from './model';
import type {MapId} from './maps';
function path(c:CanvasRenderingContext2D,p:Poly){c.moveTo(...p[0] as [number,number]);p.slice(1).forEach(q=>c.lineTo(...q as [number,number]));c.closePath();}
function layer(c:CanvasRenderingContext2D,im:CanvasImageSource,p:Poly,exclude=false){c.save();c.beginPath();path(c,p);c.clip();if(exclude){c.beginPath();c.rect(0,0,ART_W,ART_H);path(c,NEW_CORE);c.clip('evenodd');}c.drawImage(im,0,0,ART_W,ART_H);c.restore();}
function restore(c:CanvasRenderingContext2D,im:CanvasImageSource,q:number[]){c.drawImage(im,...q as [number,number,number,number],...q as [number,number,number,number]);}
// Keep the approved rug pixels. Only areas originally occluded by another
// object are reconstructed from clean rug pixels, before that object's sprite
// is added. This never paints a missing-item rectangle over a purchased object.
function rugs(c:CanvasRenderingContext2D,full:CanvasImageSource,id:Exclude<MapId,'home'>){
 const art=MAP_ART[id];for(const shape of art.layers.rug??[])layer(c,full,shape,true);
 const clean:Record<string,number[]>={studio:[390,1230,270,70],shop:[450,1240,280,80],rehearsal:[410,1230,260,70]};
 const repairs:Record<string,number[][]>={studio:[[0,1184,351,146],[90,1086,170,90],[810,1086,150,36]],shop:[[164,1129,128,210],[877,1129,14,210]],rehearsal:[[89,1072,248,266],[750,1212,254,126]]};
 if(!clean[id])return;c.save();c.beginPath();for(const shape of art.layers.rug??[])path(c,shape);c.clip();c.beginPath();c.rect(0,0,ART_W,ART_H);path(c,NEW_CORE);c.clip('evenodd');
 const [sx,sy,sw,sh]=clean[id];for(const [x,y,w,h]of repairs[id])for(let yy=0;yy<h;yy+=sh)for(let xx=0;xx<w;xx+=sw){const ww=Math.min(sw,w-xx),hh=Math.min(sh,h-yy);c.drawImage(full,sx,sy,ww,hh,x+xx,y+yy,ww,hh);}c.restore();
}
// Purchases add artwork. Unowned item bounds NEVER erase pixels from another layer.
// Foliage uses a transparent sprite in NewScene; its bounding box is not a room cutout.
export function composeRoom(c:CanvasRenderingContext2D,full:CanvasImageSource,base:CanvasImageSource,id:Exclude<MapId,'home'>,owned:string[]){
 const art=MAP_ART[id];c.clearRect(0,0,ART_W,ART_H);c.drawImage(base,0,0,ART_W,ART_H);
 if(itemsForMap(id).every(i=>owned.includes(i.id))){c.drawImage(full,0,0,ART_W,ART_H);layer(c,base,NEW_CORE);}
 else{
  if(owned.includes(`${id}:rug`))rugs(c,full,id);
  for(const [item,shapes]of Object.entries(art.layers))if(item!=='rug'&&item!=='plants'&&owned.includes(`${id}:${item}`))for(const shape of shapes)layer(c,full,shape,true);
 }
 restore(c,base,[22,44,72,66]);restore(c,base,[669,883,90,111]);restore(c,base,art.clock);
 if(owned.includes(`${id}:plants`))for(const pot of art.pots??[])layer(c,full,pot,true);
}
