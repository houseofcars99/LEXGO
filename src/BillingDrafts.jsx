import React,{useEffect,useState} from 'react';
const money=v=>new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN'}).format(Number(v)||0);
export default function BillingDrafts({db,orgId,isAdmin,onError}){
 const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let current=true;setRows([]);if(!orgId||!isAdmin)return;
 db.from('billing_drafts').select('id,buyer_name,seller_name,service_name,gross_amount,created_at,status').eq('organization_id',orgId).order('created_at',{ascending:false})
 .then(({data,error})=>{if(error)throw error;if(current)setRows(data||[]);}).catch(e=>{if(current)onError('Szkice dokumentów: '+e.message);});
 return ()=>{current=false};},[db,orgId,isAdmin]);
 async function add(e){e.preventDefault();if(!isAdmin)return;const form=e.currentTarget,d=new FormData(form);setBusy(true);setMessage('');
 try{const amount=Number(d.get('gross_amount'));if(!Number.isFinite(amount)||amount<=0)throw Error('Niepoprawna kwota.');
 const {data:auth,error:authError}=await db.auth.getUser();if(authError||!auth.user)throw Error('Sesja wygasła.');
 const body={organization_id:orgId,created_by:auth.user.id,
 buyer_name:String(d.get('buyer_name')).trim(),buyer_address:String(d.get('buyer_address')).trim(),
 buyer_nip:String(d.get('buyer_nip')).trim(),seller_name:String(d.get('seller_name')).trim(),
 seller_address:String(d.get('seller_address')).trim(),seller_nip:String(d.get('seller_nip')).trim(),
 service_name:String(d.get('service_name')).trim(),gross_amount:amount};
 const {data,error}=await db.from('billing_drafts').insert(body).select('id,buyer_name,seller_name,service_name,gross_amount,created_at,status').single();
 if(error)throw error;setRows(previous=>[data,...previous]);form.reset();setMessage('Szkic zapisano. Dokument nie został wystawiony.');}
 catch(e){onError(e.message);}finally{setBusy(false);}
 }
 if(!isAdmin)return null;
 return <section className="card"><h2>Szkice dokumentów rozliczeniowych</h2>
 <p>Przygotowanie danych do faktury lub rachunku. Szkice nie otrzymują numeru faktury, nie są wysyłane do KSeF ani do klienta. Kwoty podatków wymagają weryfikacji.</p>
 {message&&<p role="status" className="success">{message}</p>}
 <form onSubmit={add}>
 <label>Sprzedawca<input name="seller_name" required minLength="2" maxLength="200" placeholder="Nazwa kancelarii"/></label>
 <label>Adres sprzedawcy<input name="seller_address" maxLength="300"/></label>
 <label>NIP sprzedawcy<input name="seller_nip" maxLength="20"/></label>
 <label>Nabywca<input name="buyer_name" required minLength="2" maxLength="200"/></label>
 <label>Adres nabywcy<input name="buyer_address" maxLength="300"/></label>
 <label>NIP nabywcy (jeżeli dotyczy)<input name="buyer_nip" maxLength="20"/></label>
 <label>Usługa<input name="service_name" required minLength="2" maxLength="240" defaultValue="Usługa prawna"/></label>
 <label>Kwota brutto (PLN)<input name="gross_amount" type="number" step="0.01" min="0.01" required/></label>
 <button className="primary" type="submit" disabled={busy||!orgId}>Zapisz szkic</button>
 </form>
 <h3>Przygotowane szkice</h3>
 {rows.length===0?<p className="muted">Nie ma jeszcze szkiców.</p>:rows.map(row=><div key={row.id} className="row"><div><strong>{row.buyer_name} · {row.service_name}</strong><small>{money(row.gross_amount)} · Szkic niewystawiony · {row.created_at?.slice(0,10)}</small></div></div>)}
 </section>
}
