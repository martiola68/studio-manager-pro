export function isCompanyClient(cliente: any): boolean {
  return String(cliente?.tipo_cliente || "").trim().toLowerCase() !== "persona fisica";
}
