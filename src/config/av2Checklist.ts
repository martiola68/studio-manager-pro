export type AV2ChecklistItem = {
  id: number;
  documento: string;
  osservazioni: string;
};

export const AV2_CHECKLIST: AV2ChecklistItem[] = [
  {
    id: 1,
    documento:
      "Documento previsto dalle regole di condotta di cui alla Regola Tecnica n. 2",
    osservazioni:
      "Per le prestazioni professionali a rischio inerente “non significativo” vedi specifiche previsioni contenute nella Tabella n. 1 della Regola Tecnica 2.1. In questi casi, e nei limiti previsti dalla suddetta Regola Tecnica, non è necessaria l’ulteriore documentazione di cui alla lista sottostante.",
  },
  {
    id: 2,
    documento:
      "Fotocopia documento di identità o di altro documento di riconoscimento equipollente, in corso di validità, del Cliente ovvero dell’esecutore in caso di società/enti",
    osservazioni:
      "Documento del Cliente persona fisica ovvero dell’esecutore (soggetto che agisce per conto del Cliente società/ente). Da integrare eventualmente con documentazione da fonti affidabili e indipendenti per verifica dati identificativi. Annotazioni/Informazioni aggiuntive su PPE. Consultazione del seguente sito nel caso sussistano dubbi sulla veridicità del documento esibito: https://www.crimnet.dcpc.interno.gov.it/crimnet/",
  },
  {
    id: 3,
    documento:
      "Visura del Registro Imprese (certificato equivalente per società di diritto estero)",
    osservazioni:
      "Per verificare denominazione/ragione sociale e sede della società/ente Cliente nonché per verificare esistenza e ampiezza dei poteri di rappresentanza del soggetto che agisce per conto della società/ente nel conferimento dell’incarico professionale.",
  },
  {
    id: 4,
    documento:
      "Atti costitutivi e delibere per i soggetti/enti che non sono tenuti all’iscrizione al Registro delle Imprese",
    osservazioni:
      "Per verificare esistenza e ampiezza dei poteri di rappresentanza del soggetto che agisce per conto dell’ente nel conferimento dell’incarico professionale.",
  },
  {
    id: 5,
    documento: "Attestazione codice fiscale e (eventuale) partita IVA",
    osservazioni: "",
  },
  {
    id: 6,
    documento: "Mandato (lettera di incarico) professionale",
    osservazioni:
      "Al fine di documentare la data di inizio dell’incarico professionale, copia del mandato professionale scritto e relativa accettazione da parte del Cliente.",
  },
  {
    id: 7,
    documento:
      "Scheda di adeguata verifica (ai fini della dimostrazione dell’avvenuto adempimento dei relativi obblighi)",
    osservazioni:
      "Si consiglia l’adozione del modello AV.3 delle presenti Linee Guida al fine di documentare: identificazione del Cliente, identificazione del Titolare effettivo, acquisizione e valutazione di informazioni su scopo e natura del rapporto continuativo o della prestazione professionale, controllo costante.",
  },
  {
    id: 8,
    documento:
      "Dichiarazione antiriciclaggio resa dal Cliente ex art. 22 D.Lgs. 231/2007",
    osservazioni:
      "Si consiglia l’adozione del modello AV.4 delle presenti Linee Guida.",
  },
  {
    id: 9,
    documento:
      "Scheda di determinazione del rischio effettivo ex art. 17 D.Lgs. 231/2007",
    osservazioni:
      "Si consiglia l’adozione del modello AV.1 delle presenti Linee Guida.",
  },
  {
    id: 10,
    documento:
      "Attestazione per l’esecuzione dell’obbligo di adeguata verifica da parte di terzi ex art. 26, D.Lgs. 231/2007",
    osservazioni:
      "Si consiglia l’adozione del modello AV.5 delle presenti Linee Guida.",
  },
  {
    id: 11,
    documento:
      "Documentazione in base alla quale si è verificata la possibilità (o la necessità) di applicare obblighi semplificati (o rafforzati) di adeguata verifica della clientela",
    osservazioni:
      "Vedasi articoli 23, 24 e 25, D.Lgs. 231/2007 e Regola Tecnica n. 2.",
  },
  {
    id: 12,
    documento:
      "Dichiarazione sostitutiva di certificazioni e di atti notori o certificato del Tribunale in merito ad eventuali condanne e procedimenti penali in corso",
    osservazioni:
      "Nel caso si venga a conoscenza di condanne o procedimenti in corso a carico del Cliente/titolare effettivo e si ritenga necessario documentare l’esclusione del collegamento tra le imputazioni e la prestazione professionale richiesta.",
  },
  {
    id: 13,
    documento:
      "Esiti di ricerche su internet o in apposite banche dati del nominativo del Cliente, del soggetto che agisce per conto del Cliente e degli eventuali titolari effettivi",
    osservazioni:
      "Nel caso si ritenga utile verificare la presenza di eventuali condanne o notizie pregiudizievoli sul Cliente/titolare effettivo per valutarne l’eventuale connessione con la prestazione professionale richiesta.",
  },
  {
    id: 14,
    documento:
      "Documentazione o attestazioni comprovanti la consistenza patrimoniale e/o la capacità di credito del Cliente (p.e. ultima dichiarazione dei redditi, ultimo bilancio approvato, lettera di referenze di un Istituto di Credito, lettera di presentazione di un soggetto sottoposto alla normativa antiriciclaggio, ecc.)",
    osservazioni:
      "Ove la prestazione professionale comporti una consistente movimentazione di mezzi di pagamento e si ritenga necessario approfondire e documentare la coerenza delle disponibilità con il profilo economico/patrimoniale del Cliente.",
  },
  {
    id: 15,
    documento:
      "Visura camerale nominativa completa per codice fiscale per la verifica delle cariche sociali (amministratore e socio), del bollettino dei protesti e dell’assoggettamento a procedure concorsuali del legale rappresentante e degli eventuali titolari effettivi",
    osservazioni:
      "Ove possa essere utile verificare o approfondire la posizione soggettiva della persona (Cliente, esecutore, titolare effettivo).",
  },
  {
    id: 16,
    documento:
      "Documentazione che comprovi l’esame della posizione giuridica del Cliente o l’espletamento di compiti di difesa o rappresentanza davanti a un’Autorità giudiziaria compresa la consulenza sull’eventualità di intentare o evitare il procedimento (e copia dell’incarico professionale conferito)",
    osservazioni:
      "Ai fini del termine per la verifica dell’identità del Cliente (comma 4, art. 18, D.Lgs. 231/2007) e dell’esonero da SOS (comma 5, art. 35, D.Lgs. 231/2007).",
  },
  {
    id: 17,
    documento:
      "Rapporti/documentazione circa un eventuale nominativo rilevante ai fini antiterrorismo",
    osservazioni:
      "Nel caso si renda necessaria una verifica del nominativo del Cliente rispetto alle liste delle persone e degli enti associati ad attività di finanziamento del terrorismo o destinatari di misure di congelamento.",
  },
  {
    id: 18,
    documento:
      "Documenti, estratti da pubblici registri o annotazioni che il Professionista ritenga opportuno conservare ai fini della normativa antiriciclaggio e di finanziamento del terrorismo, in particolare ai fini della valutazione dei rischi e delle segnalazioni di operazioni sospette",
    osservazioni:
      "Può essere utile inserire dati, documenti e annotazioni non espressamente richiesti dalle norme, ma che costituiscono un supporto alla valutazione del rischio e alle motivazioni che hanno condotto, o meno, alla segnalazione di un’operazione sospetta.",
  },
  {
    id: 19,
    documento:
      "Documenti relativi alle modifiche anagrafiche (ove intervenute in vigenza di incarico professionale) o altri documenti per il controllo costante",
    osservazioni:
      "Del Cliente persona fisica, del Cliente società, del soggetto che ha rappresentato la società nell’incarico professionale, del titolare effettivo e dell’eventuale esecutore; se le modifiche sono tali da comportare una variazione del livello di rischio, risulta opportuno aggiornare la scheda di valutazione del rischio antiriciclaggio/antiterrorismo.",
  },
  {
    id: 20,
    documento:
      "Documenti riferiti alle “operazioni” secondo la definizione dell’art. 1 lett. t) D.Lgs. 231/2007",
    osservazioni: "",
  },
  {
    id: 21,
    documento:
      "Altra documentazione ritenuta opportuna a seguito di valutazioni/considerazioni del Professionista (specificare)",
    osservazioni:
      "Ogni ulteriore documento o traccia di informazione necessaria o utile per l’adeguata verifica, ovvero per altri presidi antiriciclaggio.",
  },
  {
    id: 22,
    documento:
      "Dichiarazione di astensione del Professionista (art. 42 D.Lgs. 231/2007)",
    osservazioni:
      "Si consiglia l’adozione del modello AV.6 delle presenti Linee Guida.",
  },
  {
    id: 23,
    documento:
      "Documentazione relativa alla cessazione della prestazione professionale",
    osservazioni:
      "Eventuale lettera/comunicazione di revoca o di rinuncia all’incarico. Copia della cancellazione partita IVA/codice fiscale, cessazione dal Registro delle Imprese, decreto di estinzione, ecc. in capo al Cliente.",
  },
];
