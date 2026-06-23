export async function generaDocumentoPratica({
  praticaId,
  codiceModello,
  onSuccess,
}: {
  praticaId: string;
  codiceModello: string;
  onSuccess?: () => Promise<void> | void;
}) {
  const res = await fetch(`/api/pratiche/${praticaId}/genera-documento`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      codice_modello: codiceModello,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Errore generazione documento");
  }

  if (onSuccess) {
    await onSuccess();
  }

  return data;
}
