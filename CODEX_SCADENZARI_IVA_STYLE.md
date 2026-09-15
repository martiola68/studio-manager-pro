# Task: replica completa stile IVA sugli scadenzari

Modificare realmente i runtime:
- src/pages/scadenze/ccgg.tsx
- src/pages/scadenze/cu.tsx
- src/pages/scadenze/imu.tsx
- src/pages/scadenze/fiscali.tsx
- src/pages/scadenze/bilanci.tsx
- src/pages/scadenze/modello-770.tsx
- src/pages/scadenze/lipe.tsx
- src/pages/scadenze/esterometro.tsx
- src/pages/_app.tsx solo per il comportamento viewport necessario

Usare src/pages/scadenze/iva.tsx come modello approvato.

Requisiti: sfondo grigio chiaro; card bordo azzurro; campi bianchi; tutti i checkbox operativi delle tabelle diventano select SI/NO preservando booleani/disabled; righe compatte; thead sticky grigio scuro/testo chiaro incluso Nominativo; prima colonna sticky; tabella HTML nativa senza flex/block su table/thead/tbody/tr; titolo/statistiche/filtri/thead fissi e solo tbody visivamente scorrevole tramite contenitore nativo; niente scroll verticale esterno; scroll orizzontale interno se necessario; operatori ordinati nome poi cognome; preservare query, DB, stampa, filtri, colori e logiche specifiche.

NON modificare Affitti, Elenco generale, Calendario, Riepilogo.

Rimuovere import Checkbox inutilizzati e usare src/components/scadenze/BooleanSelect.tsx se utile.

Verificare tutti gli otto file runtime e build/typecheck prima di concludere.
