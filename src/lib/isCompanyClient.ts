export function isCompanyClient(cliente: any): boolean {
  const tipo = String(cliente?.tipo_cliente || "").trim().toLowerCase();
  if (tipo === "persona fisica") return false;

  const cf = String(cliente?.codice_fiscale || "").trim().toUpperCase();

  // La persona fisica va esclusa SEMPRE, anche quando possiede una P.IVA.
  if (/^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(cf)) return false;

  const piva = String(cliente?.partita_iva || "").replace(/\s+/g, "");
  if (/^[0-9]{11}$/.test(piva)) return true;

  if (/^[0-9]{11}$/.test(cf)) return true;

  const cognome = String(cliente?.cognome || "").trim();
  const nome = String(cliente?.nome || "").trim();
  if (cognome || nome) return false;

  const rs = String(cliente?.ragione_sociale || "").trim().toUpperCase();
  if (!rs) return false;

  const companyTokens = [
    " S.R.L", " SRL", " S.P.A", " SPA", " S.A.S", " SAS", " S.N.C", " SNC",
    " S.S.", " SOCIETA", " SOCIETÀ", " COOP", " COOPERATIVA", " CONSORZIO",
    " ASSOCIAZIONE", " FONDAZIONE", " ENTE ", " ONLUS", " ETS", " STP",
    " STUDIO ASSOCIATO", " CONDOMINIO", " IMPRESA", " AZIENDA", " HOLDING",
    " GROUP", " GRUPPO", " HOTEL", " INDUSTRIE", " SERVIZI", " IMMOBILIARE"
  ];

  return companyTokens.some((token) => rs.includes(token));
}
