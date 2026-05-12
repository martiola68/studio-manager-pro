import ComunicazioniFormPage from "@/components/comunicazioni/ComunicazioniFormPage";

export default function ComunicazioniInternePage() {
  return (
    <ComunicazioniFormPage
      tipoDefault="interna"
      titolo="Comunicazioni interne"
      descrizione="Invio comunicazioni agli utenti dello studio"
      mostraStoricoTipo="interna"
    />
  );
}
