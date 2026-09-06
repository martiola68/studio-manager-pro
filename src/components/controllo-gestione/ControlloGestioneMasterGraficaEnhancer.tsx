export function ControlloGestioneMasterGraficaEnhancer() {
  return (
    <style jsx global>{`
      .controllo-gestione-master-page {
        background: rgb(241 245 249) !important;
      }

      .controllo-gestione-master-page > div,
      .controllo-gestione-master-page > main {
        width: 100% !important;
        max-width: none !important;
      }

      .controllo-gestione-master-page h1 {
        color: rgb(15 23 42) !important;
        font-size: 1.25rem !important;
        line-height: 1.7rem !important;
      }

      .controllo-gestione-master-page h2,
      .controllo-gestione-master-page h3 {
        color: rgb(15 23 42) !important;
      }

      .controllo-gestione-master-page p {
        color: rgb(100 116 139) !important;
      }

      .controllo-gestione-master-page label {
        color: rgb(51 65 85) !important;
        font-size: .75rem !important;
        font-weight: 600 !important;
      }

      .controllo-gestione-master-page input,
      .controllo-gestione-master-page select,
      .controllo-gestione-master-page textarea {
        min-height: 34px !important;
        border-color: rgb(203 213 225) !important;
        border-radius: 6px !important;
        background: white !important;
        color: rgb(15 23 42) !important;
        font-size: .78rem !important;
      }

      .controllo-gestione-master-page textarea {
        min-height: 90px !important;
      }

      .controllo-gestione-master-page input[type="checkbox"] {
        min-height: auto !important;
        accent-color: rgb(3 105 161) !important;
      }

      .controllo-gestione-master-page button {
        min-height: 34px !important;
        border-radius: 6px !important;
        font-size: .76rem !important;
      }

      .controllo-gestione-master-page button[class*="bg-blue"],
      .controllo-gestione-master-page button[class*="bg-primary"],
      .controllo-gestione-master-page button[type="submit"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .controllo-gestione-master-page button[class*="bg-blue"]:hover,
      .controllo-gestione-master-page button[class*="bg-primary"]:hover,
      .controllo-gestione-master-page button[type="submit"]:hover {
        background: rgb(2 132 199) !important;
      }

      .controllo-gestione-master-page .rounded-xl.border,
      .controllo-gestione-master-page .rounded-lg.border,
      .controllo-gestione-master-page [class*="rounded-xl"][class*="border"],
      .controllo-gestione-master-page [class*="rounded-lg"][class*="border"] {
        border-color: rgb(186 230 253) !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .controllo-gestione-master-page [class*="bg-slate-50"],
      .controllo-gestione-master-page [class*="bg-gray-50"] {
        background: rgb(248 250 252) !important;
      }

      .controllo-gestione-master-page table {
        width: 100% !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        background: white !important;
        font-size: .74rem !important;
      }

      .controllo-gestione-master-page thead th {
        padding: 8px 9px !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(51 65 85) !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
      }

      .controllo-gestione-master-page tbody td {
        padding: 8px 9px !important;
        border-color: rgb(226 232 240) !important;
        background: white !important;
        vertical-align: middle !important;
      }

      .controllo-gestione-master-page tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }

      .controllo-gestione-master-page [role="dialog"] {
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 10px !important;
        background: rgb(248 250 252) !important;
      }

      .controllo-gestione-master-page .bg-green-50,
      .controllo-gestione-master-page [class*="bg-green-50"] {
        background: rgb(240 253 244) !important;
      }

      .controllo-gestione-master-page .bg-red-50,
      .controllo-gestione-master-page [class*="bg-red-50"] {
        background: rgb(254 242 242) !important;
      }

      .controllo-gestione-master-page .bg-amber-50,
      .controllo-gestione-master-page [class*="bg-amber-50"],
      .controllo-gestione-master-page .bg-yellow-50,
      .controllo-gestione-master-page [class*="bg-yellow-50"] {
        background: rgb(254 252 232) !important;
      }

      .controllo-gestione-master-page .bg-blue-50,
      .controllo-gestione-master-page [class*="bg-blue-50"] {
        background: rgb(240 249 255) !important;
      }
    `}</style>
  );
}
