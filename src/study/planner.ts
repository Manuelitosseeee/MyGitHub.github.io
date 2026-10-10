export type Path = 'relax' | 'medio' | 'impegnativo';
export interface Milestone {id:string; date:string; title:string; songId:string|null; tempoGoal?:boolean; startBpm:number; path:Path; createdAt:number}
export interface StudyResult {id:string;songId:string;date:string;bpm:number;seconds:number;at:number}
export interface DailyGoal {id:string;songId:string;date:string;from:number;target:number;path:Path}
export const PATHS:Record<Path,{label:string;pace:number;early:number}>={relax:{label:'Relax',pace:1,early:0},medio:{label:'Medio',pace:5,early:10},impegnativo:{label:'Impegnativo',pace:15,early:30}};
export const ALL_DAYS=[0,1,2,3,4,5,6];
export const dayKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function shiftDay(key:string,n:number){const d=new Date(`${key}T12:00:00`);d.setDate(d.getDate()+n);return dayKey(d);}
export function weekday(key:string){return new Date(`${key}T12:00:00`).getDay();}
export function dayDiff(a:string,b:string){return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);}
export function studyDates(from:string,to:string,days:number[]){const out:string[]=[];for(let d=from;d<=to&&out.length<3660&&dayDiff(from,d)<3660;d=shiftDay(d,1))if(days.includes(weekday(d)))out.push(d);return out;}
export function plan(m:Milestone,final:number,best:number,days:number[],today=dayKey()){
 const suggestion=()=>studyDates(today,shiftDay(today,2000),days)[Math.max(0,Math.ceil(Math.max(0,final-Math.max(m.startBpm,best))/PATHS[m.path].pace)-1)]??null;
 const from=Math.max(m.startBpm,best),remaining=Math.max(0,final-from),cfg=PATHS[m.path],available=studyDates(today,m.date,days);
 if(!remaining)return {suggestedDate:null,from,target:final,completion:today,increment:0,warning:'',alternative:null as Path|null,complete:true,scheduled:days.includes(weekday(today))};
 if(!available.length)return {suggestedDate:suggestion(),from,target:from,completion:null,increment:0,warning:days.length?'Scadenza trascorsa o nessun giorno di studio disponibile: sposta la scadenza.':'Seleziona almeno un giorno di studio.',alternative:null as Path|null,complete:false,scheduled:false};
 const before=studyDates(today,shiftDay(m.date,-cfg.early),days);
 const sessions=m.path==='relax'?available.length:Math.min(Math.ceil(remaining/cfg.pace),Math.max(1,before.length||available.length));
 const increment=m.path==='relax'?Math.floor(remaining/sessions):Math.ceil(remaining/sessions),target=Math.min(final,from+increment);
 const alternative=increment>cfg.pace?((Object.keys(PATHS) as Path[]).find(p=>PATHS[p].pace>=increment&&PATHS[p].pace>cfg.pace)??null):null;
 const warning=increment>cfg.pace?`Servono circa +${increment} BPM per giorno di studio, oltre i +${cfg.pace} indicativi.${alternative?` Prova il percorso ${PATHS[alternative].label}.`:' Sposta la scadenza o aggiungi giorni di studio.'}`:cfg.early&&before.length<Math.ceil(remaining/cfg.pace)?`Anticipo di ${cfg.early} giorni non disponibile: completamento entro la scadenza.`:'';
 return {suggestedDate:increment>cfg.pace?suggestion():null,from,target:days.includes(weekday(today))?target:from,completion:available[sessions-1],increment,warning,alternative,complete:false,scheduled:days.includes(weekday(today))};
}
export function bestFor(songId:string,results:StudyResult[]){return Math.max(0,...results.filter(r=>r.songId===songId).map(r=>r.bpm));}
export function resultToday(songId:string,results:StudyResult[],date=dayKey()){return Math.max(0,...results.filter(r=>r.songId===songId&&r.date===date).map(r=>r.bpm));}
