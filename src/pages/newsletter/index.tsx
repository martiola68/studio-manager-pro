import ComunicazioniFormPage from "@/components/comunicazioni/ComunicazioniFormPage";

export default function NewsletterPage() {
  return (
    <ComunicazioniFormPage
      tipoDefault="newsletter"
      titolo="Newsletter"
      descrizione="Invio newsletter ai clienti iscritti"
      mostraStoricoTipo="newsletter"
    />
  );
}
