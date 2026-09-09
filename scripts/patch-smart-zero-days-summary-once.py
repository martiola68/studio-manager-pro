from pathlib import Path

# UI: zero giorni e' valido in scelta libera.
p=Path('src/pages/presenze/smart-gruppi.tsx')
s=p.read_text(encoding='utf-8')
s=s.replace('''    if (form.scelta_libera) {
      const senzaGiorni = utentiSelezionati.filter((id) => !(giorniPerUtente[id] || []).length);
      if (senzaGiorni.length > 0) {
        alert("Per la scelta libera seleziona almeno un giorno di presenza per ogni utente");
        return;
      }
    }

''','')
p.write_text(s,encoding='utf-8')

# PDF: mostra esplicitamente Smart working quando non e' presenza.
p=Path('src/pages/api/presenze/smart/report-mese.ts')
s=p.read_text(encoding='utf-8')
s=s.replace('''        presenza ? "Presenza" : "",''','''        presenza ? "Presenza" : "Smart working",''')
p.write_text(s,encoding='utf-8')

# Invio PDF usa la stessa semantica se contiene renderer equivalente.
p=Path('src/pages/api/presenze/smart/invia-report-mese.ts')
if p.exists():
    s=p.read_text(encoding='utf-8')
    s=s.replace('''presenza ? "Presenza" : ""''','''presenza ? "Presenza" : "Smart working"''')
    p.write_text(s,encoding='utf-8')
