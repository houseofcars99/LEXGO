import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { LayoutDashboard, BriefcaseBusiness, Users, ListTodo, CalendarDays, FileText, BrainCircuit, Receipt, Link2, Settings, LogOut, Plus, ShieldCheck, RefreshCcw, AlertTriangle, Search, Check, Clock3 } from 'lucide-react';
import './saas.css';
import ClientsWorkspace from './ClientsWorkspace.jsx';
import DocumentsWorkspace from './DocumentsWorkspace.jsx';
import LexgoAIWorkspace from './LexgoAIWorkspace.jsx';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const db = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const MENU = [
  ['dashboard','Pulpit',LayoutDashboard],['cases','Sprawy',BriefcaseBusiness],['clients','Klienci',Users],
  ['tasks','Zadania',ListTodo],['deadlines','Terminy',CalendarDays],['documents','Dokumenty',FileText],
  ['ai','LEXGO AI',BrainCircuit],['billing','Rozliczenia',Receipt],['integrations','Integracje',Link2],['settings','Ustawienia',Settings]
];
const EMPTY = {cases:[],tasks:[],deadlines:[],members:[],clients:[],crmReady:false};
const words = v => String(v ?? '').trim();
const nice = v => v ? new Date(v + 'T12:00:00').toLocaleDateString('pl-PL') : '—';

function App() {
  const [session,setSession] = useState(null), [authReady,setAuthReady]=useState(false);
  const [orgs,setOrgs]=useState([]), [orgId,setOrgId]=useState('');
  const [data,setData]=useState(EMPTY), [tab,setTab]=useState('dashboard');
  const [busy,setBusy]=useState(false), [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState(''), [error,setError]=useState(''), [search,setSearch]=useState('');
  const [form,setForm]=useState('');
  const [currentCase,setCurrentCase]=useState('');
  const selectedOrg=orgs.find(x=>x.id===orgId);
  const admin=data.members.some(m=>m.user_id===session?.user?.id&&m.role==='admin');
  const casesFiltered=data.cases.filter(x=>(x.title+' '+x.case_number+' '+x.client_name).toLowerCase().includes(search.toLowerCase()));
  const clients=useMemo(()=>Array.from(new Set(data.cases.map(x=>words(x.client_name)).filter(Boolean))),[data.cases]);
  const openTasks=data.tasks.filter(t=>t.status!=='done');
  const unverified=data.deadlines.filter(d=>d.review_status!=='confirmed');
  const byCase=id=>data.cases.find(c=>c.id===id);
  function clear(){setNotice('');setError('');}
  async function ensure(response){if(response.error)throw response.error;return response.data;}
  async function execute(job,ok) {setBusy(true);clear();try{await job();setForm('');if(ok)setNotice(ok);}catch(e){setError(e.message||'Nie udało się wykonać operacji.');}finally{setBusy(false);}}
  useEffect(()=>{
    if(!db){setAuthReady(true);return;}
    let active=true;
    db.auth.getSession().then(({data,error})=>{if(!active)return;if(error)setError(error.message);setSession(data?.session||null);setAuthReady(true);}).catch(e=>{if(active){setError(e.message);setAuthReady(true);}});
    const {data:s}=db.auth.onAuthStateChange((_event,value)=>setSession(value));
    return()=>{active=false;s.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    if(!db||!session){setOrgs([]);setOrgId('');setData(EMPTY);return;}
    let active=true;
    db.from('organizations').select('id,name').order('created_at').then(({data:rows,error:e})=>{
      if(!active)return;if(e){setError(e.message);return;}
      setOrgs(rows||[]);setOrgId(old=>(rows||[]).some(x=>x.id===old)?old:rows?.[0]?.id||'');
    });
    return()=>{active=false};
  },[session?.user?.id]);
  async function refresh() {
    if(!db||!orgId)return;
    setLoading(true);
    try{
      const [c,t,d,m]=await Promise.all([
        db.from('cases').select('id,title,case_number,client_name,organization_id').eq('organization_id',orgId).order('created_at',{ascending:false}),
        db.from('tasks').select('id,title,status,due_on,case_id,organization_id,assignee_id').eq('organization_id',orgId).order('created_at',{ascending:false}),
        db.from('deadlines').select('id,title,due_on,received_on,review_status,case_id,organization_id,source_note').eq('organization_id',orgId).order('due_on'),
        db.from('memberships').select('user_id,role').eq('organization_id',orgId)
      ]);
      const values=[c,t,d,m].map(x=>{if(x.error)throw x.error;return x.data||[];});
            const currentAdmin = values[3].some(m => m.user_id === session?.user?.id && m.role === 'admin');
      let clientRecords = [], crmReady = false, casesData = values[0];
      if (currentAdmin) {
        const crmResult = await db.from('clients')
          .select('id,organization_id,kind,display_name,email,phone,tax_id')
          .eq('organization_id',orgId).order('display_name');
        if (!crmResult.error) {
          crmReady = true;
          clientRecords = crmResult.data || [];
          const linked = await db.from('cases').select('id,client_id').eq('organization_id',orgId);
          if (!linked.error) {
            const links = new Map((linked.data || []).map(c => [c.id,c.client_id]));
            casesData = values[0].map(c => ({...c,client_id:links.get(c.id)||null}));
          }
        } else if (!['PGRST205','42P01'].includes(crmResult.error.code)) {
          setError('Nie udało się pobrać kartotek: ' + crmResult.error.message);
        }
      }
      setData({cases:casesData,tasks:values[1],deadlines:values[2],members:values[3],clients:clientRecords,crmReady});
      setCurrentCase(old=>values[0].some(x=>x.id===old)?old:values[0][0]?.id||'');
    }catch(e){setError(e.message||'Błąd odczytu danych.');}finally{setLoading(false);}
  }
  useEffect(()=>{setData(EMPTY);setCurrentCase('');if(orgId)refresh();},[orgId]);
  async function makeOrg(fd){await execute(async()=>{await ensure(await db.rpc('create_organization',{org_name:words(fd.get('name'))}));const rows=await ensure(await db.from('organizations').select('id,name').order('created_at'));setOrgs(rows||[]);setOrgId(rows?.at(-1)?.id||'');},'Utworzono przestrzeń kancelarii.');}
  async function makeCase(fd){await execute(async()=>{
    const clientId = fd.get('client_id') || null;
    const selected = data.clients.find(c => c.id === clientId);
    const payload = {
      organization_id:orgId,
      title:words(fd.get('title')),
      case_number:words(fd.get('number')),
      client_name:selected?.display_name || words(fd.get('client')),
      created_by:session.user.id
    };
    if(selected && data.crmReady) payload.client_id = selected.id;
    await ensure(await db.from('cases').insert(payload));
    await refresh();
  },'Dodano sprawę.');}
  async function makeTask(fd){await execute(async()=>{await ensure(await db.from('tasks').insert({organization_id:orgId,case_id:fd.get('case'),title:words(fd.get('title')),due_on:fd.get('date')||null,created_by:session.user.id,assignee_id:session.user.id}));await refresh();},'Dodano zadanie.');}
  async function makeDeadline(fd){await execute(async()=>{await ensure(await db.from('deadlines').insert({organization_id:orgId,case_id:fd.get('case'),title:words(fd.get('title')),due_on:fd.get('date'),received_on:fd.get('received')||null,source_note:words(fd.get('source')),created_by:session.user.id}));await refresh();},'Dodano termin do weryfikacji.');}
  async function markTask(t){await execute(async()=>{await ensure(await db.from('tasks').update({status:t.status==='done'?'todo':'done'}).eq('id',t.id));await refresh();},'Zmieniono status zadania.');}
  async function confirmDeadline(d){await execute(async()=>{await ensure(await db.from('deadlines').update({review_status:'confirmed',confirmed_by:session.user.id,confirmed_at:new Date().toISOString()}).eq('id',d.id));await refresh();},'Termin oznaczono jako zweryfikowany.');}
  const heading=MENU.find(n=>n[0]===tab)?.[1]||'Pulpit';
  const input=(name,label,placeholder,type='text',required=true)=><label className="lx-label">{label}<input name={name} type={type} required={required} placeholder={placeholder||''}/></label>;
  const caseSelect=<label className="lx-label">Sprawa<select name="case" required defaultValue={currentCase||data.cases[0]?.id||''}>{data.cases.map(c=><option key={c.id} value={c.id}>{c.case_number||c.title}</option>)}</select></label>;
  const onForm=(fn)=>async e=>{e.preventDefault();await fn(new FormData(e.currentTarget));};
  const panels={
    case:<form className="lx-form" onSubmit={onForm(makeCase)}>
      {input('title','Nazwa sprawy','Przedmiot sprawy')}
      {input('number','Sygnatura','I C 123/26','text',false)}
      {data.crmReady && data.clients.length > 0 && <label className="lx-label">Wybierz klienta z kartoteki
        <select name="client_id" defaultValue=""><option value="">— Bez powiązania —</option>
          {data.clients.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}
        </select></label>}
      {input('client','Klient — nazwa tekstowa, jeśli nie wybrano kartoteki','Nazwa klienta','text',false)}
      <button className="lx-btn primary" disabled={busy}>Zapisz sprawę</button>
    </form>,
    task:<form className="lx-form" onSubmit={onForm(makeTask)}>{input('title','Zadanie','Przygotować projekt pisma')}{caseSelect}{input('date','Termin wewnętrzny','','date',false)}<button className="lx-btn primary" disabled={busy}>Zapisz zadanie</button></form>,
    deadline:<form className="lx-form" onSubmit={onForm(makeDeadline)}>{input('title','Czynność procesowa','Zażalenie')}{caseSelect}{input('received','Data doręczenia','','date',false)}{input('date','Termin końcowy','','date')}{input('source','Źródło terminu','Karta akt i fragment zarządzenia','text',false)}<p className="lx-muted">System nie wyznacza terminów automatycznie. Zweryfikuj datę przed zatwierdzeniem.</p><button className="lx-btn primary" disabled={busy}>Zapisz do weryfikacji</button></form>
  };
  if(!authReady)return <div className="lx-loading">LEXGO · Ładowanie…</div>;
  if(!db)return <div className="lx-loading"><h1>LEXGO</h1><p>Brak połączenia z Supabase.</p><code>VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY</code><p>Nie wprowadzaj danych klientów. Skonfiguruj środowisko testowe.</p></div>;
  if(!session)return <Auth db={db}/>;
  return <div className="lx-shell">
    <aside className="lx-side">
      <div className="lx-brand"><span>§</span><div>LEXGO<small>KANCELARIA OS</small></div></div>
      <div className="lx-org"><small>AKTYWNA KANCELARIA</small><select aria-label="Wybierz kancelarię" value={orgId} onChange={e=>{clear();setOrgId(e.target.value)}}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
      <div className="lx-navlabel">PRZESTRZEŃ ROBOCZA</div><nav>{MENU.map(([key,label,Icon])=><button key={key} className={'lx-nav '+(tab===key?'current':'')} onClick={()=>{clear();setSearch('');setForm('');setTab(key)}}><Icon size={18}/>{label}</button>)}</nav>
      <div className="lx-sidefoot"><small>{session.user.email}</small><button onClick={()=>db.auth.signOut()}><LogOut size={15}/> Wyloguj</button></div>
    </aside>
    <main className="lx-main">
      <div className="lx-top"><span>LEXGO / <b>{heading}</b></span><div><span className="lx-tag">ALPHA · ŚRODOWISKO TESTOWE</span><ShieldCheck size={17}/></div></div>
      <div className="lx-content">
        <div className="lx-heading"><div><div className="lx-overline">PANEL KANCELARII</div><h1>{heading}</h1><p>{selectedOrg?.name||'Utwórz pierwszą kancelarię'}</p></div><button className="lx-btn" onClick={refresh} disabled={!orgId||loading}><RefreshCcw size={15}/> Odśwież</button></div>
        <div className="lx-alert"><AlertTriangle size={17}/><span><b>Wersja testowa.</b> Nie przechowuj rzeczywistych akt ani danych klientów przed audytem bezpieczeństwa. KSeF, PI i AI nie są jeszcze zintegrowane.</span></div>
        {error&&<div className="lx-error" role="alert">{error}</div>}{notice&&<div className="lx-success" role="status">{notice}</div>}
        {!orgs.length?<div className="lx-card lx-first"><h2>Utwórz przestrzeń kancelarii</h2><p>Przestrzeń jest powiązana z Twoim kontem Supabase. Nie używaj jeszcze rzeczywistych danych.</p><form className="lx-form" onSubmit={onForm(makeOrg)}>{input('name','Nazwa kancelarii','Kancelaria testowa')}<button className="lx-btn primary" disabled={busy}>Utwórz kancelarię</button></form></div>:<>
          {tab==='dashboard'&&<>
            <div className="lx-metrics">{[['Sprawy',data.cases.length,'Widoczne dla konta'],['Klienci',data.crmReady?data.clients.length:clients.length,'W kartotece / sprawach'],['Otwarte zadania',openTasks.length,'Wymagają działania'],['Terminy do weryfikacji',unverified.length,'Bez automatycznego liczenia']].map(([label,note,hint])=><div className="lx-metric" key={label}><small>{label}</small><strong>{note}</strong><span>{hint}</span></div>)}</div>
            <div className="lx-grid"><section className="lx-card"><div className="lx-cardhead"><h2>Ostatnie sprawy</h2><button onClick={()=>setTab('cases')}>Wszystkie</button></div>{data.cases.slice(0,6).map(c=><div className="lx-row" key={c.id}><div><b>{c.title}</b><small>{c.case_number||'Bez sygnatury'} · {c.client_name||'Bez klienta'}</small></div><span className="lx-badge">Sprawa</span></div>)}{!data.cases.length&&<p className="lx-empty">Brak spraw. Dodaj pierwszą w module Sprawy.</p>}</section>
            <section className="lx-card"><div className="lx-cardhead"><h2>Do zrobienia</h2><button onClick={()=>setTab('tasks')}>Zadania</button></div>{openTasks.slice(0,6).map(t=><div className="lx-row" key={t.id}><div><b>{t.title}</b><small>{nice(t.due_on)} · {byCase(t.case_id)?.case_number||'Sprawa'}</small></div><Clock3 size={17}/></div>)}{!openTasks.length&&<p className="lx-empty">Brak otwartych zadań.</p>}</section></div>
          </>}
          {tab==='cases'&&<section className="lx-card"><div className="lx-cardhead"><h2>Rejestr spraw</h2>{admin&&<button className="lx-btn primary" onClick={()=>setForm('case')}><Plus size={15}/> Dodaj sprawę</button>}</div><div className="lx-search"><Search size={17}/><input placeholder="Szukaj po sygnaturze, kliencie lub przedmiocie" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="lx-table"><table><thead><tr><th>Sygnatura</th><th>Przedmiot</th><th>Klient</th></tr></thead><tbody>{casesFiltered.map(c=><tr key={c.id}><td>{c.case_number||'—'}</td><td>{c.title}</td><td>{c.client_name||'—'}</td></tr>)}</tbody></table></div>{!casesFiltered.length&&<p className="lx-empty">Brak spraw pasujących do wyszukiwania.</p>}</section>}
          {tab==='clients'&&<ClientsWorkspace
            db={db} orgId={orgId} records={data.clients} cases={data.cases}
            canManage={admin} crmReady={data.crmReady} onReload={refresh}
            onError={setError} onSuccess={setNotice}/>}
          
          {tab==='tasks'&&<section className="lx-card"><div className="lx-cardhead"><h2>Zadania</h2><button className="lx-btn primary" disabled={!data.cases.length} onClick={()=>setForm('task')}><Plus size={15}/> Dodaj zadanie</button></div>{data.tasks.map(t=><div className="lx-row" key={t.id}><div><b className={t.status==='done'?'lx-done':''}>{t.title}</b><small>{byCase(t.case_id)?.case_number||'Sprawa'} · {nice(t.due_on)}</small></div><button className="lx-btn small" disabled={busy} onClick={()=>markTask(t)}>{t.status==='done'?<><Check size={14}/> Wykonane</>:'Oznacz wykonanie'}</button></div>)}{!data.tasks.length&&<p className="lx-empty">Brak zadań w dostępnych sprawach.</p>}</section>}
          {tab==='deadlines'&&<section className="lx-card"><div className="lx-cardhead"><h2>Terminy procesowe</h2><button className="lx-btn primary" disabled={!data.cases.length} onClick={()=>setForm('deadline')}><Plus size={15}/> Dodaj termin</button></div>{data.deadlines.map(d=><div className="lx-row" key={d.id}><div><b>{d.title}</b><small>Do {nice(d.due_on)} · doręczenie: {nice(d.received_on)} · {byCase(d.case_id)?.case_number||'Sprawa'}</small></div>{d.review_status==='confirmed'?<span className="lx-badge green">Zatwierdzony</span>:<button className="lx-btn small" disabled={busy} onClick={()=>confirmDeadline(d)}>Zatwierdź</button>}</div>)}{!data.deadlines.length&&<p className="lx-empty">Brak terminów. Wprowadź termin ręcznie po sprawdzeniu dokumentów.</p>}</section>}
          {tab==='documents'&&<DocumentsWorkspace db={db} orgId={orgId} cases={data.cases} userId={session.user.id}/>}
          {tab==='ai'&&<LexgoAIWorkspace db={db} orgId={orgId} cases={data.cases} userId={session.user.id}/>}
          {['billing','integrations','settings'].includes(tab)&&<Feature tab={tab} org={selectedOrg?.name} />}
        </>}
        <p className="lx-footer">LEXGO SaaS Alpha · Bez połączeń KSeF, PI ani zewnętrznego AI · Projekt nieprzeznaczony do danych rzeczywistych.</p>
      </div>
    </main>
    {form&&<div className="lx-backdrop" onClick={e=>{if(e.target===e.currentTarget)setForm('')}}><section className="lx-modal"><div className="lx-cardhead"><h2>{form==='case'?'Nowa sprawa':form==='task'?'Nowe zadanie':'Nowy termin'}</h2><button className="lx-btn" onClick={()=>setForm('')}>Zamknij</button></div><div className="lx-modalbody">{panels[form]}</div></section></div>}
  </div>;
}
function Feature({tab,org}){
  const entries={
    documents:['Dokumenty i akta','Prywatny magazyn plików z uprawnieniami RLS, historią wersji i skanowaniem dokumentów. Przesyłanie plików jest obecnie wyłączone.'],
    ai:['LEXGO Legal Writer','Plan: analiza akt → research ELI/SAOS → strategia procesowa → projekt pisma → kontrola źródeł → zatwierdzenie. Bez podłączenia modelu AI.'],
    billing:['Rozliczenia i faktury','Docelowo: rejestr wynagrodzeń, zestawienie faktur, KSeF TEST i pakiety abonamentowe. Wystawianie rzeczywistych faktur jest wyłączone.'],
    integrations:['Integracje','KSeF 2.0 · Portal Informacyjny Sądów Powszechnych · ELI/SAOS · poczta · kalendarze. Połączenia wymagają osobnych autoryzacji i testów.'],
    settings:['Ustawienia i bezpieczeństwo','Aktualne role wynikają z Supabase. Przed produkcją wymagane są audyt RLS, MFA, polityki Storage, historia operacji i testy odtwarzania kopii.']
  };
  let [title,desc]=entries[tab];
  return <section className="lx-card lx-feature"><span className="lx-overline">MODUŁ W PRZYGOTOWANIU</span><h2>{title}</h2><p>{desc}</p><div className="lx-featurestatus"><AlertTriangle size={17}/> Bez połączenia produkcyjnego. Dane kancelarii: {org||'—'}.</div></section>;
}
function Auth({db}){
  const [register,setRegister]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[pendingEmail,setPendingEmail]=useState('');
  async function submit(e){
    e.preventDefault();setBusy(true);setError('');setMessage('');
    const fd=new FormData(e.currentTarget);
    const email=String(fd.get('email')||'').trim();
    const credentials={email,password:fd.get('password')};
    try{
      const response=register
        ? await db.auth.signUp({...credentials,options:{emailRedirectTo:window.location.origin}})
        : await db.auth.signInWithPassword(credentials);
      if(response.error)throw response.error;
      if(register){
        if(response.data?.session){
          setPendingEmail('');
          setMessage('Konto utworzone i sesja została uruchomiona. Przechodzę do panelu.');
        }else{
          setPendingEmail(email);
          setMessage('Supabase przyjął żądanie rejestracji, ale LEXGO nie ma potwierdzenia dostarczenia wiadomości. Jeżeli weryfikacja e-mail jest włączona, sprawdź Odebrane, Spam i Oferty. Gdy konto już istnieje, spróbuj zwykłego logowania.');
        }
      }
    }catch(e){setError(e.message||'Błąd uwierzytelnienia.');}finally{setBusy(false);}
  }
  async function resendConfirmation(){
    if(!pendingEmail||busy)return;
    setBusy(true);setError('');setMessage('');
    try{
      const response=await db.auth.resend({type:'signup',email:pendingEmail,options:{emailRedirectTo:window.location.origin}});
      if(response.error)throw response.error;
      setMessage('Supabase przyjął żądanie ponowienia wiadomości. To nie potwierdza dostarczenia e-maila. Sprawdź folder Spam. Ponawiaj tylko w razie potrzeby ze względu na limity wysyłki.');
    }catch(e){setError(e.message||'Nie udało się ponowić żądania wiadomości.');}finally{setBusy(false);}
  }
  return <div className="lx-auth"><div className="lx-authleft"><div className="lx-brand"><span>§</span><div>LEXGO<small>KANCELARIA OS</small></div></div><h1>Wszystkie sprawy.<br/>Jedna przestrzeń.</h1><p>CRM, terminy, dokumenty i narzędzia AI dla kancelarii. Trwa budowa wersji SaaS.</p></div><div className="lx-authright"><div className="lx-authbox"><span className="lx-overline">DOSTĘP TESTOWY</span><h2>{register?'Rejestracja':'Zaloguj się'}</h2><div className="lx-alert"><AlertTriangle size={17}/> Wyłącznie dane testowe. Nie wprowadzaj prawdziwych akt.</div><form className="lx-form" onSubmit={submit}><label className="lx-label">E-mail<input type="email" name="email" required autoComplete="email"/></label><label className="lx-label">Hasło<input type="password" name="password" minLength={6} required autoComplete={register?'new-password':'current-password'}/></label><button className="lx-btn primary" disabled={busy}>{register?'Utwórz konto':'Zaloguj się'}</button></form>{error&&<p className="lx-error" role="alert">{error}</p>}{message&&<p className="lx-success" role="status">{message}</p>}{register&&pendingEmail&&<button className="lx-btn" style={{marginTop:12}} disabled={busy} onClick={resendConfirmation}>Ponów wiadomość potwierdzającą</button>}<div><button className="lx-textbtn" onClick={()=>{setRegister(!register);setError('');setMessage('');setPendingEmail('');}}>{register?'Mam już konto':'Utwórz konto testowe'}</button></div></div></div></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
