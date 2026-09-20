import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { BriefcaseBusiness, CalendarDays, Check, CirclePlus, LogOut, ShieldCheck } from 'lucide-react';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const db = url && key ? createClient(url, key) : null;

function App() {
  const [session, setSession] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [orgId, setOrgId] = useState('');
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [tasks, setTasks] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('tasks');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = db.auth.onAuthStateChange((_event, value) => setSession(value));
    return () => subscription.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) loadOrganizations(); else { setOrganizations([]); setOrgId(''); } }, [session?.user.id]);
  useEffect(() => { if (orgId) loadCases(); else setCases([]); }, [orgId]);
  useEffect(() => { if (selectedCase) loadCaseData(); else { setTasks([]); setDeadlines([]); } }, [selectedCase]);

  async function run(operation, success) {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); if (success) setNotice(success); }
    catch (e) { setError(e.message || 'Nie udało się zapisać zmian.'); }
    finally { setBusy(false); }
  }
  function result({ data, error: queryError }) { if (queryError) throw queryError; return data; }
  async function loadOrganizations() {
    try {
      const rows = result(await db.from('organizations').select('id,name').order('created_at')) || [];
      setOrganizations(rows); setOrgId(old => rows.some(x => x.id === old) ? old : (rows[0]?.id || ''));
    } catch (e) { setError(e.message); }
  }
  async function loadCases() {
    try {
      const [c, m] = await Promise.all([
        db.from('cases').select('id,title,case_number,client_name,organization_id').eq('organization_id', orgId).order('created_at', { ascending:false }),
        db.from('memberships').select('user_id,role').eq('organization_id', orgId)
      ]);
      const rows = result(c) || []; setMembers(result(m) || []); setCases(rows);
      setSelectedCase(old => rows.some(x => x.id === old) ? old : (rows[0]?.id || ''));
    } catch (e) { setError(e.message); }
  }
  async function loadCaseData() {
    try {
      const [t, d] = await Promise.all([
        db.from('tasks').select('*').eq('case_id', selectedCase).order('created_at', { ascending:false }),
        db.from('deadlines').select('*').eq('case_id', selectedCase).order('due_on')
      ]);
      setTasks(result(t) || []); setDeadlines(result(d) || []);
    } catch (e) { setError(e.message); }
  }
  const currentCase = cases.find(c => c.id === selectedCase);
  const isAdmin = members.some(m => m.user_id === session?.user.id && m.role === 'admin');
  const counts = useMemo(() => ({ todo:tasks.filter(t => t.status === 'todo').length, doing:tasks.filter(t => t.status === 'doing').length, done:tasks.filter(t => t.status === 'done').length }), [tasks]);

  if (!db) return <div className="setup"><h1>LEXGO</h1><p>Skonfiguruj połączenie z osobnym projektem Supabase, aby uruchomić aplikację.</p><code>VITE_SUPABASE_URL · VITE_SUPABASE_PUBLISHABLE_KEY</code></div>;
  if (!session) return <Auth />;

  async function addOrganization(form) {
    await run(async () => {
      result(await db.rpc('create_organization', { org_name: form.get('name') }));
      await loadOrganizations();
    }, 'Kancelaria została utworzona.');
  }
  async function addCase(form) {
    await run(async () => {
      result(await db.from('cases').insert({ organization_id:orgId, title:form.get('title'), case_number:form.get('case_number') || '', client_name:form.get('client_name') || '', created_by:session.user.id }));
      await loadCases();
    }, 'Sprawa została dodana.');
  }
  async function addTask(form) {
    await run(async () => {
      result(await db.from('tasks').insert({ organization_id:orgId, case_id:selectedCase, title:form.get('title'), assignee_id:session.user.id, due_on:form.get('due_on') || null, created_by:session.user.id }));
      await loadCaseData();
    }, 'Zadanie zostało dodane.');
  }
  async function changeTask(task, values) {
    await run(async () => {
      result(await db.from('tasks').update(values).eq('id', task.id)); await loadCaseData();
    }, 'Zadanie zaktualizowane.');
  }
  async function addDeadline(form) {
    await run(async () => {
      result(await db.from('deadlines').insert({ organization_id:orgId, case_id:selectedCase, title:form.get('title'), received_on:form.get('received_on') || null, due_on:form.get('due_on'), source_note:form.get('source_note') || '', legal_basis:form.get('legal_basis') || '', created_by:session.user.id }));
      await loadCaseData();
    }, 'Termin dodany do weryfikacji.');
  }
  async function confirmDeadline(d) {
    await run(async () => {
      result(await db.from('deadlines').update({ review_status:'confirmed', confirmed_by:session.user.id, confirmed_at:new Date().toISOString() }).eq('id',d.id));
      await loadCaseData();
    }, 'Termin zatwierdzony.');
  }
  async function editDeadline(d) {
    const next = window.prompt('Nowa data terminu (RRRR-MM-DD)', d.due_on);
    if (!next || next === d.due_on) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || Number.isNaN(Date.parse(next))) { setError('Podaj poprawną datę.'); return; }
    await run(async () => {
      result(await db.from('deadlines').update({ due_on:next }).eq('id',d.id));
      await loadCaseData();
    }, 'Datę zmieniono. Termin wymaga ponownego zatwierdzenia.');
  }

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon"><BriefcaseBusiness size={23}/></span><strong>LEXGO</strong><small>KANCELARIA</small></div>
      <div className="nav-label">PRZESTRZEŃ ROBOCZA</div>
      <label className="field-label" htmlFor="org">Kancelaria</label>
      <select id="org" value={orgId} onChange={e => setOrgId(e.target.value)}><option value="">Wybierz kancelarię</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      <nav aria-label="Widoki"><button className={tab === 'tasks' ? 'nav-active' : ''} onClick={() => setTab('tasks')}><Check size={18}/> Zadania</button><button className={tab === 'deadlines' ? 'nav-active' : ''} onClick={() => setTab('deadlines')}><CalendarDays size={18}/> Terminy</button></nav>
      <div className="side-bottom"><span>{session.user.email}</span><button onClick={() => db.auth.signOut()}><LogOut size={16}/> Wyloguj</button></div>
    </aside>
    <main>
      <header><div><span className="eyebrow">PANEL KANCELARII</span><h1>{tab === 'tasks' ? 'Zadania i postęp' : 'Terminy sprawy'}</h1><p>{tab === 'tasks' ? 'Praca zespołu powiązana ze sprawą.' : 'Data, źródło i zatwierdzenie w jednym miejscu.'}</p></div><div className="user-badge"><ShieldCheck size={17}/>{isAdmin ? 'Administrator kancelarii' : 'Członek zespołu'}</div></header>
      {error && <div role="alert" className="alert">{error}</div>}{notice && <div role="status" className="success">{notice}</div>}
      {!organizations.length ? <section className="card first"><h2>Utwórz kancelarię</h2><p>Każda kancelaria ma oddzielną przestrzeń spraw i użytkowników.</p><Form onSubmit={addOrganization}><label>Nazwa kancelarii<input name="name" required minLength="2" placeholder="Np. Kancelaria Przykładowa"/></label><button className="primary" disabled={busy}>Utwórz kancelarię</button></Form></section> : <>
        <div className="case-bar"><div><label htmlFor="case">Sprawa</label><select id="case" value={selectedCase} onChange={e => setSelectedCase(e.target.value)}><option value="">Wybierz sprawę</option>{cases.map(c => <option key={c.id} value={c.id}>{c.case_number ? `${c.case_number} · ` : ''}{c.title}</option>)}</select></div>{currentCase && <span>{currentCase.client_name || 'Klient nieuzupełniony'}</span>}</div>
        {isAdmin && <details className="add-case"><summary><CirclePlus size={17}/> Nowa sprawa</summary><Form onSubmit={addCase}><label>Nazwa sprawy<input name="title" required placeholder="Np. Kowalski przeciwko XYZ"/></label><label>Sygnatura<input name="case_number" placeholder="I C 966/20"/></label><label>Klient<input name="client_name" placeholder="Jan Kowalski"/></label><button disabled={busy} className="primary">Dodaj sprawę</button></Form></details>}
        {!currentCase ? <section className="empty"><BriefcaseBusiness size={28}/><h2>Wybierz sprawę</h2><p>Administrator może utworzyć pierwszą sprawę powyżej.</p></section> : tab === 'tasks' ? <>
          <div className="dashboard"><section className="card progress"><div><span className="eyebrow">POSTĘP SPRAWY</span><h2>{currentCase.case_number || currentCase.title}</h2><p>{tasks.length} zadań łącznie</p></div><Donut counts={counts}/><div className="legend"><span><i className="green"/> Ukończone <b>{counts.done}</b></span><span><i className="yellow"/> W toku <b>{counts.doing}</b></span><span><i className="red"/> Do zrobienia <b>{counts.todo}</b></span></div></section>
          <section className="card new-task"><span className="eyebrow">NOWE ZADANIE</span><h2>Dodaj pracę do sprawy</h2><Form onSubmit={addTask}><label>Opis zadania<input name="title" required placeholder="Np. Przygotować odpowiedź na pozew"/></label><label>Termin wewnętrzny<input type="date" name="due_on"/></label><button className="primary" disabled={busy}><CirclePlus size={17}/> Dodaj zadanie</button></Form></section></div>
          <section className="card list"><h2>Lista zadań</h2>{tasks.length ? tasks.map(t => <div className="row" key={t.id}><div><strong>{t.title}</strong><small>{t.due_on ? `Do ${t.due_on}` : 'Bez daty'} · {t.assignee_id === session.user.id ? 'Przypisane do mnie' : 'Inny członek zespołu'}</small></div><select aria-label={`Status: ${t.title}`} value={t.status} disabled={busy} onChange={e => changeTask(t, { status:e.target.value })}><option value="todo">Do zrobienia</option><option value="doing">W toku</option><option value="done">Ukończone</option></select></div>) : <p className="muted">Nie ma jeszcze zadań w tej sprawie.</p>}</section>
        </> : <><section className="card deadline-form"><span className="eyebrow">REJESTR TERMINÓW</span><h2>Dodaj termin do sprawdzenia</h2><p>Przepisz termin z doręczonego pisma. Na tym etapie system nie wylicza go automatycznie.</p><Form onSubmit={addDeadline}><label>Czynność<input name="title" required placeholder="Np. Odpowiedź na pozew"/></label><div className="two"><label>Data doręczenia<input type="date" name="received_on"/></label><label>Data końcowa<input type="date" name="due_on" required/></label></div><label>Fragment pisma lub źródło<input name="source_note" placeholder="Np. zarządzenie, str. 1, akapit 3"/></label><label>Podstawa prawna<input name="legal_basis" placeholder="Jeśli wskazana"/></label><button className="primary" disabled={busy}>Zapisz do weryfikacji</button></Form></section><section className="card list"><h2>Terminy</h2>{deadlines.length ? deadlines.map(d => <div className="row deadline" key={d.id}><div><strong>{d.title}</strong><small>Do {d.due_on} · doręczenie: {d.received_on || 'brak daty'}</small><small>{d.source_note || 'Nie podano źródła'}{d.legal_basis && ` · ${d.legal_basis}`}</small></div><div className="actions"><span className={d.review_status === 'confirmed' ? 'tag confirmed' : 'tag'}>{d.review_status === 'confirmed' ? 'Zatwierdzony' : 'Do weryfikacji'}</span><button onClick={() => editDeadline(d)}>Zmień datę</button>{d.review_status !== 'confirmed' && <button onClick={() => confirmDeadline(d)}>Zatwierdź</button>}</div></div>) : <p className="muted">Brak terminów w tej sprawie.</p>}</section></>}
      </>}
    </main>
  </div>;
}

function Form({ children, onSubmit }) { return <form onSubmit={async e => { e.preventDefault(); await onSubmit(new FormData(e.currentTarget)); }}>{children}</form>; }
function Donut({ counts }) { const total = counts.todo + counts.doing + counts.done; const green = total ? counts.done / total * 100 : 0; const yellow = total ? counts.doing / total * 100 : 0; return <div role="img" aria-label={`Ukończone ${counts.done}, w toku ${counts.doing}, do zrobienia ${counts.todo}`} className="donut" style={{background:total ? `conic-gradient(#26ad78 0 ${green}%, #e8b548 ${green}% ${green+yellow}%, #e87373 ${green+yellow}% 100%)` : '#e8edf1'}}><div><b>{total ? Math.round(green) : 0}%</b><small>ukończone</small></div></div>; }
function Auth() {
  const [mode, setMode] = useState('login'); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  async function submit(e) { e.preventDefault(); setError(''); setMessage(''); const data = new FormData(e.currentTarget); const credentials = { email:data.get('email'), password:data.get('password') }; const response = mode === 'login' ? await db.auth.signInWithPassword(credentials) : await db.auth.signUp(credentials); if (response.error) setError(response.error.message); else if (mode === 'signup') setMessage('Sprawdź skrzynkę e-mail, jeśli wymagane jest potwierdzenie konta.'); }
  return <div className="auth-layout"><div className="auth-intro"><div className="brand"><span className="brand-icon"><BriefcaseBusiness size={23}/></span><strong>LEXGO</strong></div><h1>Praca nad sprawą<br/>w jednym miejscu.</h1><p>Sprawy, zadania i terminy dla zespołu kancelarii.</p></div><div className="auth-box"><span className="eyebrow">DOSTĘP DO KANCELARII</span><h2>{mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}</h2><form onSubmit={submit}><label>Adres e-mail<input type="email" name="email" required autoComplete="email"/></label><label>Hasło<input type="password" name="password" required minLength="6" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></label><button className="primary">{mode === 'login' ? 'Zaloguj' : 'Zarejestruj'}</button></form>{error && <p role="alert" className="alert">{error}</p>}{message && <p role="status" className="success">{message}</p>}<button className="link-button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Nie masz konta? Zarejestruj się' : 'Masz konto? Zaloguj się'}</button></div></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
