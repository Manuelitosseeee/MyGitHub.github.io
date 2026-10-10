import type {MapId} from './maps';
import dimensions from './itemDimensions.json';
import bounds from './itemBounds.json';
export type SceneAssets=Record<string,CanvasImageSource>;
export interface Part {asset:string;x:number;y:number;w:number;h:number;z:number;project?:boolean;mount?:boolean;ground?:boolean;hanger?:boolean}
// Source frames exclude adjacent atlas fragments, without changing the artwork.
export const SOURCE_RECT:Record<string,[number,number,number,number]>={
 'home-art-guitar':[0,0,108,159], 'studio-monitor-left':[20,0,100,145],
 'studio-monitor-right':[24,0,101,136], 'studio-monitor-screen':[0,23,155,102],
 'studio-headphones':[19,5,89,101], 'rehearsal-art-player':[26,0,104,233],
 'rehearsal-art-sunset':[30,0,100,267], 'rehearsal-art-neck':[28,0,136,242],
 'shop-shelf-2':[0,11,387,134], 'stage-piano':[7,0,457,534]
};
export const SOURCE_POLY:Record<string,number[][]>={
 'stage-wedge-left':[[0,0],[205,0],[205,76],[243,147],[243,272],[0,272]],
 'stage-wedge-right':[[0,0],[245,0],[245,305],[73,305],[73,224],[58,213],[0,145]]
};
export function sourceFrame(asset:string):[number,number,number,number]{const d=dimensions[asset as keyof typeof dimensions];return SOURCE_RECT[asset]??[0,0,d.width,d.height];}
const fit=(asset:string,x:number,y:number,height:number,z=10):Part=>{const [, ,w,h]=sourceFrame(asset);return {asset,x,y,w:height*w/h,h:height,z};};
// Anchor the actual painted feet, rather than the transparent PNG rectangle.
const standing=(asset:string,x:number,bottom:number,height:number,z=10):Part=>{const [,sy,,sh]=sourceFrame(asset),b=bounds[asset as keyof typeof bounds];return {...fit(asset,x,bottom-height*(b.bottom-sy)/sh,height,z),ground:true};};
const plane=(asset:string,x:number,y:number,w:number,h:number):Part=>({asset,x,y,w,h,z:0,project:true});
const pot=(x:number,bottom:number,h:number,z=30,mount=false):Part=>({...standing('plant',x,bottom,h,z),mount,ground:!mount&&bottom>900});
// Wall pots include their own small bracket: they remain supported even if no
// furniture has been bought. Floor objects use separate, non-overlapping bays.
export const ITEM_ART:Record<MapId,Record<string,Part[]>>={
 home:{
  rug:[plane('home-rug',118,1146,812,160)],
  desk:[standing('home-desk',4,1135,395)],
  shelf:[standing('home-shelf',550,1030,595)],
  guitar:[standing('home-guitar',783,1130,355,40)],
  art:[fit('home-art-note',25,242,125),fit('home-art-guitar',630,342,85),fit('home-art-score',166,605,110)],
  records:[standing('home-records',15,1510,185,150)],
  curtains:[fit('home-curtains',133,183,403)],
  cat:[standing('home-cat',113,494,62,35)],
  plant:[pot(12,494,105),pot(619,307,105),pot(900,307,100),pot(835,438,105,30,true),pot(885,719,90,30,true),pot(801,1475,205,180),pot(295,1515,205,180)]
 },
 studio:{
  console:[standing('studio-console',10,1000,365)],
  rug:[plane('studio-rug',12,1086,980,244)],
  monitors:[standing('studio-monitor-left',16,624,125),standing('studio-monitor-screen',154,624,118),standing('studio-monitor-right',585,624,125),{...fit('studio-headphones',874,383,92),hanger:true}],
  rack:[standing('studio-rack',727,960,400)],
  mic:[standing('studio-mic',8,1160,365,40)],
  guitar:[standing('studio-guitar',805,1118,330,40)],
  plants:[pot(882,310,118),pot(733,558,120,30,true),pot(797,1450,205,180),pot(325,1515,200,180)],
  cases:[standing('studio-cases',18,1515,220,150)],
  lamp:[standing('studio-lamp',605,960,300)]
 },
 shop:{
  counter:[standing('shop-counter',12,1045,370)],
  rug:[plane('shop-rug',180,1130,710,195)],
  wall:[fit('shop-wall',170,295,300)],
  cabinet:[standing('shop-cabinet',680,1045,390)],
  shelves:[fit('shop-shelf-1',10,385,51),fit('shop-shelf-2',10,506,54),fit('shop-shelf-3',686,422,101)],
  guitars:[standing('shop-guitars',16,1490,350,140)],
  plants:[pot(546,248,98),pot(886,244,100),pot(20,368,82,30,true),pot(604,576,85,30,true),pot(364,816,82,30,true),pot(394,1515,205,180)],
  art:[fit('shop-art-note',52,180,104),fit('shop-art-violin',604,315,94),fit('shop-art-guitar',595,625,100)]
 },
 rehearsal:{
  drums:[standing('rehearsal-drums',8,1000,355)],
  rug:[plane('rehearsal-rug-small',8,980,365,66),plane('rehearsal-rug-large',99,1078,840,260)],
  keys:[standing('rehearsal-keys',401,950,310)],
  amps:[standing('rehearsal-amp-left',757,949,320),standing('rehearsal-amp-right',905,977,150)],
  bass:[standing('rehearsal-bass',803,1112,330,40)],
  pedals:[standing('rehearsal-pedals',793,1348,248,130)],
  cases:[standing('rehearsal-cases',15,1425,245,140)],
  plants:[pot(20,442,140,30,true),pot(410,602,80,30,true),pot(648,476,105,30,true),pot(904,308,100),pot(336,1505,180,180)],
  art:[fit('rehearsal-art-player',232,298,165),fit('rehearsal-art-sunset',346,320,165),fit('rehearsal-art-neck',735,385,155)]
 },
 stage:{
  mic:[standing('stage-mic',18,1178,350,40)],
  lights:[standing('stage-lights',325,1358,45,160)],
  piano:[standing('stage-piano',55,1032,485)],
  amp:[standing('stage-amp',779,1340,170,140)],
  guitar:[standing('stage-guitar',815,1118,345,40)],
  wedges:[standing('stage-wedge-left',12,1290,110,150),standing('stage-wedge-right',903,1290,110,150)]
 }
};
export const character=fit('character',332,699,510,100);
export const itemId=(map:MapId,item:string)=>map==='home'?item:`${map}:${item}`;
export function assetNames(map:MapId){return [...new Set(['character',...Object.values(ITEM_ART[map]).flat().map(p=>p.asset)])];}
export function drawPart(c:CanvasRenderingContext2D,assets:SceneAssets,p:Part,dx=0){
 const im=assets[p.asset];if(!im)throw new Error(`Missing sprite ${p.asset}`);
 const [sx,sy,sw,sh]=sourceFrame(p.asset),b=bounds[p.asset as keyof typeof bounds];
 const foot=p.y+p.h*(b.bottom-sy)/sh,cx=p.x+p.w*.53;
 if(p.ground){c.save();c.fillStyle='rgba(25,16,20,.18)';c.beginPath();c.ellipse(cx,foot,p.w*.28,Math.min(8,p.h*.025),0,0,Math.PI*2);c.fill();c.restore();}
 if(p.hanger){c.fillStyle='#5b4130';c.fillRect(cx-9,p.y-13,18,15);c.fillStyle='#ba844d';c.fillRect(cx-3,p.y-9,6,25);}
 if(p.mount){const half=p.w*.23;c.fillStyle='#603b29';c.fillRect(cx-half,foot,half*2,7);c.fillStyle='#bd7c43';c.fillRect(cx-half,foot,half*2,3);c.fillStyle='#68432d';c.fillRect(cx-half+5,foot+7,5,13);c.fillRect(cx+half-10,foot+7,5,13);}
 // The pot and support never move; only leaf tips receive ambient motion.
 c.save();const poly=SOURCE_POLY[p.asset];if(poly){c.beginPath();poly.forEach(([x,y],i)=>{const xx=p.x+(x-sx)*p.w/sw,yy=p.y+(y-sy)*p.h/sh;i?c.lineTo(xx,yy):c.moveTo(xx,yy)});c.closePath();c.clip();}
 if(dx){c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h*.64);c.clip();c.drawImage(im,sx,sy,sw,sh,p.x+dx,p.y,p.w,p.h);c.restore();}
 else c.drawImage(im,sx,sy,sw,sh,p.x,p.y,p.w,p.h);
 if(p.asset==='rehearsal-art-player'||p.asset==='rehearsal-art-sunset'){c.fillStyle='#513426';c.fillRect(p.x+p.w-5,p.y+5,5,p.h-10);c.fillStyle='#d09451';c.fillRect(p.x+p.w-5,p.y+8,2,p.h-16);}
 c.restore();
}
export function roomParts(id:MapId,owned:string[]){return Object.entries(ITEM_ART[id]).filter(([key])=>owned.includes(itemId(id,key))).flatMap(([,p])=>p).sort((a,b)=>a.z-b.z);}
export function drawForeground(c:CanvasRenderingContext2D,assets:SceneAssets,id:MapId,owned:string[]){for(const p of roomParts(id,owned).filter(p=>p.z>=100))drawPart(c,assets,p);}
export async function loadAssets(map:MapId):Promise<SceneAssets>{const pairs=await Promise.all(assetNames(map).map(name=>new Promise<[string,HTMLImageElement]>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve([name,im]);im.onerror=()=>reject(new Error(`Missing sprite ${name}`));im.src=`/pixel/items/${name}.png`;})));return Object.fromEntries(pairs);}
