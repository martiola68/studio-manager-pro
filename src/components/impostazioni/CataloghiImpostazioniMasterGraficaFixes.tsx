export function CataloghiImpostazioniMasterGraficaFixes() {
  return (
    <style jsx global>{`
      /* TIPI PROMEMORIA */
      main.impostazioni-master-page .tipo-promemoria-page span.tipo-promemoria-system-badge,
      main.impostazioni-master-page .tipo-promemoria-page .tipo-promemoria-system-badge {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 86px !important;
        min-height: 24px !important;
        padding: 3px 10px !important;
        border: 1px solid rgb(15 23 42) !important;
        border-radius: 7px !important;
        background: rgb(15 23 42) !important;
        color: rgb(255 255 255) !important;
        -webkit-text-fill-color: rgb(255 255 255) !important;
        opacity: 1 !important;
        visibility: visible !important;
        font-size: .72rem !important;
        font-weight: 700 !important;
        line-height: 1.1 !important;
        box-shadow: none !important;
      }

      main.impostazioni-master-page .tipo-promemoria-page .tipo-promemoria-new-button {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
        -webkit-text-fill-color: white !important;
      }

      main.impostazioni-master-page .tipo-promemoria-page .tipo-promemoria-new-button:hover {
        background: rgb(2 132 199) !important;
        border-color: rgb(2 132 199) !important;
      }

      /* TIPI SCADENZE */
      main.impostazioni-master-page .tipi-scadenze-page span.tipo-origine-system,
      main.impostazioni-master-page .tipi-scadenze-page .tipo-origine-system {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 86px !important;
        min-height: 24px !important;
        padding: 3px 10px !important;
        border: 1px solid rgb(15 23 42) !important;
        border-radius: 7px !important;
        background: rgb(15 23 42) !important;
        color: white !important;
        -webkit-text-fill-color: white !important;
        opacity: 1 !important;
        visibility: visible !important;
        font-size: .72rem !important;
        font-weight: 700 !important;
        line-height: 1.1 !important;
      }

      main.impostazioni-master-page .tipi-scadenze-page span.tipo-origine-personal,
      main.impostazioni-master-page .tipi-scadenze-page .tipo-origine-personal {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 86px !important;
        min-height: 24px !important;
        padding: 3px 10px !important;
        border: 1px solid rgb(252 211 77) !important;
        border-radius: 7px !important;
        background: rgb(254 243 199) !important;
        color: rgb(120 53 15) !important;
        -webkit-text-fill-color: rgb(120 53 15) !important;
        opacity: 1 !important;
        visibility: visible !important;
        font-size: .72rem !important;
        font-weight: 700 !important;
        line-height: 1.1 !important;
      }

      main.impostazioni-master-page .tipi-scadenze-page > div:first-child button,
      main.impostazioni-master-page .tipi-scadenze-page button[class*="bg-primary"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
        -webkit-text-fill-color: white !important;
      }

      main.impostazioni-master-page .tipi-scadenze-page [role="switch"] {
        width: 42px !important;
        min-width: 42px !important;
        height: 24px !important;
        min-height: 24px !important;
        padding: 0 !important;
        border: 1px solid rgb(148 163 184) !important;
        border-radius: 9999px !important;
        background: rgb(203 213 225) !important;
        opacity: 1 !important;
        visibility: visible !important;
        box-shadow: inset 0 0 0 1px rgb(148 163 184 / .18) !important;
      }

      main.impostazioni-master-page .tipi-scadenze-page [role="switch"][data-state="checked"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
      }

      main.impostazioni-master-page .tipi-scadenze-page [role="switch"] > span {
        display: block !important;
        width: 18px !important;
        height: 18px !important;
        border-radius: 9999px !important;
        background: white !important;
        opacity: 1 !important;
        visibility: visible !important;
        box-shadow: 0 1px 3px rgb(15 23 42 / .28) !important;
      }
    `}</style>
  );
}
