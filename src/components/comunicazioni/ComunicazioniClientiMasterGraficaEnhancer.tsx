import { useEffect } from "react";

export function ComunicazioniClientiMasterGraficaEnhancer() {
  useEffect(() => {
    document.body.classList.add("master-grafica-comunicazioni-clienti");
    return () => document.body.classList.remove("master-grafica-comunicazioni-clienti");
  }, []);

  return (
    <style jsx global>{`
      .comunicazioni-clienti-master-page {
        background: rgb(241 245 249);
      }

      .comunicazioni-clienti-master-page > div {
        width: 100% !important;
        max-width: none !important;
        height: 100%;
        min-height: 0;
        padding-top: 12px !important;
        padding-bottom: 12px !important;
        display: flex;
        flex-direction: column;
      }

      /* Header pagina */
      .comunicazioni-clienti-master-page > div > div:first-child {
        flex: 0 0 auto;
        margin-bottom: 10px !important;
        padding: 10px 14px;
        border: 1px solid rgb(186 230 253);
        border-radius: 8px;
        background: rgb(248 250 252);
      }

      .comunicazioni-clienti-master-page > div > div:first-child h1 {
        color: rgb(15 23 42) !important;
        font-size: 1.5rem !important;
        line-height: 2rem !important;
      }

      .comunicazioni-clienti-master-page > div > div:first-child p {
        margin-top: 2px !important;
        color: rgb(100 116 139) !important;
        font-size: .875rem !important;
      }

      /* Contenuto: form + storico */
      .comunicazioni-clienti-master-page > div > .space-y-5 {
        min-height: 0;
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 10px !important;
      }

      /* Card nuova comunicazione */
      .comunicazioni-clienti-master-page > div > .space-y-5 > div:first-child {
        flex: 0 0 auto;
        margin: 0 !important;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .comunicazioni-clienti-master-page > div > .space-y-5 > div:first-child > div:first-child {
        padding: 10px 14px 6px !important;
      }

      .comunicazioni-clienti-master-page > div > .space-y-5 > div:first-child > div:first-child h3 {
        font-size: .95rem !important;
        color: rgb(30 41 59) !important;
      }

      .comunicazioni-clienti-master-page > div > .space-y-5 > div:first-child > div:nth-child(2) {
        padding: 8px 14px 12px !important;
        gap: 10px !important;
      }

      .comunicazioni-clienti-master-page label {
        color: rgb(51 65 85) !important;
        font-size: .75rem !important;
        font-weight: 600 !important;
      }

      .comunicazioni-clienti-master-page input,
      .comunicazioni-clienti-master-page textarea,
      .comunicazioni-clienti-master-page button[role="combobox"] {
        background: white !important;
        border-color: rgb(203 213 225) !important;
      }

      .comunicazioni-clienti-master-page input,
      .comunicazioni-clienti-master-page button[role="combobox"] {
        height: 34px !important;
      }

      .comunicazioni-clienti-master-page textarea {
        min-height: 118px !important;
        height: 118px !important;
      }

      /* Pulsanti template: attivo blu SMP, inattivi bianchi bordati blu */
      .comunicazioni-clienti-master-page button.bg-primary,
      .comunicazioni-clienti-master-page button[class*="bg-blue-600"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .comunicazioni-clienti-master-page button.border-input {
        background: white !important;
        border-color: rgb(125 211 252) !important;
        color: rgb(3 105 161) !important;
      }

      .comunicazioni-clienti-master-page button.border-input:hover {
        background: rgb(240 249 255) !important;
      }

      /* Storico compatto e scrollabile nella parte residua */
      .comunicazioni-clienti-master-page > div > .space-y-5 > div:last-child {
        min-height: 0;
        flex: 1 1 auto;
        margin: 0 !important;
        overflow: auto;
        border-color: rgb(186 230 253) !important;
        border-radius: 8px !important;
        box-shadow: none !important;
        background: white !important;
      }

      .comunicazioni-clienti-master-page table thead,
      .comunicazioni-clienti-master-page table thead tr,
      .comunicazioni-clienti-master-page table thead th {
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(100 116 139) !important;
      }

      .comunicazioni-clienti-master-page table thead {
        position: sticky;
        top: 0;
        z-index: 30;
      }

      .comunicazioni-clienti-master-page table tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }

      body.master-grafica-comunicazioni-clienti [role="dialog"] {
        background: rgb(248 250 252) !important;
        border-color: rgb(186 230 253) !important;
      }
    `}</style>
  );
}
