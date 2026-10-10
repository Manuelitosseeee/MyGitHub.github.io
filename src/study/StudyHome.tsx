import {useEffect,useState} from 'react';
import {CalendarDays,ChevronRight,Check} from 'lucide-react';
import {store,useStore} from '../data/store';
import {useNav} from '../nav';
import {Card,SectionTitle} from '../ui/primitives';
import {ALL_DAYS,dayKey,dayDiff,weekday,plan,bestFor,resultToday,PATHS} from './planner';
import {Calendar} from './calendar';
export function StudyHome(){
 const st=useStore(),nav=useNav(),[calendar,setCalendar]=useState(false),[date,setDate]=useState(dayKey());
 useEffect(()=>{const t=setInterval(()=>setDate(dayKey()),30000);return()=>clearInterval(t)},[]);
 const days=st.settings.studyDays??ALL_DAYS,rest=!days.includes(weekday(date));
 useEffect(()=>{if(!rest)for(const m of st.milestones)if(m.songId)store.todayGoal(m.songId)},[date,st.milestones,st.songs,days,rest]);
 const sort=st.settings.studySort??'deadline';
 const rows=st.songs.map(song=>{const m=st.milestones.find(m=>m.songId===song.id);const p=m&&song.goalBpm!==null?plan(m,song.goalBpm,bestFor(song.id,st.studyResults),days,date):null;const goal=st.dailyGoals.find(g=>g.songId===song.id&&g.date===date);return{song,m,p,goal,done:!!goal&&resultToday(song.id,st.studyResults,date)>=goal.target}});
 const planned=rows.filter(r=>r.m&&r.p).sort((a,b)=>sort==='deadline'?a.m!.date.localeCompare(b.m!.date):PATHS[b.m!.path].pace-PATHS[a.m!.path].pace||a.m!.date.localeCompare(b.m!.date));
 const free=rows.filter(r=>!r.m||!r.p),count=planned.filter(r=>r.goal).length,done=planned.filter(r=>r.done).length;
 return <><SectionTitle>La tua sessione di oggi</SectionTitle><Card className="card-pad smart-study"><div className="smart-toolbar"><span>{rest?'Giorno di riposo':`${done}/${count} brani completati`}</span><button className="btn btn-soft btn-sm" onClick={()=>setCalendar(true)}><CalendarDays size={16}/>Calendario</button><label className="smart-sort">Ordina<select aria-label="Ordina" value={sort} onChange={e=>store.updateSettings({studySort:e.target.value as 'deadline'|'difficulty'})}><option value="deadline">Per scadenza</option><option value="difficulty">Per difficoltà</option></select></label></div>{rest&&<p className="row-sub">Nessun obbligo oggi. Puoi comunque studiare liberamente.</p>}{planned.map(({song,m,p,goal,done})=>{const tone=sort==='difficulty'?(m!.path==='impegnativo'?'red':m!.path==='medio'?'amber':'green'):(dayDiff(date,m!.date)<=7?'red':dayDiff(date,m!.date)<=30?'amber':'green');return <button key={song.id} className={`smart-song smart-${tone}`} onClick={()=>nav.openSong(song.id)}><div><b>{song.title}</b><span>{PATHS[m!.path].label} · {goal?`${goal.from} → ${goal.target} BPM`:p!.complete?'Obiettivo finale raggiunto':rest?'Studio libero':'Scadenza da aggiornare'}</span><small>Scadenza {new Date(m!.date+'T12:00:00').toLocaleDateString('it-IT')}{p!.warning?' · Piano da adattare':''}</small></div>{done?<Check size={19}/>:<ChevronRight size={18}/>}</button>})}{free.length>0&&<div className="smart-free"><p className="row-sub">Senza scadenza · Studio libero</p>{free.map(({song})=><button key={song.id} className="smart-song" onClick={()=>nav.openSong(song.id)}><b>{song.title}</b><ChevronRight size={18}/></button>)}</div>}{!rows.length&&<p className="row-sub">Aggiungi un brano in Studio e programma il tuo primo traguardo.</p>}</Card><Calendar open={calendar} onClose={()=>setCalendar(false)}/></>;
}
