from pathlib import Path

p=Path('src/pages/clienti/organi-sociali.tsx')
s=p.read_text(encoding='utf-8')
old=s

# Dashboard-like cards: same visual language as home cards, no data/handler changes.
for title in ('Soci','Organo di amministrazione'):
    marker='<div style={{ ...cardStyle, border: "1px solid #dbeafe" }}>'
    if marker not in s: raise SystemExit(f'card marker missing for {title}')
    s=s.replace(marker,'<div style={{ ...cardStyle, border: "1px solid #7dd3fc", borderRadius: 10, background: "#ffffff", boxShadow: "0 1px 2px rgba(15,23,42,0.03)" }}>',1)
# Third card exists conditionally.
marker='{controlloVisualizzato.length > 0 && <div style={{ ...cardStyle, border: "1px solid #dbeafe" }}>'
if marker not in s: raise SystemExit('control card marker missing')
s=s.replace(marker,'{controlloVisualizzato.length > 0 && <div style={{ ...cardStyle, border: "1px solid #7dd3fc", borderRadius: 10, background: "#ffffff", boxShadow: "0 1px 2px rgba(15,23,42,0.03)" }}>',1)

# Primary section buttons: identical dimensions and header blue.
button_style='{{ ...blueButton, width: 190, height: 38, minWidth: 190, minHeight: 38, padding: "0 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#1684ad", borderColor: "#1684ad" }}'
s=s.replace('style={blueButton} onClick={() => apriInserimentoSezione("soci")}', f'style={button_style} onClick={{() => apriInserimentoSezione("soci")}}',1)
s=s.replace('style={blueButton} onClick={() => apriInserimentoSezione("amministrazione")}', f'style={button_style} onClick={{() => apriInserimentoSezione("amministrazione")}}',1)
s=s.replace('style={blueButton} onClick={()=>apriInserimentoSezione("controllo")}', f'style={button_style} onClick={{()=>apriInserimentoSezione("controllo")}}',1)

# Modal: rename filter and restore explicit New button using the existing anagrafica modal logic.
needle='<div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"end"}}><div><label style={labelStyle}>Ricerca nominativo</label><input style={inputStyle} value={ricercaNominativo} onChange={(e)=>setRicercaNominativo(e.target.value)} placeholder="Cognome e nome, codice fiscale o partita IVA"/></div><button type="button" style={secondaryButton}>Cerca</button></div>\n  <div style={{marginTop:12}}><label style={labelStyle}>Nominativo</label><select style={inputStyle} value={form.soggetto_cliente_id} onChange={(e)=>setForm((p)=>({...p,soggetto_cliente_id:e.target.value}))}><option value="">Seleziona nominativo</option>{nominativi.filter((n)=>!ricercaNominativo.trim() || [n.ragione_sociale,n.codice_fiscale,n.partita_iva].some((v)=>String(v||"").toLowerCase().includes(ricercaNominativo.trim().toLowerCase()))).map((n)=><option key={n.id} value={n.id}>{n.ragione_sociale}{n.codice_fiscale?` — ${n.codice_fiscale}`:""}</option>)}</select></div>'
repl='<div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"end"}}><div><label style={labelStyle}>Filtra nomi</label><input style={inputStyle} value={ricercaNominativo} onChange={(e)=>setRicercaNominativo(e.target.value)} placeholder="Cognome e nome, codice fiscale o partita IVA"/></div><button type="button" style={{ ...secondaryButton, width: 140, height: 38, padding: "0 14px" }}>Filtra nomi</button></div>\n  <div style={{marginTop:12}}><label style={labelStyle}>Nominativo</label><select style={inputStyle} value={form.soggetto_cliente_id} onChange={(e)=>setForm((p)=>({...p,soggetto_cliente_id:e.target.value}))}><option value="">Seleziona nominativo</option>{nominativi.filter((n)=>!ricercaNominativo.trim() || [n.ragione_sociale,n.codice_fiscale,n.partita_iva].some((v)=>String(v||"").toLowerCase().includes(ricercaNominativo.trim().toLowerCase()))).map((n)=><option key={n.id} value={n.id}>{n.ragione_sociale}{n.codice_fiscale?` — ${n.codice_fiscale}`:""}</option>)}</select></div>\n  <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:10,flexWrap:"wrap"}}><button type="button" style={{ ...secondaryButton, width: 140, height: 38, padding: "0 14px" }} onClick={()=>{setNominativoInModificaId(null);setNuovoNominativo({nome_cognome:"",codice_fiscale:"",email:"",luogo_nascita:"",data_nascita:"",indirizzo:"",citta:"",provincia:"",cap:"",tipologia_cliente:"Persona fisica"});setShowNuovoNominativo(true);}}>Nuovo</button><button type="button" style={{ ...secondaryButton, width: 160, height: 38, padding: "0 14px" }} disabled={!form.soggetto_cliente_id} onClick={apriModificaNominativo}>Modifica anagrafica</button></div>'
if s.count(needle)!=1: raise SystemExit('modal marker mismatch')
s=s.replace(needle,repl,1)

# Modal footer buttons aligned and primary in header blue.
footer='<button type="button" style={secondaryButton} onClick={()=>setModalSezione(null)}>Annulla</button><button type="button" style={blueButton} onClick={salvaOrgano}>'
footer_new='<button type="button" style={{ ...secondaryButton, width: 130, height: 38, padding: "0 14px" }} onClick={()=>setModalSezione(null)}>Annulla</button><button type="button" style={{ ...blueButton, width: 130, height: 38, padding: "0 14px", background: "#1684ad", borderColor: "#1684ad" }} onClick={salvaOrgano}>'
if s.count(footer)!=1: raise SystemExit('footer marker mismatch')
s=s.replace(footer,footer_new,1)

# Hard assertions requested by user.
assert '>Cerca</button>' not in s
assert '>+ Nuovo' not in s
assert '>Nuovo</button>' in s
assert s.count('background: "#1684ad"') >= 4
if s==old: raise SystemExit('no changes')
p.write_text(s,encoding='utf-8')
