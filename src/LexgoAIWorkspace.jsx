import React,{useEffect,useMemo,useState} from 'react';
import { BrainCircuit, FileSearch, BookOpenCheck, Scale, PenLine, ShieldCheck, RefreshCcw, Copy, FileDown, AlertTriangle, ChevronRight, CheckCircle2, LoaderCircle } from 'lucide-react';
import './lexgoAI.css';

const AGENTS=[
  {id:'analyst',label:'Analityk akt',icon:FileSearch,description:'Fakty, chronologia, dowody, sprzeczności'},
  {id:'researcher',label:'Researcher prawny',icon:BookOpenCheck,description:'Przepisy i orzecznictwo do weryfikacji'},
  {id:'strategist',label:'Strateg procesowy',icon:Scale,description:'Żądania, zarzuty, warianty i ryzyka'},
  {id:'drafter',label:'Redaktor prawny',icon:PenLine,description:'Roboczy projekt pisma procesowego'},
  {id:'reviewer',label:'Kontroler jakości',icon:ShieldCheck,description:'Kontrola tez, dowodów, dat, kwot i źródeł'}
];
const TYPES=[
  ['pozew','Pozew'],['odpowiedz_na_pozew','Odpowiedź na pozew'],
  ['apelacja','Apelacja'],['zazalenie','Zażalenie'],
  ['wniosek','Wniosek'],['pismo_procesowe','Pismo procesowe'],['opinia','Opinia prawna']
];
const ISSUES={
  AI_NOT_CONFIGURED:'Zespół AI nie został jeszcze aktywowany po stronie serwera.',
  AI_RATE_LIMIT:'Dostawca AI ograniczył liczbę wywołań. Spróbuj ponownie później.',
  HOURLY_LIMIT_REACHED:'Limit bezpieczeństwa: maksymalnie trzy rozpoczęte opracowania na godzinę.',
  AI_PROVIDER_AUTH:'Klucz API dostawcy jest nieprawidłowy lub nie ma dostępu do modelu.',
  AI_INVALID_RESPONSE:'Agent zwrócił nieprawidłową strukturę danych. Możesz ponowić ten etap.',
  AI_TIMEOUT:'Przekroczono limit czasu odpowiedzi. Spróbuj ponownie.',
  NOT_FOUND_OR_FORBIDDEN:'Brak dostępu do wskazanego opracowania.',
  ALREADY_RUNNING:'Ten etap już jest wykonywany.',
  AUTH_REQUIRED:'Sesja wygasła. Zaloguj się ponownie.'
};
const names=(row)=>AGENTS[row]?.label||'Agent';
const validCase=(cases,id)=>cases.some(c=>c.id===id);
function exportText(text,filename){
  const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function plainText(run) {
  const header='LEXGO AI — PROJEKT ROBOCZY DO WERYFIKACJI PRZEZ PRAWNIKA\n\n';
  const main=run.responses?.drafter?.content||'Nie utworzono jeszcze projektu.';
  const check=run.responses?.reviewer;
  return header+main+(check?'\n\n=== KONTROLA JAKOŚCI ===\n'+check.content+
    '\n\nSPRAWY DO WERYFIKACJI:\n'+check.required_verification.map(x=>'- '+x).join('\n'):'');
}
export default function LexgoAIWorkspace({db,orgId,cases,userId}){
  const [selectedCase,setSelectedCase]=useState('');
  const [kind,setKind]=useState('pismo_procesowe');
  const [instructions,setInstructions]=useState('');
  const [source,setSource]=useState('');
  const [providedRefs,setProvidedRefs]=useState('');
  const [consent,setConsent]=useState(false);
  const [config,setConfig]=useState({loading:true,configured:false,model:null});
  const [runs,setRuns]=useState([]);
  const [active,setActive]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [detail,setDetail]=useState('analyst');
  const [fetching,setFetching]=useState(false);
  const current=useMemo(()=>runs.find(r=>r.id===active),[runs,active]);
  const chosenCase=cases.find(c=>c.id===selectedCase);

  useEffect(()=>{
    setSelectedCase(old=>validCase(cases,old)?old:(cases[0]?.id||''));
  },[orgId,cases]);
  useEffect(()=>{
    let valid=true;
    setConfig({loading:true,configured:false,model:null});
    db.functions.invoke('lexgo-ai',{body:{action:'status'}})
      .then(({data,error})=>{
        if(!valid)return;
        if(error||!data?.ok)throw Error('Nie można połączyć się z serwerem LEXGO AI.');
        setConfig({loading:false,configured:Boolean(data.configured),model:data.model||null});
      })
      .catch(()=>{if(valid)setConfig({loading:false,configured:false,model:null});});
    return()=>{valid=false};
  },[db]);

  async function reload(){
    if(!selectedCase||!orgId){setRuns([]);setActive('');return;}
    setFetching(true);
    try{
      const res=await db.from('ai_draft_runs').select(
        'id,organization_id,case_id,created_by,document_type,instructions,created_at,state,next_stage,active_stage,responses,last_error_code'
      ).eq('organization_id',orgId).eq('case_id',selectedCase)
        .order('created_at',{ascending:false}).limit(20);
      if(res.error)throw res.error;
      setRuns(res.data||[]);
      setActive(old=>(res.data||[]).some(r=>r.id===old)?old:(res.data?.[0]?.id||''));
    }catch(e){
      setError('Błąd odczytu projektów: '+(e.message||''));
    }finally{setFetching(false);}
  }
  useEffect(()=>{setError('');setMessage('');setRuns([]);setActive('');reload();},[orgId,selectedCase]);
  async function start(e){
    e.preventDefault();
    setError('');setMessage('');
    if(!chosenCase||!config.configured||busy)return;
    if(!consent){setError('Wymagana jest świadoma zgoda na przesłanie podanego materiału do zewnętrznego API.');return;}
    if(instructions.trim().length<10||source.trim().length<30){
      setError('Podaj instrukcję (min. 10 znaków) i opis materiału (min. 30 znaków).');return;
    }
    setBusy(true);
    try{
      const res=await db.from('ai_draft_runs').insert({
        organization_id:orgId,case_id:selectedCase,created_by:userId,
        document_type:kind,instructions:instructions.trim(),source_text:source.trim(),
        verified_sources:providedRefs.trim(),external_processing_consent:true
      }).select('id').single();
      if(res.error)throw res.error;
      await reload();
      setActive(res.data.id);
      setDetail('analyst');
      setMessage('Opracowanie zapisane. Uruchom Analityka akt, aby rozpocząć.');
    }catch(e){setError(e.message||'Nie udało się utworzyć opracowania.');}
    finally{setBusy(false);}
  }
  async function next(){
    if(!current||busy||!config.configured)return;
    setError('');setMessage('');setBusy(true);
    const idx=current.next_stage;
    try{
      const response=await db.functions.invoke('lexgo-ai',{body:{action:'run-stage',id:current.id}});
      if(response.error||!response.data?.ok){
        throw Error(ISSUES[response.data?.error]||response.data?.error||response.error?.message||'Błąd agenta');
      }
      await reload();
      setDetail(AGENTS[idx]?.id||'reviewer');
      setMessage(names(idx)+' zakończył pracę. Wynik wymaga przeglądu przez prawnika.');
    }catch(e){setError(e.message||'Nie udało się uruchomić agenta.');await reload();}
    finally{setBusy(false);}
  }
  async function copyText(){
    if(!current)return;
    try{await navigator.clipboard.writeText(plainText(current));setMessage('Projekt skopiowano do schowka.');}
    catch{setError('Nie udało się skopiować. Skorzystaj z eksportu TXT.');}
  }
  const stageResults=current?.responses||{};
  const nextIdx=current?.next_stage??0;
  return <div className="ai-root">
    <div className="ai-hero">
      <div><span className="lx-overline">LEXGO LEGAL WRITER</span><h2>Pięciu agentów. Jeden projekt pisma.</h2>
        <p>Od analizy akt po kontrolę jakości — każdy etap jest osobno widoczny i wymaga uruchomienia przez prawnika.</p></div>
      <BrainCircuit size={33}/>
    </div>
    <div className="ai-warning"><AlertTriangle size={19}/>
      <div><b>Wersja Alpha — wyłącznie fikcyjne kazusy.</b>
        <div>Nie umieszczaj rzeczywistych akt ani danych klientów. Dokumenty ze spraw nie są automatycznie przekazywane do AI. Research prawny nie jest jeszcze połączony z ELI, SAOS ani bazami orzeczeń; nie traktuj wygenerowanych źródeł jako zweryfikowanych.</div>
      </div></div>
    <div className="ai-flow">{AGENTS.map((a,i)=><div className="ai-agent" key={a.id}>
      <span className="ai-agent-no">{String(i+1).padStart(2,'0')}</span><a.icon size={19}/>
      <b>{a.label}</b><small>{a.description}</small>
    </div>)}</div>
    <div className="ai-config">
      <div><b>Silnik AI: Premium API</b><p>{config.loading?'Sprawdzanie dostępności…':config.configured?'Połączenie skonfigurowane. Model: '+config.model:'Zewnętrzny model nie został jeszcze włączony w ustawieniach serwera. Interfejs i baza są przygotowane.'}</p></div>
      <span className={config.configured?'ai-dot good':'ai-dot'}>{config.configured?'Skonfigurowano':'Wymagana konfiguracja'}</span>
    </div>
    <div className="ai-columns">
      <section className="ai-panel">
        <h3>Nowe opracowanie</h3>
        <form className="ai-form" onSubmit={start}>
          <label>Sprawa<select value={selectedCase} onChange={e=>{setSelectedCase(e.target.value);setDetail('analyst');}} required>
            {!cases.length&&<option value="">Brak przydzielonych spraw</option>}
            {cases.map(c=><option key={c.id} value={c.id}>{c.case_number||c.title} · {c.title}</option>)}
          </select></label>
          <label>Rodzaj pisma<select value={kind} onChange={e=>setKind(e.target.value)}>
            {TYPES.map(([key,label])=><option key={key} value={key}>{label}</option>)}
          </select></label>
          <label>Cel i instrukcje<textarea rows={3} maxLength={3000} value={instructions} onChange={e=>setInstructions(e.target.value)}
            placeholder="Np. sporządź zażalenie na postanowienie o zabezpieczeniu, wskaż brak uprawdopodobnienia roszczenia…" required/></label>
          <label>Stan faktyczny i materiał testowy<textarea rows={8} maxLength={20000} value={source} onChange={e=>setSource(e.target.value)}
            placeholder="Wklej wyłącznie fikcyjne fakty, opis dowodów, chronologię, żądania drugiej strony i znane ograniczenia." required/></label>
          <label>Podane źródła prawne (opcjonalnie; niezweryfikowane)<textarea rows={2} maxLength={4000} value={providedRefs} onChange={e=>setProvidedRefs(e.target.value)}
            placeholder="Np. link do ELI, fragment przepisu lub sygnatura, którą prawnik sam zweryfikował."/></label>
          <label className="ai-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
            <span>Potwierdzam, że materiał jest fikcyjny i świadomie wyrażam zgodę na jego przekazanie do zewnętrznego API w celu wygenerowania tego opracowania.</span></label>
          <button className="lx-btn primary" disabled={busy||!config.configured||!cases.length||!consent}>
            {busy?'Zapisywanie…':'Utwórz projekt AI'}<ChevronRight size={16}/>
          </button>
        </form>
      </section>
      <section className="ai-panel">
        <div className="ai-panelhead"><h3>Projekty i agenci</h3><button className="lx-btn" disabled={fetching||busy} onClick={reload}><RefreshCcw size={15}/></button></div>
        {!!error&&<p className="lx-error" role="alert">{error}</p>}
        {!!message&&<p className="lx-success" role="status">{message}</p>}
        {!!runs.length&&<label className="ai-run-label">Zapisane opracowania
          <select value={active} onChange={e=>{setActive(e.target.value);setDetail('analyst');}}>
            {runs.map(r=><option key={r.id} value={r.id}>{TYPES.find(t=>t[0]===r.document_type)?.[1]||r.document_type} · {new Date(r.created_at).toLocaleString('pl-PL')}</option>)}
          </select></label>}
        {!current?<div className="ai-empty">Nie ma jeszcze opracowania w tej sprawie. Wypełnij formularz po lewej stronie.</div>:<>
          <div className="ai-runstate"><span>{current.state==='complete'?'Przegląd 5/5 zakończony':'Etap '+Math.min(nextIdx+1,5)+'/5'}</span>
            <b>{current.state==='running'?'W trakcie':current.state==='error'?'Błąd etapu':current.state==='complete'?'Projekt do akceptacji':'Gotowy do uruchomienia'}</b></div>
          <div className="ai-agentlist">{AGENTS.map((a,i)=>{
            const finished=!!stageResults[a.id];
            return <button className={'ai-step '+(detail===a.id?'selected':'')} key={a.id}
              onClick={()=>setDetail(a.id)} disabled={i>nextIdx&&!finished}>
              <span className={finished?'ai-status done':'ai-status'}>{finished?<CheckCircle2 size={17}/>:i+1}</span>
              <span><b>{a.label}</b><small>{finished?'Gotowe — zobacz wynik':i===nextIdx?'Następny etap':'Oczekuje'}</small></span>
            </button>;
          })}</div>
          {current.state!=='complete'&&<button className="lx-btn primary ai-runbutton" disabled={busy||!config.configured||current.state==='running'} onClick={next}>
            {busy?<LoaderCircle size={17}/>:<BrainCircuit size={17}/>}
            {busy?'Agent pracuje…':current.state==='error'?'Ponów: '+names(nextIdx):'Uruchom: '+names(nextIdx)}
          </button>}
          {current.last_error_code&&<p className="lx-error">{ISSUES[current.last_error_code]||current.last_error_code}</p>}
          <div className="ai-output">
            <h3>{AGENTS.find(a=>a.id===detail)?.label||'Wynik'}</h3>
            {stageResults[detail]?<>
              <h4>{stageResults[detail].heading}</h4>
              <pre>{stageResults[detail].content}</pre>
              {stageResults[detail].issues?.length>0&&<div className="ai-issues"><b>Uwagi i ryzyka</b>{stageResults[detail].issues.map((issue,i)=><p key={i}>• {issue}</p>)}</div>}
              {stageResults[detail].required_verification?.length>0&&<div className="ai-issues"><b>Do weryfikacji przez prawnika</b>{stageResults[detail].required_verification.map((issue,i)=><p key={i}>• {issue}</p>)}</div>}
            </>:<p className="ai-empty">Agent nie został jeszcze uruchomiony.</p>}
          </div>
          {stageResults.drafter&&<div className="ai-export">
            <button className="lx-btn" onClick={copyText}><Copy size={15}/> Kopiuj projekt</button>
            <button className="lx-btn" onClick={()=>exportText(plainText(current),'lexgo-projekt-pisma.txt')}><FileDown size={15}/> Eksport TXT</button>
          </div>}
        </>}
      </section>
    </div>
    <p className="ai-footnote">Zgodnie z zasadą human-in-the-loop żadna odpowiedź nie jest automatycznie podpisywana, publikowana ani wysyłana do sądu. DOCX, bezpośrednia analiza załączników i live research ELI/SAOS są kolejnymi etapami.</p>
  </div>;
}
