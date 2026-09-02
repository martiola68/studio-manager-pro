from pathlib import Path

p = Path('src/pages/clienti/organi-sociali.tsx')
s = p.read_text(encoding='utf-8')
old = s

# Aggiunge il flag Firmatario solo alla modale dell'organo di amministrazione.
# Il valore usa il campo esistente `principale` e non modifica DB/API.
footer_marker = '<div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18,paddingTop:14,borderTop:"1px solid #e2e8f0"}}><button type="button" style={{ ...secondaryButton, width: 130, height: 40, padding: "0 14px" }} onClick={()=>setModalSezione(null)}>Annulla</button>'
firmatario = '{modalSezione==="amministrazione" && <div style={{marginTop:16,display:"flex",alignItems:"center"}}><label style={{display:"inline-flex",alignItems:"center",gap:9,fontSize:14,fontWeight:600,color:"#334155",cursor:form.soggetto_cliente_id?"pointer":"not-allowed"}}><input type="checkbox" checked={Boolean(form.principale)} disabled={!form.soggetto_cliente_id} onChange={(e)=>setForm((p)=>({...p,principale:e.target.checked}))} style={{width:17,height:17,cursor:form.soggetto_cliente_id?"pointer":"not-allowed"}}/><span>Firmatario</span></label></div>}\n  '

if '><span>Firmatario</span></label>' in s:
    raise SystemExit('Firmatario already present')
if s.count(footer_marker) != 1:
    raise SystemExit('modal footer marker mismatch')

s = s.replace(footer_marker, firmatario + footer_marker, 1)

assert 'modalSezione==="amministrazione"' in s
assert '<span>Firmatario</span>' in s
assert 'checked={Boolean(form.principale)}' in s
assert 'disabled={!form.soggetto_cliente_id}' in s

if s == old:
    raise SystemExit('no changes')

p.write_text(s, encoding='utf-8')
