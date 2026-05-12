import ComunicazioniFormPage from "@/components/comunicazioni/ComunicazioniFormPage";

export default function ComunicazioniClientiPage() {
  return (
    <ComunicazioniFormPage
      tipoDefault="singola"
      titolo="Comunicazioni clienti"
      descrizione="Invio comunicazioni singole e avvisi scadenza ai clienti"
      mostraStoricoTipo={["singola", "scadenze"]}
    />
  );
}
