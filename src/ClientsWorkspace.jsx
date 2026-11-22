import React, { useMemo, useState } from 'react';
import { Building2, Mail, Phone, Plus, Search, UserRound, X, Pencil, ShieldAlert } from 'lucide-react';
import './clients.css';

const clean = value => String(value ?? '').trim();
const prettyType = kind => kind === 'company' ? 'Firma / spółka' : 'Osoba fizyczna';

export default function ClientsWorkspace({db, orgId, records, cases, canManage, crmReady, onReload, onError, onSuccess}) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const legacyNames = useMemo(() => Array.from(new Set(cases.map(c => clean(c.client_name)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pl')), [cases]);
  const clients = useMemo(() => (records || []).filter(c =>
    [c.display_name,c.email,c.phone,c.tax_id].join(' ').toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl'))
  ).sort((a,b)=>a.display_name.localeCompare(b.display_name,'pl')), [records,query]);

  async function save(event) {
    event.preventDefault();
    if (!canManage || !crmReady || !orgId || saving) return;
    const form = new FormData(event.currentTarget);
    const displayName = clean(form.get('name'));
    const kind = form.get('kind');
    const email = clean(form.get('email'));
    const phone = clean(form.get('phone'));
    const taxId = clean(form.get('taxId'));
    if (displayName.length < 2 || displayName.length > 200 ||
        !['person','company'].includes(kind) ||
        email.length > 254 || phone.length > 40 || taxId.length > 40) {
      onError('Sprawdź nazwę i długość wpisanych pól.');
      return;
    }
    const values = {display_name:displayName,kind,email:email||null,phone:phone||null,tax_id:taxId||null};
    setSaving(true);
    try {
      const response = editing?.id
        ? await db.from('clients').update(values).eq('id',editing.id).eq('organization_id',orgId).select('id').single()
        : await db.from('clients').insert({...values,organization_id:orgId}).select('id').single();
      if (response.error) throw response.error;
      const wasEdit = Boolean(editing?.id);
      setEditing(null);
      await onReload();
      onSuccess(wasEdit ? 'Zaktualizowano kartotekę klienta.' : 'Dodano klienta do kartoteki.');
    } catch (error) {onError(error.message || 'Nie udało się zapisać kartoteki klienta.');}
    finally {setSaving(false);}
  }

  return <section className="crm-page">
    {!canManage && <div className="crm-alert"><ShieldAlert size={19}/>
      Pełne kartoteki klientów są w tym etapie widoczne tylko dla administratorów kancelarii.
      Poniżej pokazujemy wyłącznie nazwy powiązane z dostępnymi sprawami.
    </div>}
    {canManage && !crmReady && <div className="crm-alert"><ShieldAlert size={19}/>
      Moduł kartotek wymaga instalacji schematu <code>supabase/sql/clients_crm.sql</code>
      w autoryzowanym projekcie Supabase. Do tego czasu nie można dodawać ani edytować kartotek.
      Istniejące sprawy pozostają bez zmian.
    </div>}
    <div className="crm-head">
      <div><h2>Kartoteka klientów</h2><p>Klienci prywatni, firmy, dane kontaktowe i powiązania ze sprawami.</p></div>
      {canManage && crmReady && <button className="crm-primary" onClick={() => setEditing({kind:'person'})}><Plus size={17}/> Nowy klient</button>}
    </div>
    {canManage && crmReady ? <>
      <div className="crm-search"><Search size={17}/>
        <input aria-label="Wyszukaj klienta" placeholder="Szukaj po nazwie, e-mailu, telefonie lub NIP…" value={query} onChange={e=>setQuery(e.target.value)}/>
        <span>{clients.length} kartotek</span>
      </div>
      <div className="crm-list">
        {clients.map(client => <article className="crm-item" key={client.id}>
          <div className="crm-icon">{client.kind === 'company' ? <Building2 size={21}/> : <UserRound size={21}/>}</div>
          <div className="crm-details">
            <h3>{client.display_name}</h3>
            <small>{prettyType(client.kind)} · {cases.filter(c=>c.client_id === client.id).length} powiązanych spraw</small>
            <div className="crm-contact">
              {client.email && <span><Mail size={14}/>{client.email}</span>}
              {client.phone && <span><Phone size={14}/>{client.phone}</span>}
              {client.tax_id && <span>NIP / ID: {client.tax_id}</span>}
            </div>
          </div>
          <button className="crm-edit" onClick={()=>setEditing(client)} aria-label={'Edytuj: '+client.display_name}><Pencil size={16}/> Edytuj</button>
        </article>)}
        {!clients.length && <div className="crm-empty">{records.length ? 'Nie znaleziono pasujących klientów.' : 'Brak kartotek. Dodaj pierwszego klienta testowego.'}</div>}
      </div>
    </> : <div className="crm-list">
      {legacyNames.map(name => <div className="crm-item" key={name}>
        <div className="crm-icon"><UserRound size={21}/></div>
        <div className="crm-details"><h3>{name}</h3><small>{cases.filter(c=>clean(c.client_name)===name).length} dostępnych spraw · lista ze starszego rejestru</small></div>
      </div>)}
      {!legacyNames.length && <div className="crm-empty">Nie ma klientów powiązanych z dostępnymi sprawami.</div>}
    </div>}
    {canManage && crmReady && legacyNames.some(name=>!(records||[]).some(c=>c.display_name===name)) &&
      <p className="crm-footnote">Część wcześniejszych spraw zawiera nazwy klientów wpisane tekstowo.
        Nie przenosimy ich automatycznie do kartotek, aby uniknąć błędnego przypisania osób.</p>}
    {editing && <div className="crm-overlay" onClick={e=>{if(e.target===e.currentTarget&&!saving)setEditing(null);}}>
      <div className="crm-dialog" role="dialog" aria-modal="true" aria-label={editing.id?'Edytuj klienta':'Nowy klient'}>
        <div className="crm-dialog-head"><h2>{editing.id?'Edytuj kartotekę':'Nowy klient'}</h2>
          <button type="button" onClick={()=>{if(!saving)setEditing(null)}} aria-label="Zamknij"><X size={20}/></button></div>
        <form onSubmit={save} className="crm-form">
          <label>Rodzaj klienta<select name="kind" defaultValue={editing.kind||'person'} required><option value="person">Osoba fizyczna</option><option value="company">Firma / spółka</option></select></label>
          <label>Imię i nazwisko / nazwa<input name="name" required minLength={2} maxLength={200} defaultValue={editing.display_name||''} placeholder="Klient testowy"/></label>
          <label>E-mail<input name="email" type="email" maxLength={254} defaultValue={editing.email||''} placeholder="test@example.invalid"/></label>
          <div className="crm-fields"><label>Telefon<input name="phone" maxLength={40} defaultValue={editing.phone||''}/></label>
            <label>NIP / identyfikator<input name="taxId" maxLength={40} defaultValue={editing.tax_id||''}/></label></div>
          <p>Wersja testowa. Nie zapisuj rzeczywistych danych klientów.</p>
          <button className="crm-primary" disabled={saving}>{saving?'Zapisywanie…':'Zapisz klienta'}</button>
        </form>
      </div>
    </div>}
  </section>;
}
