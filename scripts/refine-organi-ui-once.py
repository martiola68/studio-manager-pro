from pathlib import Path

p = Path('src/pages/clienti/organi-sociali.tsx')
s = p.read_text(encoding='utf-8')
old = s

# 1) Organo di controllo sempre visibile, anche senza componenti.
control_open = '{controlloVisualizzato.length > 0 && <div style={{ ...cardStyle, border: "1px solid #8cddff", borderRadius: 12, background: "#ffffff", boxShadow: "0 12px 30px rgba(14,78,112,0.12)" }}>'
control_open_new = '<div style={{ ...cardStyle, border: "1px solid #8cddff", borderRadius: 12, background: "#ffffff", boxShadow: "0 12px 30px rgba(14,78,112,0.12)" }}>'
if s.count(control_open) != 1:
    raise SystemExit('control card opening marker mismatch')
s = s.replace(control_open, control_open_new, 1)

control_close = '</tbody></table></div></div>}\n\n{modalSezione &&'
control_close_new = '{controlloVisualizzato.length === 0 && <tr><td style={tdStyle} colSpan={6}>Nessun componente dell\'organo di controllo presente.</td></tr>}</tbody></table></div></div>\n\n{modalSezione &&'
if s.count(control_close) != 1:
    raise SystemExit('control card closing marker mismatch')
s = s.replace(control_close, control_close_new, 1)

# 2) Pulsante Verifica Titolari Effettivi identico ai pulsanti Aggiungi.
verify_style_old = '''      style={{
        padding: "9px 14px",
        borderRadius: 8,
        border: "1px solid #2563eb",
        background: "#2563eb",
        color: "#ffffff",
        fontWeight: 400,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}'''
verify_style_new = '''      style={{ ...blueButton, width: 190, height: 40, minWidth: 190, minHeight: 40, padding: "0 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(110deg, #0b4f7d 0%, #0d6f9f 58%, #1688b7 100%)", border: "1px solid #0d6f9f", whiteSpace: "nowrap" }}'''
if s.count(verify_style_old) != 1:
    raise SystemExit('verify titulari button style marker mismatch')
s = s.replace(verify_style_old, verify_style_new, 1)

# 3) Salva modifiche sempre leggibile su una riga.
save_btn_old = '<button type="button" style={{ ...blueButton, width: 130, height: 40, padding: "0 14px", background: "linear-gradient(110deg, #0b4f7d 0%, #0d6f9f 58%, #1688b7 100%)", border: "1px solid #0d6f9f" }} onClick={salvaOrgano}>{organoInModificaId?"Salva modifiche":"OK"}</button>'
save_btn_new = '<button type="button" style={{ ...blueButton, width: organoInModificaId ? 190 : 130, minWidth: organoInModificaId ? 190 : 130, height: 40, padding: "0 16px", background: "linear-gradient(110deg, #0b4f7d 0%, #0d6f9f 58%, #1688b7 100%)", border: "1px solid #0d6f9f", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", justifyContent: "center" }} onClick={salvaOrgano}>{organoInModificaId?"Salva modifiche":"OK"}</button>'
if s.count(save_btn_old) != 1:
    raise SystemExit('save modal button marker mismatch')
s = s.replace(save_btn_old, save_btn_new, 1)

# 4) Dopo un salvataggio riuscito chiude la modale prima di azzerare il form.
normal_success = ' setMessaggio("Organo salvato correttamente.");\n\nsetForm({'
normal_success_new = ' setMessaggio("Organo salvato correttamente.");\nsetModalSezione(null);\n\nsetForm({'
if s.count(normal_success) != 1:
    raise SystemExit('normal save success marker mismatch')
s = s.replace(normal_success, normal_success_new, 1)

# Anche il ramo dei diritti collegati chiude correttamente la modale.
linked_success = '  setMessaggio("Diritto collegato correttamente.");\n\n  setForm({'
linked_success_new = '  setMessaggio("Diritto collegato correttamente.");\n  setModalSezione(null);\n  setOrganoInModificaId("");\n\n  setForm({'
if s.count(linked_success) != 1:
    raise SystemExit('linked-right save success marker mismatch')
s = s.replace(linked_success, linked_success_new, 1)

# Verifiche forti.
assert 'controlloVisualizzato.length > 0 &&' not in s
assert 'Nessun componente dell\'organo di controllo presente.' in s
assert 'Verifica Titolari Effettivi' in s
assert 'width: organoInModificaId ? 190 : 130' in s
assert 'setModalSezione(null);' in s

if s == old:
    raise SystemExit('no changes')

p.write_text(s, encoding='utf-8')
