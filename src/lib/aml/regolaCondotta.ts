/**
 * Regole della sola prestazione AML a rischio NON significativo con una
 * regola di condotta esplicita. Non si applicano alle altre prestazioni.
 */
export function isNonSignificativoConRegola(value: { RischioTipoPrestAR?: string | null; RegolaDiCondotta?: string | null } | null | undefined): boolean {
  const rischio = String(value?.RischioTipoPrestAR || "").trim().toLocaleLowerCase("it");
  return rischio === "non significativo" && Boolean(String(value?.RegolaDiCondotta || "").trim());
}

export type DocumentoCondotta = {
  tipo_documento?: string | null;
  nome_file?: string | null;
  origine?: string | null;
};
const normalize = (s: unknown) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("it").trim();

export function isVisuraCondotta(doc: DocumentoCondotta): boolean {
  return [doc.tipo_documento, doc.nome_file, doc.origine].some(value => normalize(value).includes("visura"));
}
export function isVerbaleCondotta(doc: DocumentoCondotta): boolean {
  return [doc.tipo_documento, doc.nome_file, doc.origine].some(value => normalize(value).includes("verbale"));
}
export function missingDocumentiCondotta(docs: DocumentoCondotta[]): string[] {
  const missing: string[] = [];
  if (!docs.some(isVisuraCondotta)) missing.push("Visura camerale");
  if (!docs.some(isVerbaleCondotta)) missing.push("Verbale previsto dalla regola di condotta");
  return missing;
}
