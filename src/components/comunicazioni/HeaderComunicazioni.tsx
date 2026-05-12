interface HeaderComunicazioniProps {
  titolo: string;
  descrizione: string;
}

export default function HeaderComunicazioni({
  titolo,
  descrizione,
}: HeaderComunicazioniProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900">
        {titolo}
      </h1>

      <p className="mt-1 text-gray-500">
        {descrizione}
      </p>
    </div>
  );
}
