import { MAPS, type MapId } from './maps';
export { MAPS, type MapId } from './maps';
export const PIXEL_KEY = 'mygithub.pixel-story.v1';
export interface Item { id: string; map?:MapId; included?:boolean; name: string; price: number; bonus: number; required: boolean; tile?: number; description: string; }
export const ITEMS: Item[] = [
  { id:'rug', name:'Tappeto intrecciato',price:25,bonus:0,required:true,tile:3,description:'Un angolo caldo per la tua postazione.' },
  { id:'desk',name:'Scrivania musicale',price:80,bonus:5,required:true,tile:1,description:'Scrivania, sedia e lampada da studio · +5% permanente.' },
  { id:'shelf',name:'Libreria del musicista',price:140,bonus:10,required:true,tile:0,description:'La libreria originale e le sue collezioni · +10% permanente.' },
  { id:'guitar',name:'Classica in noce',price:220,bonus:20,required:true,tile:2,description:'Una seconda classica · +20% permanente.' },
  { id:'fire',name:'Legna per il camino',price:50,bonus:0,required:true,description:'Accendi il fuoco: fiamme, scintille e luce viva.' },
  { id:'lamp',name:'Lanterna sulla mensola',price:45,bonus:0,required:true,description:'Una luce calda sulla mensola: toccala per accenderla o spegnerla.' },
  { id:'plant',name:'Piante e foglie della casa',price:20,bonus:0,required:false,tile:4,description:'Piante sul camino, sulla mensola, sulla libreria e vicino ai mobili.' },
  { id:'art',name:'Quadri musicali',price:15,bonus:0,required:false,tile:5,description:'I tre quadri originali: nota, chitarra e spartito.' },
  { id:'records',name:'Mobiletto dei libri',price:100,bonus:5,required:false,tile:7,description:'Il mobiletto in primo piano con tutti i suoi libri · +5% permanente.' },
];
ITEMS.push(
 {id:'curtains',name:'Tende color malva',price:15,bonus:0,required:false,description:'Le tende originali ai lati della finestra.'},
 {id:'cat',name:'Gattino sul camino',price:10,bonus:0,required:false,description:'Un compagno tranquillo che ogni tanto socchiude gli occhi.'},
);
const extras: [MapId,string,string,number,number,boolean,boolean,string][] = [
 ['studio','console','Banco mixer',0,0,true,true,'La postazione principale è inclusa con la mappa.'],
 ['studio','rug','Tappeto da studio',0,0,false,true,'Il tappeto originale sotto la postazione.'],
 ['studio','monitors','Monitor e diffusori',180,5,true,false,'Schermo DAW, monitor e cuffie · +5% permanente.'],
 ['studio','rack','Rack professionale',350,10,true,false,'Attrezzatura professionale e VU meter animati · +10%.'],
 ['studio','mic','Microfoni e leggii',160,0,true,false,'Microfoni e spartiti dentro e fuori la cabina.'],
 ['studio','guitar','Classica da registrazione',420,10,true,false,'Una classica in noce pronta per incidere · +10%.'],
 ['studio','plants','Piante dello studio',65,0,false,false,'Verde sulla mensola, sui rack e vicino alle casse.'],
 ['studio','cases','Flight case',130,0,false,false,'Le custodie professionali in primo piano.'],
 ['studio','lamp','Lampada dello studio',90,0,false,false,'Illuminazione soffusa e pulsante al tocco.'],
 ['shop','counter','Bancone del negozio',0,0,true,true,'Bancone, cassa e campanello inclusi.'],
 ['shop','rug','Tappeto del negozio',0,0,false,true,'Un angolo caldo per studiare tra gli strumenti.'],
 ['shop','wall','Chitarre da esposizione',320,5,true,false,'Classiche, elettrica e ukulele appesi · +5%.'],
 ['shop','cabinet','Vetrina degli strumenti',550,10,true,false,'Violini, corde e accessori con luci vive · +10%.'],
 ['shop','shelves','Scaffali e spartiti',240,0,true,false,'Libri, partiture e accessori del negozio.'],
 ['shop','guitars','Collezione di classiche',480,10,true,false,'Due classiche differenti in primo piano · +10%.'],
 ['shop','plants','Piante e rampicanti',85,0,false,false,'Foglie sulle mensole e accanto alle chitarre.'],
 ['shop','art','Quadri del negozio',75,0,false,false,'Tre illustrazioni musicali originali.'],
 ['rehearsal','drums','Batteria della sala',0,0,true,true,'La batteria con piatti è inclusa con la sala.'],
 ['rehearsal','rug','Tappeti da sala prove',0,0,false,true,'Due tappeti caldi sotto gli strumenti.'],
 ['rehearsal','keys','Pianoforte della sala',360,5,true,false,'Tastiera, seduta e piccola lampada · +5%.'],
 ['rehearsal','amps','Amplificatori',480,10,true,false,'Stack di amplificatori con spie animate · +10%.'],
 ['rehearsal','bass','Basso elettrico',560,10,true,false,'Un basso sul suo supporto · +10%.'],
 ['rehearsal','pedals','Pedalboard e microfono',290,0,true,false,'Pedali colorati, cavi e microfono.'],
 ['rehearsal','cases','Custodie da tournée',170,0,false,false,'Custodie e flight case originali.'],
 ['rehearsal','plants','Piante della sala',95,0,false,false,'Verde tra mattoni e pannelli acustici.'],
 ['rehearsal','art','Poster musicali',90,0,false,false,'I tre poster originali della sala.'],
 ['stage','mic','Microfono e leggio',0,0,true,true,'La postazione per il concerto è inclusa.'],
 ['stage','lights','Luci del proscenio',0,0,false,true,'Piccole luci calde al bordo del palco.'],
 ['stage','piano','Pianoforte a coda',950,10,true,false,'Il pianoforte da concerto · +10%.'],
 ['stage','amp','Amplificatore del palco',620,10,true,false,'Un amplificatore per il tuo concerto · +10%.'],
 ['stage','guitar','Classica da concerto',780,10,true,false,'Una seconda classica in noce · +10%.'],
 ['stage','wedges','Monitor da palco',450,5,true,false,'Due monitor con cavi originali · +5%.'],
];
for(const [map,id,name,price,bonus,required,included,description] of extras)ITEMS.push({id:`${map}:${id}`,map,name,price,bonus,required,included,description});
export const itemsForMap=(map:MapId)=>ITEMS.filter(i=>(i.map??'home')===map);
export function mapUnlocked(p:PixelState,map:MapId):boolean {const index=MAPS.findIndex(m=>m.id===map);return index===0||(index>0&&mapUnlocked(p,MAPS[index-1].id)&&completed(p,MAPS[index-1].id));}
export function ownedOnMap(p:PixelState,map:MapId):string[]{return [...new Set([...p.owned,...(mapUnlocked(p,map)?itemsForMap(map).filter(i=>i.included).map(i=>i.id):[])])];}
export function selectMap(p:PixelState,map:MapId):PixelState {return !p.session&&mapUnlocked(p,map)?{...p,mapId:map}:p;}
export interface PixelSession { id:string; mapId:MapId; songId:string; title:string; startedAt:number; activeMs:number; checkpoint:number|null; earnedCents:number; bonus:number; status:'running'|'paused'; }
export interface Receipt { id:string; songId:string; title:string; startedAt:number; activeMs:number; earnedCents:number; bonus:number; recorded?:boolean; }
export interface PixelState { version:1; mapId:MapId; balanceCents:number; owned:string[]; session:PixelSession|null; receipts:Receipt[]; totalMs:number; totalEarnedCents:number; lampOn:boolean; deskLightOn:boolean; fireOn:boolean; rainOn:boolean; }
export const initialPixel = ():PixelState => ({version:1,mapId:'home',balanceCents:0,owned:[],session:null,receipts:[],totalMs:0,totalEarnedCents:0,lampOn:true,deskLightOn:true,fireOn:true,rainOn:true});
export const bonusFor = (owned:string[]) => Math.min(150, ITEMS.filter(i=>owned.includes(i.id)).reduce((s,i)=>s+i.bonus,0));
export const completed = (p:PixelState,map:MapId='home') => itemsForMap(map).filter(i=>i.required).every(i=>ownedOnMap(p,map).includes(i.id));
export const earnings = (ms:number,bonus:number) => Math.floor(ms * (100 + bonus) / 60000);
export function tick(p:PixelState,now:number):PixelState {
  const s=p.session;
  if (!s || s.status!=='running' || s.checkpoint===null) return p;
  const dt=Math.max(0,now-s.checkpoint);
  const activeMs=s.activeMs+dt;
  const earnedCents=earnings(activeMs,s.bonus);
  const delta=earnedCents-s.earnedCents;
  return {...p,balanceCents:p.balanceCents+delta,totalMs:p.totalMs+dt,totalEarnedCents:p.totalEarnedCents+delta,session:{...s,activeMs,checkpoint:now,earnedCents}};
}
export function begin(p:PixelState,songId:string,title:string,now:number,id:string):PixelState {
  if(p.session) return p;
  return {...p,session:{id,mapId:p.mapId,songId,title,startedAt:now,activeMs:0,checkpoint:now,earnedCents:0,bonus:bonusFor(p.owned),status:'running'}};
}
export function pause(p:PixelState,now:number):PixelState {const n=tick(p,now);return n.session?{...n,session:{...n.session,status:'paused',checkpoint:null}}:n;}
export function resume(p:PixelState,now:number):PixelState {return p.session?.status==='paused'?{...p,session:{...p.session,status:'running',checkpoint:now}}:p;}
export function finish(p:PixelState,now:number):PixelState {
  const n=tick(p,now);if(!n.session)return n;
  const {id,songId,title,startedAt,activeMs,earnedCents,bonus}=n.session;
  return {...n,session:null,receipts:[{id,songId,title,startedAt,activeMs,earnedCents,bonus},...n.receipts].slice(0,200)};
}
export function buy(p:PixelState,id:string):PixelState {
  const item=ITEMS.find(i=>i.id===id);
  if(!item||!mapUnlocked(p,item.map??'home')||item.included||p.owned.includes(id)||p.balanceCents<item.price*100)return p;
  return {...p,balanceCents:p.balanceCents-item.price*100,owned:[...p.owned,id]};
}
export function recover(raw:unknown):PixelState {
  const p=raw as Partial<PixelState>|null;
  if(!p || p.version!==1)return initialPixel();
  const sane=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  if(!sane(p.balanceCents)||!Array.isArray(p.owned)||!Array.isArray(p.receipts))return initialPixel();
  const n={...initialPixel(),...p,owned:[...new Set(p.owned.filter(id=>ITEMS.some(i=>i.id===id)))]} as PixelState;
  if(!MAPS.some(m=>m.id===n.mapId)||!mapUnlocked(n,n.mapId))n.mapId='home';
  if(n.session) {
    n.session.mapId=MAPS.some(m=>m.id===n.session?.mapId)&&mapUnlocked(n,n.session.mapId)?n.session.mapId:'home';
    n.mapId=n.session.mapId;
    if(!sane(n.session.activeMs)||!sane(n.session.earnedCents)||!sane(n.session.bonus)||!n.session.id||!n.session.songId)n.session=null;
    else n.session={...n.session,status:'paused',checkpoint:null};
  }
  n.receipts=n.receipts.filter(r=>r&&r.id&&r.songId&&sane(r.activeMs)&&sane(r.earnedCents));
  return n;
}
export function clock(ms:number) {const s=Math.floor(ms/1000);return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');}
export const money=(cents:number)=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(cents/100);
