import React, { useEffect, useMemo, useState } from 'react';
import { FilePlus2, FileText, FileDown, FolderClosed, AlertTriangle, ShieldCheck, LoaderCircle, RefreshCcw } from 'lucide-react';
import './documents.css';
import { uploadResumableFile } from './uploadResumable.js';

const BUCKET = 'lexgo-case-documents';
const STANDARD_UPLOAD_THRESHOLD = 6 * 1024 * 1024;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ALLOWED = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
const readableSize = bytes => bytes < 1024 * 1024
  ? Math.ceil(bytes / 1024) + ' KB'
  : (bytes / (1024 * 1024)).toFixed(2) + ' MB';

export default function DocumentsWorkspace({db,orgId,cases,userId}) {
  const [caseId,setCaseId] = useState('');
  const [documents,setDocuments] = useState([]);
  const [loading,setLoading] = useState(false);
  const [busy,setBusy] = useState(false);
  const [uploadProgress,setUploadProgress] = useState(null);
  const [ready,setReady] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const currentCase = useMemo(()=>cases.find(c=>c.id===caseId),[cases,caseId]);

  useEffect(()=>{
    setCaseId(existing => cases.some(c=>c.id===existing) ? existing : (cases[0]?.id || ''));
  },[orgId,cases]);

  useEffect(()=>{
    let active=true;
    setDocuments([]);
    setReady(false);
    if(!orgId||!caseId)return;
    setLoading(true);
    db.from('case_documents')
      .select('id,file_name,mime_type,size_bytes,status,created_by,created_at,storage_path')
      .eq('organization_id',orgId).eq('case_id',caseId)
      .order('created_at',{ascending:false})
      .then(({data,error:queryError})=>{
        if(!active)return;
        if(queryError){
          setError(queryError.code==='PGRST205'
            ? 'Moduł Dokumenty wymaga instalacji tabeli case_documents w Supabase.'
            : queryError.message);
          return;
        }
        setReady(true);
        setError('');
        setDocuments(data||[]);
      }).catch(e=>{if(active)setError(e.message||'Nie udało się pobrać dokumentów.')})
        .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[db,orgId,caseId]);

  async function reload(){
    if(!orgId||!caseId)return;
    const response=await db.from('case_documents')
      .select('id,file_name,mime_type,size_bytes,status,created_by,created_at,storage_path')
      .eq('organization_id',orgId).eq('case_id',caseId)
      .order('created_at',{ascending:false});
    if(response.error)throw response.error;
    setDocuments(response.data||[]);
  }

  async function upload(event) {
    event.preventDefault();
    const formElement=event.currentTarget;
    setError('');setNotice('');
    if(!ready||!currentCase||busy)return;
    const form=new FormData(formElement);
    const file=form.get('file');
    if(!(file instanceof File)||!file.name){setError('Wybierz plik PDF lub DOCX.');return;}
    const extension=file.name.toLowerCase().split('.').pop();
    const mimeType=ALLOWED[extension];
    if(!mimeType){setError('Obsługiwane są wyłącznie pliki PDF i DOCX.');return;}
    if(file.size<1){setError('Nie można przesłać pustego pliku.');return;}
    if(file.name.length>180){setError('Nazwa pliku nie może przekraczać 180 znaków.');return;}
    // Minimal client-side PDF signature check, not malware scanning or content validation.
    if(extension==='pdf'){
      const header=new Uint8Array(await file.slice(0,5).arrayBuffer());
      if(String.fromCharCode(...header)!=='%PDF-'){
        setError('Plik nie ma prawidłowego nagłówka PDF.');return;
      }
    }
    setBusy(true);
    setUploadProgress(0);
    try{
      const created=await db.from('case_documents')
        .insert({
          organization_id:orgId,
          case_id:currentCase.id,
          file_name:file.name,
          mime_type:mimeType,
          size_bytes:file.size,
          created_by:userId
        }).select('id,storage_path').single();
      if(created.error)throw created.error;
      const item=created.data;
      if (file.size > STANDARD_UPLOAD_THRESHOLD) {
        await uploadResumableFile({
          db, supabaseUrl:SUPABASE_URL, bucket:BUCKET,
          objectName:item.storage_path, file, mimeType,
          onProgress:setUploadProgress
        });
      } else {
        const stored=await db.storage.from(BUCKET).upload(item.storage_path,file,{
          upsert:false,contentType:mimeType,cacheControl:'0'
        });
        if(stored.error)throw stored.error;
        setUploadProgress(100);
      }
      const finished=await db.from('case_documents')
        .update({status:'ready'}).eq('id',item.id).eq('organization_id',orgId)
        .select('id').single();
      if(finished.error)throw finished.error;
      await reload();
      formElement.reset();
      setNotice('Plik zapisano prywatnie w przypisanej sprawie.');
    }catch(e){
      setError('Przesyłanie nie zostało ukończone. '+(e.message||'Spróbuj ponownie.'));
      try{await reload();}catch(_){}
    }finally{setBusy(false);setUploadProgress(null);}
  }

  async function download(item){
    setError('');setNotice('');
    if(busy||item.status!=='ready')return;
    setBusy(true);
    try{
      const response=await db.storage.from(BUCKET)
        .download(item.storage_path,{download:item.file_name});
      if(response.error)throw response.error;
      const url=URL.createObjectURL(response.data);
      const anchor=document.createElement('a');
      anchor.href=url;
      anchor.download=item.file_name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
    }catch(e){setError(e.message||'Nie udało się pobrać pliku.');}
    finally{setBusy(false);}
  }

  return <div className="doc-workspace">
    <div className="doc-warning"><AlertTriangle size={17}/>
      <span><b>Tryb Alpha — wyłącznie dokumenty testowe.</b> Przed danymi klientów potrzebujemy audytu dostępu do plików, kopii zapasowej Storage, skanowania antywirusowego i procedury retencji.</span>
    </div>
    <section className="doc-pane">
      <div className="doc-heading"><div><span className="lx-overline">BEZPIECZNE AKTA</span><h2>Dokumenty spraw</h2><p>Pliki przypisane do konkretnej sprawy; prywatny magazyn Supabase Storage.</p></div><ShieldCheck size={24}/></div>
      <label className="doc-case-select">Wybierz sprawę
        <select value={caseId} onChange={e=>{setCaseId(e.target.value);setError('');setNotice('');}}>
          {!cases.length&&<option value="">Brak dostępnych spraw</option>}
          {cases.map(c=><option key={c.id} value={c.id}>{c.case_number||c.title} · {c.title}</option>)}
        </select>
      </label>
      {!!currentCase&&<div className="doc-current"><FolderClosed size={18}/><div><b>{currentCase.title}</b><small>{currentCase.case_number||'Bez sygnatury'}</small></div></div>}
    </section>
    {!!error&&<div className="lx-error" role="alert">{error}</div>}
    {!!notice&&<div className="lx-success" role="status">{notice}</div>}
    {currentCase&&<>
      <section className="doc-pane">
        <div className="doc-heading"><h2>Dodaj dokument</h2><FilePlus2 size={21}/></div>
        <form className="doc-form" onSubmit={upload}>
          <input name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required disabled={!ready||busy}/>
          <button className="lx-btn primary" disabled={!ready||busy}>{busy?<LoaderCircle size={16}/>:<FilePlus2 size={16}/>} {busy?'Przesyłanie '+(uploadProgress??0)+'%…':'Dodaj do sprawy'}</button>
        </form>
        {busy&&uploadProgress!==null&&<progress aria-label="Postęp przesyłania" max="100" value={uploadProgress} style={{width:'100%',marginTop:10}} />}
        <p className="doc-note">PDF/DOCX, bez limitu wielkości po stronie LEXGO. Obowiązuje globalny limit Twojego planu Supabase Storage. Duże pliki przesyłane są w częściach.</p>
      </section>
      <section className="doc-pane">
        <div className="doc-heading"><div><h2>Pliki w sprawie</h2><p>{documents.filter(x=>x.status==='ready').length} gotowych dokumentów</p></div>
          <button className="lx-btn" onClick={()=>reload().catch(e=>setError(e.message))} disabled={!ready||loading||busy}><RefreshCcw size={15}/> Odśwież</button>
        </div>
        {loading&&<div className="doc-empty">Wczytywanie dokumentów…</div>}
        {!loading&&documents.map(item=><div className="doc-row" key={item.id}>
          <div className="doc-file-icon"><FileText size={19}/></div>
          <div className="doc-info"><b>{item.file_name}</b><small>{readableSize(item.size_bytes)} · {new Date(item.created_at).toLocaleDateString('pl-PL')}{item.status==='pending'?' · przesyłanie nieukończone':''}</small></div>
          {item.status==='ready'&&<button className="lx-btn" disabled={busy} onClick={()=>download(item)}><FileDown size={16}/> Pobierz</button>}
        </div>)}
        {!loading&&!documents.length&&<div className="doc-empty">Brak dokumentów. Dodaj pierwszy fikcyjny plik testowy.</div>}
      </section>
    </>}
  </div>;
}
