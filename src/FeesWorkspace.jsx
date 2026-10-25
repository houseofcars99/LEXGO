import React, { useEffect, useMemo, useState } from 'react';
import BillingDrafts from './BillingDrafts.jsx';
const pln = value => new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN'}).format(Number(value)||0);
export default function FeesWorkspace({db,orgId,cases,isAdmin,onError}) {
  const [fees,setFees]=useState([]);
  const [payments,setPayments]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [chosenCase,setChosenCase]=useState('');
  async function load() {
    if (!orgId) {setFees([]);setPayments([]);return;}
    const [a,b] = await Promise.all([
      db.from('fee_agreements').select('id,organization_id,case_id,description,amount_gross,created_at').eq('organization_id',orgId).order('created_at',{ascending:false}),
      db.from('fee_payments').select('id,fee_agreement_id,paid_amount,paid_on,method').eq('organization_id',orgId)
    ]);
    if(a.error) throw a.error;
    if(b.error) throw b.error;
    setFees(a.data||[]);setPayments(b.data||[]);
  }
  useEffect(()=>{let active=true;setLoading(true);setFees([]);setPayments([]);
    if (!orgId){setLoading(false);return;}
    Promise.all([
      db.from('fee_agreements').select('id,organization_id,case_id,description,amount_gross,created_at').eq('organization_id',orgId).order('created_at',{ascending:false}),
      db.from('fee_payments').select('id,fee_agreement_id,paid_amount,paid_on,method').eq('organization_id',orgId)
    ]).then(([a,b])=>{if(a.error)throw a.error;if(b.error)throw b.error;if(active){setFees(a.data||[]);setPayments(b.data||[]);}})
    .catch(err=>{if(active)onError('Rejestr wynagrodzeń: '+err.message+' (sprawdź migrację bazy).')})
    .finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false;};
  },[db,orgId]);
  const paid=useMemo(()=>Object.fromEntries(fees.map(f=>[f.id,payments.filter(p=>p.fee_agreement_id===f.id).reduce((s,p)=>s+Number(p.paid_amount),0)])),[fees,payments]);
  const total=fees.reduce((s,f)=>s+Number(f.amount_gross),0), collected=Object.values(paid).reduce((s,n)=>s+n,0);
  const names=Object.fromEntries(cases.map(c=>[c.id,c.case_number||c.title]));
  async function submitAgreement(e) {
    e.preventDefault();if(!isAdmin)return;
    const form=e.currentTarget, data=new FormData(form);setBusy(true);setMessage('');
    try {
      const amount=Number(data.get('amount'));if(!Number.isFinite(amount)||amount<0)throw Error('Podaj poprawną kwotę.');
      const {data:auth}=await db.auth.getUser();if(!auth.user)throw Error('Sesja wygasła.');
      const {error}=await db.from('fee_agreements').insert({
        organization_id:orgId,case_id:data.get('case_id'),description:data.get('description')||'Wynagrodzenie',
        amount_gross:amount,created_by:auth.user.id});
      if(error)throw error;await load();form.reset();setMessage('Wynagrodzenie zapisane.');
    } catch(err){onError(err.message);} finally {setBusy(false);}
  }
  async function submitPayment(e,fee) {
    e.preventDefault();if(!isAdmin)return;
    const form=e.currentTarget,data=new FormData(form);setBusy(true);setMessage('');
    try {
      const amount=Number(data.get('paid_amount'));
      if(!Number.isFinite(amount)||amount<=0 || Math.round(amount*100)>Math.round((Number(fee.amount_gross)-(paid[fee.id]||0))*100))throw Error('Kwota wpłaty musi być dodatnia i nie może przekroczyć pozostałej należności.');
      const {data:auth}=await db.auth.getUser();if(!auth.user)throw Error('Sesja wygasła.');
      const {error}=await db.from('fee_payments').insert({organization_id:orgId,fee_agreement_id:fee.id,paid_amount:amount,paid_on:data.get('paid_on'),method:data.get('method'),created_by:auth.user.id});
      if(error)throw error;await load();form.reset();setMessage('Wpłata zapisana.');
    }catch(err){onError(err.message);}finally{setBusy(false);}
  }
  return <div className="finance-workspace">
    <section className="card"><h2>Ewidencja wynagrodzeń</h2><p>Kwoty brutto w PLN. Ten rejestr nie wystawia faktur VAT i nie zastępuje księgowości.</p>
      <p><strong>Ustalone: {pln(total)}</strong> · Zapłacone: {pln(collected)} · Do zapłaty: {pln(total-collected)}</p>
      {message&&<p role="status" className="success">{message}</p>}
    </section>
    {isAdmin&&<section className="card"><h2>Dodaj wynagrodzenie</h2><form onSubmit={submitAgreement}>
      <label>Sprawa<select required name="case_id" value={chosenCase} onChange={e=>setChosenCase(e.target.value)}><option value="">Wybierz sprawę</option>{cases.map(c=><option key={c.id} value={c.id}>{names[c.id]}</option>)}</select></label>
      <label>Opis<input required name="description" defaultValue="Wynagrodzenie za prowadzenie sprawy"/></label>
      <label>Ustalona kwota brutto (PLN)<input name="amount" type="number" min="0" step="0.01" required/></label>
      <button disabled={busy||!chosenCase||!orgId} className="primary">Zapisz wynagrodzenie</button>
    </form></section>}
    <section className="card list"><h2>Rozliczenia spraw</h2>
      {loading?<p>Wczytywanie…</p>:fees.length===0?<p className="muted">Brak rozliczeń.</p>:fees.map(f=>{
        const sum=paid[f.id]||0, left=Math.max(0,Number(f.amount_gross)-sum);
        return <div className="row" key={f.id} style={{alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
          <div><strong>{names[f.case_id]||'Sprawa'} · {f.description}</strong>
            <small>Ustalone: {pln(f.amount_gross)} · Zapłacone: {pln(sum)} · Pozostało: {pln(left)}</small>
            <span className={left===0?'tag confirmed':'tag'}>{left===0?'Zapłacone':sum>0?'Częściowo opłacone':'Nieopłacone'}</span>
          </div>
          {isAdmin&&left>0&&<form onSubmit={e=>submitPayment(e,f)} style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <label>Wpłata<input aria-label="Kwota wpłaty" name="paid_amount" required type="number" min="0.01" max={left.toFixed(2)} step="0.01" placeholder="PLN"/></label>
            <label>Data<input aria-label="Data wpłaty" name="paid_on" required type="date" defaultValue={new Date().toISOString().slice(0,10)}/></label>
            <label>Forma<select name="method" aria-label="Forma płatności"><option value="przelew">Przelew</option><option value="gotowka">Gotówka</option><option value="inne">Inne</option></select></label>
            <button disabled={busy} type="submit">Zapisz wpłatę</button>
          </form>}
        </div>;
      })}
    </section>
    <BillingDrafts db={db} orgId={orgId} isAdmin={isAdmin} onError={onError}/>
  </div>;
}
