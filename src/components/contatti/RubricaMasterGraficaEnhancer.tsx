import { useEffect } from "react";

export function RubricaMasterGraficaEnhancer() {
  useEffect(() => {
    document.body.classList.add("master-grafica-rubrica");
    return () => document.body.classList.remove("master-grafica-rubrica");
  }, []);

  return (
    <style jsx global>{`
      .rubrica-master-page {
        background: rgb(241 245 249);
      }

      .rubrica-master-page > div {
        width: 100% !important;
        max-width: none !important;
        height: 100%;
        min-height: 0;
        padding-top: 12px !important;
        padding-bottom: 12px !important;
        display: flex;
        flex-direction: column;
      }

      /* Testata Rubrica */
      .rubrica-master-page > div > div:first-child {
        flex: 0 0 auto;
        position: static !important;
        top: auto !important;
        z-index: auto !important;
        margin-bottom: 10px !important;
        padding: 10px 14px !important;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: rgb(248 250 252) !important;
      }

      .rubrica-master-page > div > div:first-child h1 {
        color: rgb(15 23 42) !important;
        font-size: 1.5rem !important;
        line-height: 2rem !important;
      }

      .rubrica-master-page > div > div:first-child p {
        font-size: .875rem !important;
        color: rgb(100 116 139) !important;
      }

      .rubrica-master-page > div > div:first-child button[class*="bg-blue-600"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .rubrica-master-page > div > div:first-child button[class*="border-green-600"] {
        background: white !important;
        border-color: rgb(3 105 161) !important;
        color: rgb(3 105 161) !important;
      }

      /* Ricerca e indice alfabetico compatti */
      .rubrica-master-page > div > div:nth-child(2) {
        flex: 0 0 auto;
        margin-bottom: 10px !important;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .rubrica-master-page > div > div:nth-child(2) > div:first-child {
        padding: 9px 14px 4px !important;
      }

      .rubrica-master-page > div > div:nth-child(2) > div:nth-child(2) {
        padding: 6px 14px 10px !important;
      }

      .rubrica-master-page > div > div:nth-child(2) input {
        height: 34px !important;
        background: white !important;
        border-color: rgb(203 213 225) !important;
      }

      .rubrica-master-page > div > div:nth-child(2) button {
        width: 32px !important;
        min-width: 32px !important;
        height: 30px !important;
        padding: 0 !important;
        background: white !important;
        border-color: rgb(125 211 252) !important;
        color: rgb(3 105 161) !important;
      }

      .rubrica-master-page > div > div:nth-child(2) button[class*="bg-red-600"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .rubrica-master-page > div > div:nth-child(2) button:first-child {
        width: 52px !important;
        min-width: 52px !important;
      }

      /* Area rubrica: due pagine come un'agenda aperta */
      .rubrica-master-page > div > div.space-y-6 {
        position: relative;
        min-height: 0;
        flex: 1 1 auto;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        align-content: start;
        gap: 14px 30px !important;
        margin: 0 !important;
        overflow-y: auto;
        padding: 10px 18px 18px !important;
        border: 1px solid rgb(186 230 253);
        border-radius: 8px;
        background:
          linear-gradient(90deg,
            rgb(255 255 255) 0%,
            rgb(255 255 255) calc(50% - 15px),
            rgb(226 232 240) calc(50% - 2px),
            rgb(148 163 184) 50%,
            rgb(226 232 240) calc(50% + 2px),
            rgb(255 255 255) calc(50% + 15px),
            rgb(255 255 255) 100%);
        box-shadow: inset 10px 0 18px -22px rgb(15 23 42), inset -10px 0 18px -22px rgb(15 23 42);
      }

      .rubrica-master-page > div > div.space-y-6 > div {
        margin: 0 !important;
        border: 1px solid rgb(203 213 225) !important;
        border-radius: 7px !important;
        box-shadow: 0 1px 2px rgb(15 23 42 / .06) !important;
        background: white !important;
      }

      .rubrica-master-page > div > div.space-y-6 > div > div:first-child {
        padding: 7px 12px !important;
        background: rgb(71 85 105) !important;
        color: white !important;
      }

      .rubrica-master-page > div > div.space-y-6 > div > div:first-child h3,
      .rubrica-master-page > div > div.space-y-6 > div > div:first-child span {
        color: white !important;
      }

      .rubrica-master-page > div > div.space-y-6 > div > div:first-child h3 {
        font-size: .875rem !important;
      }

      /* Righe contatti più da rubrica/agenda */
      .rubrica-master-page > div > div.space-y-6 > div > div:nth-child(2) > div {
        padding: 8px 12px !important;
        min-height: 52px;
        border-color: rgb(226 232 240) !important;
      }

      .rubrica-master-page > div > div.space-y-6 > div > div:nth-child(2) > div:hover {
        background: rgb(240 249 255) !important;
      }

      .rubrica-master-page > div > div.space-y-6 .text-xl {
        font-size: .9rem !important;
        line-height: 1.25rem !important;
      }

      .rubrica-master-page > div > div.space-y-6 .text-base {
        font-size: .75rem !important;
        line-height: 1rem !important;
      }

      .rubrica-master-page > div > div.space-y-6 svg {
        width: 15px !important;
        height: 15px !important;
      }

      /* Manteniamo gli avvisi NO CLIENTE_ID ma meno invasivi */
      .rubrica-master-page > div > div.space-y-6 .bg-red-100 {
        background: rgb(254 242 242) !important;
      }

      .rubrica-master-page > div > div.space-y-6 .bg-red-600 {
        background: rgb(220 38 38) !important;
      }

      body.master-grafica-rubrica [role="dialog"] {
        width: min(94vw, 980px) !important;
        max-width: 980px !important;
        background: rgb(248 250 252) !important;
        border-color: rgb(186 230 253) !important;
      }

      body.master-grafica-rubrica [role="dialog"] input,
      body.master-grafica-rubrica [role="dialog"] textarea,
      body.master-grafica-rubrica [role="dialog"] select {
        background: white !important;
        border-color: rgb(203 213 225) !important;
      }

      @media (max-width: 1100px) {
        .rubrica-master-page > div > div.space-y-6 {
          grid-template-columns: 1fr;
          background: white;
          padding: 10px !important;
        }
      }
    `}</style>
  );
}
