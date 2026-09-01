import { useState } from "react";

type HelpTopic =
  | "dati"
  | "dichiarazioni"
  | "ppe"
  | "titolare"
  | "ppeTitolari"
  | "fondi"
  | "attivita"
  | "firma";

const HELP: Record<HelpTopic, { title: string; paragraphs: string[] }> = {
  dati: {
    title: "Come compilare - Dati principali",
    paragraphs: [
      "Verifica che i dati anagrafici riportati coincidano con il documento di identificazione allegato. Se il domicilio effettivo è diverso da quello risultante dal documento, seleziona l'apposita dichiarazione nella sezione successiva.",
      "Le informazioni sono rese ai fini degli obblighi di adeguata verifica previsti dal D.Lgs. 231/2007 e devono essere complete e veritiere.",
    ],
  },
  dichiarazioni: {
    title: "Come compilare - Dichiarazioni del cliente",
    paragraphs: [
      "Indica se i dati di nascita e residenza coincidono con quelli riportati nel documento di identificazione. Se il domicilio è diverso, seleziona la relativa opzione.",
      "Nel campo relativo allo scopo e alla natura della prestazione descrivi in modo concreto il motivo del rapporto professionale, ad esempio: assistenza e consulenza societaria continuativa, tenuta della contabilità, consulenza fiscale, operazione straordinaria, costituzione o modifica societaria.",
    ],
  },
  ppe: {
    title: "Come compilare - Persona politicamente esposta (PPE)",
    paragraphs: [
      "Seleziona una sola delle tre condizioni proposte. È considerata PPE la persona che ricopre o ha ricoperto da meno di un anno importanti cariche pubbliche, oltre ai familiari e ai soggetti che intrattengono notoriamente stretti legami con tali persone.",
      "Rientrano, a titolo esemplificativo, cariche di governo, parlamentari, vertici di partiti politici, magistrature e organi di rilievo, autorità indipendenti, ambasciatori, vertici delle forze armate e di imprese pubbliche, direzioni apicali del servizio sanitario e di organizzazioni internazionali.",
      "Se dichiari di essere PPE, specifica la carica pubblica e, quando la qualifica deriva da un legame familiare o d'affari, indica anche il nominativo e il rapporto con il titolare della carica.",
    ],
  },
  titolare: {
    title: "Come compilare - Individuazione del titolare effettivo",
    paragraphs: [
      "Il titolare effettivo è sempre una persona fisica. Per una società di capitali verifica anzitutto chi possiede, direttamente o indirettamente, una partecipazione superiore al 25% del capitale.",
      "Se la proprietà non consente un'individuazione univoca, considera chi esercita il controllo mediante la maggioranza dei voti, voti sufficienti per un'influenza dominante o particolari vincoli contrattuali.",
      "Solo quando anche questi criteri non consentono di individuare il titolare effettivo si applica il criterio residuale, riferito alle persone fisiche titolari dei poteri di rappresentanza legale, amministrazione o direzione.",
      "Quando selezioni un'opzione che richiede l'indicazione dei titolari effettivi, inserisci e salva almeno un nominativo completo di codice fiscale.",
    ],
  },
  ppeTitolari: {
    title: "Come compilare - PPE dei titolari effettivi",
    paragraphs: [
      "Dopo aver individuato il/i titolare/i effettivo/i, indica se rientrano o meno nella definizione di persona politicamente esposta.",
      "Se almeno un titolare effettivo è PPE, seleziona la relativa dichiarazione e specifica nel campo sottostante nominativo, carica pubblica o legame che determina tale qualifica.",
    ],
  },
  fondi: {
    title: "Come compilare - Relazioni, fondi e mezzi di pagamento",
    paragraphs: [
      "Descrivi il rapporto tra il cliente, l'eventuale esecutore e il titolare effettivo.",
      "Indica in modo concreto la provenienza delle risorse economiche utilizzate nell'operazione, ad esempio redditi da attività professionale o d'impresa, disponibilità societarie, risparmi personali, finanziamento bancario, disinvestimento o vendita di beni.",
      "Per i mezzi di pagamento indica lo strumento effettivamente utilizzato, ad esempio bonifico bancario o assegno. Le informazioni devono essere coerenti con la natura dell'operazione e con quanto noto sul cliente.",
    ],
  },
  attivita: {
    title: "Come compilare - Professione / attività del cliente",
    paragraphs: [
      "Indica l'attività realmente svolta dal cliente, da quando viene esercitata e l'ambito territoriale prevalente.",
      "Usa descrizioni specifiche, ad esempio commercio all'ingrosso di materiali edili, consulenza informatica o locazione immobiliare, evitando formule troppo generiche quando è possibile descrivere con maggiore precisione l'attività.",
    ],
  },
  firma: {
    title: "Come completare e trasmettere il modulo",
    paragraphs: [
      "Completa luogo e data, quindi utilizza Stampa / Salva PDF per generare il documento da sottoscrivere.",
      "Dopo la firma, carica il PDF firmato nell'apposito campo. Prima di premere Salva e chiudi verifica che tutte le dichiarazioni selezionate e gli eventuali titolari effettivi inseriti siano corretti.",
      "Salva e chiudi conclude la compilazione e rende il collegamento non più riutilizzabile.",
    ],
  },
};

export default function AV4HelpButton({ topic }: { topic: HelpTopic }) {
  const [open, setOpen] = useState(false);
  const content = HELP[topic];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
      >
        Come compilare
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{content.title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100"
                aria-label="Chiudi guida"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 px-6 py-5 text-sm leading-6 text-slate-700">
              {content.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            <div className="flex justify-end border-t px-6 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
              >
                Ho capito
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
