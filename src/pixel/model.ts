export const PIXEL_KEY = 'mygithub.pixel-story.v1';
export interface Item { id: string; name: string; price: number; bonus: number; required: boolean; tile?: number; description: string; }
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
export interface PixelSession { id:string; songId:string; title:string; startedAt:number; activeMs:number; checkpoint:number|null; earnedCents:number; bonus:number; status:'running'|'paused'; }
export interface Receipt { id:string; songId:string; title:string; startedAt:number; activeMs:number; earnedCents:number; bonus:number; recorded?:boolean; }
export interface PixelState { version:1; balanceCents:number; owned:string[]; session:PixelSession|null; receipts:Receipt[]; totalMs:number; totalEarnedCents:number; lampOn:boolean; deskLightOn:boolean; fireOn:boolean; rainOn:boolean; }
export const initialPixel = ():PixelState => ({version:1,balanceCents:0,owned:[],session:null,receipts:[],totalMs:0,totalEarnedCents:0,lampOn:true,deskLightOn:true,fireOn:true,rainOn:true});
export const bonusFor = (owned:string[]) => Math.min(50, ITEMS.filter(i=>owned.includes(i.id)).reduce((s,i)=>s+i.bonus,0));
export const completed = (p:PixelState) => ITEMS.filter(i=>i.required).every(i=>p.owned.includes(i.id));
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
  return {...p,session:{id,songId,title,startedAt:now,activeMs:0,checkpoint:now,earnedCents:0,bonus:bonusFor(p.owned),status:'running'}};
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
  if(!item||p.owned.includes(id)||p.balanceCents<item.price*100)return p;
  return {...p,balanceCents:p.balanceCents-item.price*100,owned:[...p.owned,id]};
}
export function recover(raw:unknown):PixelState {
  const p=raw as Partial<PixelState>|null;
  if(!p || p.version!==1)return initialPixel();
  const sane=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  if(!sane(p.balanceCents)||!Array.isArray(p.owned)||!Array.isArray(p.receipts))return initialPixel();
  const n={...initialPixel(),...p,owned:[...new Set(p.owned.filter(id=>ITEMS.some(i=>i.id===id)))]} as PixelState;
  if(n.session) {
    if(!sane(n.session.activeMs)||!sane(n.session.earnedCents)||!sane(n.session.bonus)||!n.session.id||!n.session.songId)n.session=null;
    else n.session={...n.session,status:'paused',checkpoint:null};
  }
  n.receipts=n.receipts.filter(r=>r&&r.id&&r.songId&&sane(r.activeMs)&&sane(r.earnedCents));
  return n;
}
export function clock(ms:number) {const s=Math.floor(ms/1000);return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');}
export const money=(cents:number)=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(cents/100);
