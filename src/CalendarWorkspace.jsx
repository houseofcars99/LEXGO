import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Bell } from 'lucide-react';
import './calendar.css';

const pad = n => String(n).padStart(2,'0');
const iso = d => [d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
const dateOnly = value => new Date(value+'T12:00:00');
const today = () => iso(new Date());
const daysUntil = date => Math.round((dateOnly(date)-dateOnly(today()))/86400000);
const reminderOffsets = [14,7,3,1,0];
export default function CalendarWorkspace({db,orgId,cases,onError}) {
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const [items,setItems]=useState([]);
 const [loading,setLoading]=useState(false);
 const [filter,setFilter]=useState('all');
 const [selected,setSelected]=useState(today());
 const [showAlerts,setShowAlerts]=useState(false);
 useEffect(()=>{
   let active=true;
   setItems([]);
   if(!orgId)return;
   setLoading(true);
   Promise.all([
    db.from('tasks').select('id,title,due_on,status,case_id,assignee_id').eq('organization_id',orgId).not('due_on','is',null),
    db.from('deadlines').select('id,title,due_on,review_status,case_id').eq('organization_id',orgId)
   ]).then(([t,d])=>{
    if(t.error)throw t.error;
    if(d.error)throw d.error;
    if(active)setItems([...(t.data||[]).map(x=>({...x,kind:'task'})),...(d.data||[]).map(x=>({...x,kind:'deadline'}))]);
   }).catch(e=>{if(active)onError(e.message)}).finally(()=>{if(active)setLoading(false)});
   return ()=>{active=false};
 },[db,orgId]);
 const caseNames=useMemo(()=>Object.fromEntries(cases.map(c=>[c.id,c.case_number||c.title])),[cases]);
 const visible=useMemo(()=>items.filter(x=>filter==='all'||x.kind===filter).sort((a,b)=>a.due_on.localeCompare(b.due_on)),[items,filter]);
 const alerts=useMemo(()=>items.filter(x=>{
  if(x.kind==='task'&&x.status==='done')return false;
  const days=daysUntil(x.due_on);
  return days<0||reminderOffsets.includes(days);
 }).sort((a,b)=>a.due_on.localeCompare(b.due_on)),[items]);
 const first=new Date(month.getFullYear(),month.getMonth(),1);
 const start=(first.getDay()+6)%7;
 const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const cells=Array.from({length:Math.ceil((start+count)/7)*7},(_,i)=>{
  const d=i-start+1;
  return d>=1&&d<=count?iso(new Date(month.getFullYear(),month.getMonth(),d)):null;
 });
 const chosen=visible.filter(x=>x.due_on===selected);
 return <section className="calendar-workspace">
  <div className="calendar-toolbar">
   <div><h2><CalendarDays size={21}/> Kalendarz kancelarii</h2><p>Terminy procesowe i wewnętrzne zadania ze spraw, do których masz dostęp.</p></div>
   <button type="button" className="calendar-alert-button" onClick={()=>setShowAlerts(!showAlerts)} aria-expanded={showAlerts}><Bell size={17}/> Przypomnienia ({alerts.length})</button>
  </div>
  {showAlerts&&<div className="calendar-alerts" role="region" aria-label="Przypomnienia">
   <strong>Terminy wymagające uwagi</strong>
   <p>Podgląd w aplikacji, obliczany po otwarciu widoku. E-mail i push wymagają osobnego uruchomienia usługi wysyłkowej.</p>
   {alerts.length?alerts.map(x=><div key={x.kind+x.id}><b>{x.due_on}</b> · {x.title} <small>({caseNames[x.case_id]||'Sprawa'})</small> {daysUntil(x.due_on)<0?'— po terminie':''}</div>):<p>Brak zbliżających się lub zaległych pozycji.</p>}
  </div>}
  <div className="calendar-controls">
   <div className="calendar-month"><button type="button" aria-label="Poprzedni miesiąc" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={19}/></button><strong>{new Intl.DateTimeFormat('pl-PL',{month:'long',year:'numeric'}).format(month)}</strong><button type="button" aria-label="Następny miesiąc" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={19}/></button></div>
   <div><button type="button" onClick={()=>{setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1));setSelected(today())}}>Dzisiaj</button><select aria-label="Rodzaj wydarzeń" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Wszystkie</option><option value="deadline">Terminy procesowe</option><option value="task">Zadania</option></select></div>
  </div>
  <div className="calendar-grid" role="grid" aria-label="Kalendarz miesięczny">
   {['Pon','Wt','Śr','Czw','Pt','Sob','Nd'].map(d=><div className="calendar-weekday" key={d}>{d}</div>)}
   {cells.map((date,i)=><div key={i} className={'calendar-cell'+(!date?' calendar-blank':'')+(date===today()?' calendar-today':'')+(date===selected?' calendar-selected':'')}>
    {date&&<button type="button" aria-label={'Dzień '+date} aria-pressed={date===selected} onClick={()=>setSelected(date)}><span>{Number(date.slice(-2))}</span>{visible.filter(x=>x.due_on===date).slice(0,3).map(x=><small key={x.kind+x.id} className={x.kind==='deadline'?'calendar-deadline':'calendar-task'} title={x.title}>{x.title}</small>)}{visible.filter(x=>x.due_on===date).length>3&&<em>+ więcej</em>}</button>}
   </div>)}
  </div>
  <div className="calendar-day-detail"><h3>{new Intl.DateTimeFormat('pl-PL',{dateStyle:'full'}).format(dateOnly(selected))}</h3>{loading?<p>Wczytywanie…</p>:chosen.length?chosen.map(x=><div key={x.kind+x.id}><span className={x.kind==='deadline'?'calendar-type deadline':'calendar-type'}>{x.kind==='deadline'?'Termin procesowy':'Zadanie'}</span><strong>{x.title}</strong><small>{caseNames[x.case_id]||'Sprawa'}{x.kind==='deadline'&&x.review_status!=='confirmed'?' · wymaga weryfikacji':''}</small></div>):<p>Brak wydarzeń w wybranym dniu.</p>}</div>
 </section>;
}
