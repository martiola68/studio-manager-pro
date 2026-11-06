/** Apre l'unica anagrafica Organi sociali, già filtrata sulla società.
 * Non crea mai una nuova anagrafica all'interno delle pratiche.
 */
export function urlInserimentoOrgano(
  clienteId: string,
  praticaId: string,
  sezione: "soci" | "amministrazione" | "controllo" = "amministrazione",
  ruolo?: string
): string {
  const params = new URLSearchParams({
    cliente_id: String(clienteId || ""),
    apri_modal: sezione,
    ritorno_pratica: String(praticaId || ""),
  });
  if (ruolo) params.set("ruolo", ruolo);
  return `/clienti/organi-sociali?${params.toString()}`;
}
