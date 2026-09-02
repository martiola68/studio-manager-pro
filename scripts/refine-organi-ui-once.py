from pathlib import Path

p = Path('src/pages/clienti/organi-sociali.tsx')
s = p.read_text(encoding='utf-8')
old = s

# 1) Pulsante Modifica anagrafica: testo sempre su una sola riga.
old_btn = '<button type="button" style={{ ...secondaryButton, width: 160, height: 40, padding: "0 14px" }} disabled={!form.soggetto_cliente_id} onClick={apriModificaNominativo}>Modifica anagrafica</button>'
new_btn = '<button type="button" style={{ ...secondaryButton, width: 190, minWidth: 190, height: 40, padding: "0 16px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", justifyContent: "center" }} disabled={!form.soggetto_cliente_id} onClick={apriModificaNominativo}>Modifica anagrafica</button>'
if s.count(old_btn) != 1:
    raise SystemExit('Modifica anagrafica button marker mismatch')
s = s.replace(old_btn, new_btn, 1)

# 2) Firmatario: solo nella modale Organo di amministrazione, usando il campo esistente `principale`.
footer = '<div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:22,borderTop:"1px solid #e2e8f0",paddingTop:16}}><button type="button" style={{ ...secondaryButton, width: 130, height: 40, padding: "0 14px" }} onClick={()=>setModalSezione(null)}>Annulla</button>'
firmatario = '{modalSezione==="amministrazione" && <div style={{marginTop:16,display:"flex",alignItems:"center",justifyContent:"flex-start"}}><label style={{display:"inline-flex",alignItems:"center",gap:9,fontSize:14,fontWeight:600,color:"#334155",cursor:form.soggetto_cliente_id?"pointer":"not-allowed",userSelect:"none"}}><input type="checkbox" checked={Boolean(form.principale)} disabled={!form.soggetto_cliente_id} onChange={(e)=>setForm((p)=>({...p,principale:e.target.checked}))} style={{width:17,height:17,accentColor:"#0d6f9f",cursor:form.soggetto_cliente_id?"pointer":"not-allowed"}}/><span>Firmatario</span></label></div>}\n  '

if '<span>Firmatario</span>' not in s:
    if s.count(footer) != 1:
        raise SystemExit('modal footer marker mismatch')
    s = s.replace(footer, firmatario + footer, 1)

# Verifiche forti.
assert 'whiteSpace: "nowrap"' in s
assert 'width: 190, minWidth: 190' in s
assert 'modalSezione==="amministrazione"' in s
assert '<span>Firmatario</span>' in s
assert 'checked={Boolean(form.principale)}' in s
assert 'disabled={!form.soggetto_cliente_id}' in s

if s == old:
    raise SystemExit('no changes')

p.write_text(s, encoding='utf-8')
