from pathlib import Path

p = Path('src/pages/clienti/organi-sociali.tsx')
s = p.read_text(encoding='utf-8')
old = s

# Card: stesso linguaggio visivo della Dashboard.
card_old = '<div style={{ ...cardStyle, border: "1px solid #dbeafe" }}>'
card_new = '<div style={{ ...cardStyle, border: "1px solid #8cddff", borderRadius: 12, background: "#ffffff", boxShadow: "0 12px 30px rgba(14,78,112,0.12)" }}>'
if s.count(card_old) < 2:
    raise SystemExit('card markers missing')
s = s.replace(card_old, card_new, 2)

control_old = '{controlloVisualizzato.length > 0 && <div style={{ ...cardStyle, border: "1px solid #dbeafe" }}>'
control_new = '{controlloVisualizzato.length > 0 && <div style={{ ...cardStyle, border: "1px solid #8cddff", borderRadius: 12, background: "#ffffff", boxShadow: "0 12px 30px rgba(14,78,112,0.12)" }}>'
if s.count(control_old) != 1:
    raise SystemExit('control card marker missing')
s = s.replace(control_old, control_new, 1)

# Pulsanti Aggiungi: identiche dimensioni e stesso gradiente dell'header.
button_style = '{{ ...blueButton, width: 190, height: 40, minWidth: 190, minHeight: 40, padding: "0 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(110deg, #0b4f7d 0%, #0d6f9f 58%, #1688b7 100%)", border: "1px solid #0d6f9f" }}'
repls = [
    ('style={blueButton} onClick={() => apriInserimentoSezione("soci")}', f'style={button_style} onClick={{() => apriInserimentoSezione("soci")}}'),
    ('style={blueButton} onClick={() => apriInserimentoSezione("amministrazione")}', f'style={button_style} onClick={{() => apriInserimentoSezione("amministrazione")}}'),
    ('style={blueButton} onClick={()=>apriInserimentoSezione("controllo")}', f'style={button_style} onClick={{()=>apriInserimentoSezione("controllo")}}'),
]
for before, after in repls:
    if s.count(before) != 1:
        raise SystemExit(f'button marker missing: {before}')
    s = s.replace(before, after, 1)

# Modale: Filtra nomi + Nuovo separato, senza + nella select.
needle = '<div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"end"}}><div><label style={labelStyle}>Ricerca nominativo</label><input style={inputStyle} value={ricercaNominativo} onChange={(e)=>setRicercaNominativo(e.target.value)} placeholder="Cognome e nome, codice fiscale o partita IVA"/></div><button type="button" style={secondaryButton}>Cerca</button></div>\n  <div style={{marginTop:12}}><label style={labelStyle}>Nominativo</label><select style={inputStyle} value={form.soggetto_cliente_id} onChange={(e)=>setForm((p)=>({...p,soggetto_cliente_id:e.target.value}))}><option value="">Seleziona nominativo</option>{nominativi.filter((n)=>!ricercaNominativo.trim() || [n.ragione_sociale,n.codice_fiscale,n.partita_iva].some((v)=>String(v||"").toLowerCase().includes(ricercaNominativo.trim().toLowerCase()))).map((n)=><option key={n.id} value={n.id}>{n.ragione_sociale}{n.codice_fiscale?` — ${n.codice_fiscale}`:""}</option>)}</select></div>'
repl = '<div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"end"}}><div><label style={labelStyle}>Filtro nominativo</label><input style={inputStyle} value={ricercaNominativo} onChange={(e)=>setRicercaNominativo(e.target.value)} placeholder="Cognome e nome, codice fiscale o partita IVA"/></div><button type="button" style={{ ...secondaryButton, width: 140, height: 40, padding: "0 14px" }}>Filtra nomi</button></div>\n  <div style={{marginTop:12}}><label style={labelStyle}>Nominativo</label><select style={inputStyle} value={form.soggetto_cliente_id} onChange={(e)=>setForm((p)=>({...p,soggetto_cliente_id:e.target.value}))}><option value="">Seleziona nominativo</option>{nominativi.filter((n)=>!ricercaNominativo.trim() || [n.ragione_sociale,n.codice_fiscale,n.partita_iva].some((v)=>String(v||"").toLowerCase().includes(ricercaNominativo.trim().toLowerCase()))).map((n)=><option key={n.id} value={n.id}>{n.ragione_sociale}{n.codice_fiscale?` — ${n.codice_fiscale}`:""}</option>)}</select></div>\n  <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:10,flexWrap:"wrap"}}><button type="button" style={{ ...secondaryButton, width: 140, height: 40, padding: "0 14px" }} onClick={()=>{setNominativoInModificaId(null);setNuovoNominativo({nome_cognome:"",codice_fiscale:"",email:"",luogo_nascita:"",data_nascita:"",indirizzo:"",citta:"",provincia:"",cap:"",tipologia_cliente:"Persona fisica"});setShowNuovoNominativo(true);}}>Nuovo</button><button type="button" style={{ ...secondaryButton, width: 160, height: 40, padding: "0 14px" }} disabled={!form.soggetto_cliente_id} onClick={apriModificaNominativo}>Modifica anagrafica</button></div>'
if s.count(needle) != 1:
    raise SystemExit('modal marker mismatch')
s = s.replace(needle, repl, 1)

# La modale Nuovo nominativo deve stare sopra la modale Soci/Organi.
if s.count('zIndex: 9999,') != 1:
    raise SystemExit('new nominativo z-index marker mismatch')
s = s.replace('zIndex: 9999,', 'zIndex: 10001,', 1)

# Footer modale: dimensioni coerenti; OK con gradiente header.
footer = '<button type="button" style={secondaryButton} onClick={()=>setModalSezione(null)}>Annulla</button><button type="button" style={blueButton} onClick={salvaOrgano}>'
footer_new = '<button type="button" style={{ ...secondaryButton, width: 130, height: 40, padding: "0 14px" }} onClick={()=>setModalSezione(null)}>Annulla</button><button type="button" style={{ ...blueButton, width: 130, height: 40, padding: "0 14px", background: "linear-gradient(110deg, #0b4f7d 0%, #0d6f9f 58%, #1688b7 100%)", border: "1px solid #0d6f9f" }} onClick={salvaOrgano}>'
if s.count(footer) != 1:
    raise SystemExit('footer marker mismatch')
s = s.replace(footer, footer_new, 1)

# Verifiche forti: non deve restare la vecchia UI nel blocco interessato.
assert '>Cerca</button>' not in s
assert 'Ricerca nominativo</label>' not in s
assert '>Nuovo</button>' in s
assert '<option value="">+ Nuovo' not in s
assert s.count('#8cddff') >= 3
assert s.count('linear-gradient(110deg, #0b4f7d 0%, #0d6f9f 58%, #1688b7 100%)') >= 4

if s == old:
    raise SystemExit('no changes')

p.write_text(s, encoding='utf-8')
