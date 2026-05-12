type TipoComunicazione = "newsletter" | "scadenze" | "singola" | "interna";

interface ComunicazioniFormPageProps {
  tipoDefault: TipoComunicazione;
  titolo: string;
  descrizione: string;
  mostraStoricoTipo: TipoComunicazione | TipoComunicazione[];
}

export default function ComunicazioniFormPage({
  titolo,
  descrizione,
}: ComunicazioniFormPageProps) {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{titolo}</h1>
        <p className="text-gray-500 mt-1">{descrizione}</p>
      </div>
    </div>
  );
}
