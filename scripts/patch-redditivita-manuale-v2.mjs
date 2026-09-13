import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "src/pages/guide/redditivita-studio.tsx");
let s = fs.readFileSync(file, "utf8");

s = s.replace(
  '<li><strong>Operatori:</strong> configurare costo annuo, ore teoriche, ore non produttive e ore produttive.</li>',
  '<li><strong>Operatori:</strong> configurare ore teoriche, ore non produttive e ore produttive. Il costo del lavoro resta aggregato nei Costi Studio.</li>'
);
s = s.replace(
  '<li><strong>Clienti:</strong> inserire quantità, difficoltà e ripartizione tra operatori.</li>',
  '<li><strong>Clienti:</strong> inserire quantità e difficoltà. Il peso viene attribuito automaticamente all’operatore associato nell’anagrafica cliente.</li>'
);
s = s.replace(
  'La scheda Costi Studio costruisce il costo annuo dello studio per singolo esercizio. Vanno inseriti personale, affitto/immobili, software e licenze, assicurazioni, utenze/servizi, altri costi generali, ore produttive annue e margine obiettivo.',
  'La scheda Costi Studio costruisce il costo annuo dello studio per singolo esercizio. Vanno inseriti personale dipendente, collaboratori diretti, affitto/immobili, software e licenze, assicurazioni, utenze/servizi, altri costi generali e margine obiettivo. Le ore produttive dello studio non si inseriscono qui: derivano automaticamente dalla somma delle ore produttive degli operatori.'
);
s = s.replace(
  '<Formula>costo orario medio = totale costi annui / ore produttive annue studio</Formula>',
  '<Formula>totale costi = personale dipendente + collaboratori diretti + affitto + software + assicurazioni + utenze + altri costi</Formula><Formula>costo orario medio studio = totale costi / somma ore produttive operatori</Formula>'
);
s = s.replace(
  'Per ogni operatore vanno indicati costo annuo e ore disponibili. SMP calcola il costo/h pieno e, quando il lavoro viene ripartito sui clienti, mostra due pesi distinti:',
  'Per ogni operatore non viene più indicato alcun costo individuale. Si configurano esclusivamente le ore: le ore teoriche sono le ore annue disponibili; le ore non produttive comprendono ferie, permessi, formazione, riunioni e attività interne; le ore produttive rappresentano la capacità effettivamente destinabile ai clienti. SMP mostra poi due pesi distinti:'
);
s = s.replace(
  '<Section title="7. Ripartizione per operatore" icon={Users}>\n          <p className="leading-7">Per ogni riga cliente premere <strong>Assegna</strong>. La ripartizione deve totalizzare esattamente 100%. Esempio: Rossi 70%, Bianchi 30%. SMP calcola operazioni, ore e costo attribuito a ciascuno, poi aggiorna il peso sul cliente e sull\'intero studio.</p>\n        </Section>',
  '<Section title="7. Attribuzione automatica all’operatore" icon={Users}>\n          <p className="leading-7">Il lavoro del cliente viene attribuito automaticamente al 100% all’operatore indicato nel campo operatore dell’anagrafica cliente. Non è più necessario ripartire manualmente il lavoro. Se HAPPY S.R.L. ha Mario Artiola come operatore, tutte le operazioni e tutte le ore equivalenti di HAPPY pesano su Mario.</p>\n        </Section>'
);
s = s.replace(
  'Il lavoro viene poi ripartito tra gli operatori; le ore di ciascuno vengono valorizzate con il relativo costo/h pieno. La somma produce il costo del cliente e quindi il compenso obiettivo.',
  'Il lavoro viene attribuito automaticamente all’operatore associato al cliente. Il costo del cliente viene calcolato usando il costo medio orario complessivo dello studio, non un costo individuale dell’operatore. Da questo costo deriva il compenso obiettivo.'
);
s = s.replace(
  '<li><strong>Costo cliente a 0 €:</strong> i servizi non sono ancora ripartiti su operatori con costo/h configurato.</li>',
  '<li><strong>Costo cliente a 0 €:</strong> verificare che siano presenti costi studio e ore produttive degli operatori; senza ore produttive il costo medio orario non può essere calcolato.</li>'
);
s = s.replace(
  '<li><strong>Ripartizione non salvabile:</strong> la somma deve essere 100%.</li>',
  '<li><strong>Peso operatore assente:</strong> verificare che nell’anagrafica cliente sia impostato un operatore attivo.</li>'
);

fs.writeFileSync(file, s, "utf8");
console.log("✓ Manuale Redditività Studio aggiornato al modello v2");
