import { useRouter } from "next/router";
import { BookOpen, Calculator, FileText, Printer, Users, WalletCards } from "lucide-react";

const difficulty = [
  { score: "1", label: "Molto semplice", mult: "0,80×", use: "Documenti ordinati, automatismi elevati, nessuna criticità particolare." },
  { score: "2", label: "Semplice", mult: "0,90×", use: "Lavoro lineare, poche verifiche e poche rettifiche." },
  { score: "3", label: "Ordinaria", mult: "1,00×", use: "Cliente standard. È il livello da usare come riferimento normale." },
  { score: "4", label: "Complessa", mult: "1,25×", use: "Più controlli, documentazione incompleta, rettifiche frequenti o più interlocutori." },
  { score: "5", label: "Critica", mult: "1,50×", use: "Forte disordine, urgenze, molte rettifiche o assistenza particolarmente intensa." },
];

export default function ManualeRedditivitaStudio() {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8 print:max-w-none print:px-0">
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between print:hidden">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Manuali di istruzioni</div>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Redditività Studio</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Manuale operativo completo per costi, carichi, difficoltà, operatori, compensi, contratti e incassi.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Indietro</button>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white"><Printer className="h-4 w-4" />Stampa / Salva PDF</button>
        </div>
      </div>

      <article className="space-y-8 text-slate-800">
        <section className="rounded-2xl border border-sky-100 bg-sky-50 p-6">
          <div className="flex items-start gap-3"><BookOpen className="mt-1 h-6 w-6 text-sky-700" /><div><h2 className="text-2xl font-bold text-slate-900">A cosa serve</h2><p className="mt-2 leading-7">Redditività Studio misura quanto lavoro assorbe ogni cliente, quale costo genera per lo studio, quale compenso sarebbe economicamente coerente e come quel compenso viene contrattualizzato e incassato. Il modello separa sempre il semplice numero di operazioni dal carico ponderato in ore equivalenti.</p></div></div>
        </section>

        <Section title="1. Sequenza corretta di utilizzo" icon={FileText}>
          <ol className="list-decimal space-y-2 pl-6 leading-7">
            <li><strong>Costi Studio:</strong> inserire i costi annui e il margine obiettivo.</li>
            <li><strong>Operatori:</strong> configurare costo annuo, ore teoriche, ore non produttive e ore produttive.</li>
            <li><strong>Attività e parametri:</strong> verificare driver e tempi standard.</li>
            <li><strong>Clienti:</strong> inserire quantità, difficoltà e ripartizione tra operatori.</li>
            <li><strong>Compensi & Contratti:</strong> confrontare costo pieno, compenso obiettivo e compenso contrattuale.</li>
            <li><strong>Incassi:</strong> generare rate, registrare fatture e incassi.</li>
            <li><strong>Consuntivo:</strong> confrontare previsioni e lavoro effettivo quando disponibili dati reali.</li>
          </ol>
        </Section>

        <Section title="2. Costi Studio" icon={Calculator}>
          <p className="leading-7">La scheda Costi Studio costruisce il costo annuo dello studio per singolo esercizio. Vanno inseriti personale, affitto/immobili, software e licenze, assicurazioni, utenze/servizi, altri costi generali, ore produttive annue e margine obiettivo.</p>
          <Formula>costo orario medio = totale costi annui / ore produttive annue studio</Formula>
          <Formula>fatturato obiettivo = totale costi annui / (1 - margine obiettivo)</Formula>
          <p className="text-sm text-slate-600">Esempio: costi 300.000 €, 10.000 ore produttive, margine 30% ⇒ costo medio 30 €/h e fatturato obiettivo circa 428.571 €.</p>
        </Section>

        <Section title="3. Operatori e capacità produttiva" icon={Users}>
          <p className="leading-7">Per ogni operatore vanno indicati costo annuo e ore disponibili. SMP calcola il costo/h pieno e, quando il lavoro viene ripartito sui clienti, mostra due pesi distinti:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-7"><li><strong>Peso operazioni:</strong> quota percentuale del numero di operazioni.</li><li><strong>Peso carico:</strong> quota percentuale delle ore equivalenti.</li><li><strong>Saturazione:</strong> ore attribuite / ore produttive disponibili.</li></ul>
        </Section>

        <Section title="4. Attività e parametri" icon={Calculator}>
          <p className="leading-7">Ogni attività possiede un driver e un tempo standard. I driver principali già previsti comprendono movimenti IVA, movimenti contabili, riconciliazioni, liquidazioni IVA, bilancio e chiusure, rettifiche, dichiarazione redditi, dichiarazione IVA, 770, consulenza, pratiche societarie e revisione.</p>
          <Formula>ore equivalenti = quantità × minuti standard / 60 × coefficiente base × moltiplicatore difficoltà</Formula>
          <p className="text-sm text-slate-600">I tempi standard sono parametri gestionali dello studio: vanno adattati alla propria organizzazione e verificati periodicamente sui dati reali.</p>
        </Section>

        <Section title="5. Difficoltà cliente: scala da 1 a 5" icon={Calculator}>
          <p className="mb-4 leading-7"><strong>Valore minimo 1, valore massimo 5. Il livello normale è 3.</strong> Il punteggio non moltiplica direttamente le ore per 1, 2, 3, 4 o 5: viene trasformato in un moltiplicatore ragionevole.</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm"><thead className="bg-slate-100 text-left text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Punteggio</th><th className="px-4 py-3">Livello</th><th className="px-4 py-3">Moltiplicatore</th><th className="px-4 py-3">Quando usarlo</th></tr></thead><tbody className="divide-y divide-slate-200 bg-white">{difficulty.map((d) => <tr key={d.score}><td className="px-4 py-3 text-lg font-bold text-sky-700">{d.score}</td><td className="px-4 py-3 font-semibold">{d.label}</td><td className="px-4 py-3 font-semibold">{d.mult}</td><td className="px-4 py-3">{d.use}</td></tr>)}</tbody></table>
          </div>
          <p className="mt-3 text-sm text-slate-600">Sono ammessi anche mezzi punti (es. 2,5 o 4,5): SMP interpola automaticamente tra i due livelli adiacenti.</p>
        </Section>

        <Section title="6. Dove inserire movimenti IVA, movimenti contabili e altri volumi" icon={FileText}>
          <p className="leading-7">Aprire <strong>Clienti</strong>, cercare e selezionare la società, quindi premere <strong>Aggiungi servizio</strong>. Scegliere l'attività desiderata e compilare <strong>Numero operazioni / quantità</strong> e <strong>Difficoltà 1-5</strong>.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2"><Example title="Movimenti IVA">Attività: Registrazione movimenti IVA. Quantità: numero dei movimenti IVA dell'esercizio. Difficoltà: normalmente 3, salvo caratteristiche particolari.</Example><Example title="Movimenti contabili">Attività: Registrazione movimenti contabili. Quantità: movimenti contabili non già conteggiati nel driver IVA, secondo il criterio adottato dallo studio.</Example><Example title="Bilancio">Per un cliente con contabilità interna non si caricano movimenti IVA/contabili svolti dal cliente: si caricano bilancio, rettifiche, dichiarativi e consulenza effettivamente svolti dallo studio.</Example><Example title="Consulenza">Driver in ore. Inserire le ore annue stimate o effettive di consulenza ricorrente.</Example></div>
        </Section>

        <Section title="7. Ripartizione per operatore" icon={Users}>
          <p className="leading-7">Per ogni riga cliente premere <strong>Assegna</strong>. La ripartizione deve totalizzare esattamente 100%. Esempio: Rossi 70%, Bianchi 30%. SMP calcola operazioni, ore e costo attribuito a ciascuno, poi aggiorna il peso sul cliente e sull'intero studio.</p>
        </Section>

        <Section title="8. Compensi e contratti" icon={WalletCards}>
          <Formula>compenso minimo = costo pieno cliente</Formula>
          <Formula>compenso obiettivo = costo pieno / (1 - margine obiettivo)</Formula>
          <p className="leading-7">Il compenso obiettivo è il riferimento tecnico. Il compenso commerciale del contratto resta modificabile. È possibile usare contratto forfettario, analitico, misto o a ore, con periodicità mensile, bimestrale, trimestrale, semestrale, annuale o personalizzata.</p>
          <p className="mt-2 text-sm text-slate-600">Salva calcolo crea uno snapshot storico del ragionamento economico usato per la decisione commerciale.</p>
        </Section>

        <Section title="9. Incassi e Scadenzario centrale" icon={WalletCards}>
          <p className="leading-7">Dal contratto si genera il piano rate. Le rate passano da Previsto a Fatturato, Incassato, Scaduto o Annullato. Le scadenze confluiscono anche nello Scadenzario centrale. Una rata già fatturata o incassata non viene cancellata da una rigenerazione automatica, per proteggere lo storico.</p>
        </Section>

        <Section title="10. Esempio completo" icon={Calculator}>
          <p className="leading-7">Cliente Alfa S.r.l.: 2.400 movimenti IVA, 1.200 movimenti contabili, 1 bilancio, difficoltà 4. SMP converte ogni driver in ore equivalenti usando il relativo tempo standard e il moltiplicatore 1,25×. Il lavoro viene poi ripartito tra gli operatori; le ore di ciascuno vengono valorizzate con il relativo costo/h pieno. La somma produce il costo del cliente e quindi il compenso obiettivo.</p>
        </Section>

        <Section title="11. Errori frequenti" icon={FileText}>
          <ul className="list-disc space-y-2 pl-6 leading-7"><li><strong>Costo cliente a 0 €:</strong> i servizi non sono ancora ripartiti su operatori con costo/h configurato.</li><li><strong>Nessun cliente:</strong> vengono mostrati solo i clienti attivi dello studio.</li><li><strong>Ore troppo alte:</strong> controllare tempo standard e difficoltà; la difficoltà ordinaria è 3, non 1.</li><li><strong>Ripartizione non salvabile:</strong> la somma deve essere 100%.</li><li><strong>Nessun contratto negli incassi:</strong> prima creare e salvare il contratto nella scheda Compensi & Contratti.</li></ul>
        </Section>

        <Section title="12. Buone pratiche" icon={BookOpen}>
          <ul className="list-disc space-y-2 pl-6 leading-7"><li>Rivedere i costi almeno una volta l'anno.</li><li>Usare 3 come difficoltà standard e spostarsi da quel valore solo per motivi reali e documentabili.</li><li>Dopo 2-3 mesi confrontare tempi standard e tempi effettivi.</li><li>Non usare la difficoltà per correggere un tempo standard sbagliato: correggere prima il tempo standard.</li><li>Salvare uno snapshot prima di ogni rinnovo significativo.</li><li>Per clienti con contabilità interna inserire solo le attività realmente svolte dallo studio.</li></ul>
        </Section>
      </article>
    </main>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:break-inside-avoid"><div className="mb-4 flex items-center gap-3"><span className="rounded-lg bg-sky-50 p-2 text-sky-700"><Icon className="h-5 w-5" /></span><h2 className="text-xl font-bold text-slate-900">{title}</h2></div>{children}</section>;
}

function Formula({ children }: { children: React.ReactNode }) {
  return <div className="my-4 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 font-mono text-sm font-semibold text-slate-800">{children}</div>;
}

function Example({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="mb-2 font-bold text-slate-900">{title}</div><div className="text-sm leading-6 text-slate-700">{children}</div></div>;
}
