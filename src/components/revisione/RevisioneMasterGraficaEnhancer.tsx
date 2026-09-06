export function RevisioneMasterGraficaEnhancer() {
  return (
    <style jsx global>{`
      .revisione-master-page {
        background: rgb(241 245 249) !important;
      }

      .revisione-master-page > div,
      .revisione-master-page > main {
        width: 100% !important;
        max-width: none !important;
      }

      .revisione-master-page h1 {
        color: rgb(15 23 42) !important;
        font-size: 1.25rem !important;
        line-height: 1.7rem !important;
      }

      .revisione-master-page h2,
      .revisione-master-page h3 {
        color: rgb(15 23 42) !important;
      }

      .revisione-master-page p {
        color: rgb(100 116 139) !important;
      }

      .revisione-master-page label {
        color: rgb(51 65 85) !important;
        font-size: .75rem !important;
        font-weight: 600 !important;
      }

      .revisione-master-page input,
      .revisione-master-page select,
      .revisione-master-page textarea {
        min-height: 34px !important;
        border-color: rgb(203 213 225) !important;
        border-radius: 6px !important;
        background: white !important;
        color: rgb(15 23 42) !important;
        font-size: .78rem !important;
      }

      .revisione-master-page textarea {
        min-height: 90px !important;
      }

      .revisione-master-page input[type="checkbox"] {
        min-height: auto !important;
        accent-color: rgb(3 105 161) !important;
      }

      .revisione-master-page button {
        min-height: 34px !important;
        border-radius: 6px !important;
        font-size: .76rem !important;
      }

      .revisione-master-page button[class*="bg-blue"],
      .revisione-master-page button[class*="bg-primary"],
      .revisione-master-page button[type="submit"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .revisione-master-page button[class*="bg-blue"]:hover,
      .revisione-master-page button[class*="bg-primary"]:hover,
      .revisione-master-page button[type="submit"]:hover {
        background: rgb(2 132 199) !important;
      }

      .revisione-master-page .rounded-xl.border,
      .revisione-master-page .rounded-lg.border,
      .revisione-master-page [class*="rounded-xl"][class*="border"],
      .revisione-master-page [class*="rounded-lg"][class*="border"] {
        border-color: rgb(186 230 253) !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .revisione-master-page [class*="bg-slate-50"],
      .revisione-master-page [class*="bg-gray-50"] {
        background: rgb(248 250 252) !important;
      }

      .revisione-master-page [class*="border-sky-200"],
      .revisione-master-page [class*="border-blue-200"] {
        border-color: rgb(186 230 253) !important;
      }

      .revisione-master-page table {
        width: 100% !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        background: white !important;
        font-size: .74rem !important;
      }

      .revisione-master-page thead th {
        padding: 8px 9px !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(51 65 85) !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
      }

      .revisione-master-page tbody td {
        padding: 8px 9px !important;
        border-color: rgb(226 232 240) !important;
        background: white !important;
        vertical-align: middle !important;
      }

      .revisione-master-page tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }

      .revisione-master-page [role="dialog"] {
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 10px !important;
        background: rgb(248 250 252) !important;
      }

      .revisione-master-page [role="dialog"] input,
      .revisione-master-page [role="dialog"] select,
      .revisione-master-page [role="dialog"] textarea {
        background: white !important;
        border-color: rgb(203 213 225) !important;
      }

      .revisione-master-page .bg-green-50,
      .revisione-master-page [class*="bg-green-50"] {
        background: rgb(240 253 244) !important;
      }

      .revisione-master-page .bg-red-50,
      .revisione-master-page [class*="bg-red-50"] {
        background: rgb(254 242 242) !important;
      }

      .revisione-master-page .bg-amber-50,
      .revisione-master-page [class*="bg-amber-50"],
      .revisione-master-page .bg-yellow-50,
      .revisione-master-page [class*="bg-yellow-50"] {
        background: rgb(254 252 232) !important;
      }

      .revisione-master-page .bg-blue-50,
      .revisione-master-page [class*="bg-blue-50"] {
        background: rgb(240 249 255) !important;
      }
    `}</style>
  );
}
