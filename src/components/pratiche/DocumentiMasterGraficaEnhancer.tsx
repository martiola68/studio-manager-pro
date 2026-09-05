export function DocumentiMasterGraficaEnhancer() {
  return (
    <style jsx global>{`
      .pratiche-documenti-master-page {
        background: rgb(241 245 249) !important;
      }

      .pratiche-documenti-master-page > main {
        width: 100% !important;
        max-width: none !important;
        min-height: 100% !important;
        padding: 12px !important;
        background: rgb(241 245 249) !important;
      }

      .pratiche-documenti-master-page > main > div {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
      }

      .pratiche-documenti-master-page > main > div > div:first-child {
        margin-bottom: 10px !important;
        padding: 10px 14px !important;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: rgb(248 250 252) !important;
      }

      .pratiche-documenti-master-page h1 {
        margin-top: 6px !important;
        color: rgb(15 23 42) !important;
        font-size: 1.25rem !important;
        line-height: 1.75rem !important;
      }

      .pratiche-documenti-master-page h2 {
        color: rgb(15 23 42) !important;
        font-size: 1rem !important;
      }

      .pratiche-documenti-master-page p {
        color: rgb(100 116 139) !important;
        font-size: .8rem !important;
      }

      .pratiche-documenti-master-page a {
        color: rgb(3 105 161) !important;
      }

      .pratiche-documenti-master-page form,
      .pratiche-documenti-master-page form + div,
      .pratiche-documenti-master-page div[style*="background: rgb(255, 255, 255)"],
      .pratiche-documenti-master-page div[style*="background: #fff"] {
        border-color: rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .pratiche-documenti-master-page form {
        padding: 14px !important;
      }

      .pratiche-documenti-master-page label {
        color: rgb(51 65 85) !important;
        font-size: .75rem !important;
        font-weight: 600 !important;
      }

      .pratiche-documenti-master-page input,
      .pratiche-documenti-master-page select,
      .pratiche-documenti-master-page textarea {
        min-height: 34px !important;
        padding: 7px 9px !important;
        border: 1px solid rgb(203 213 225) !important;
        border-radius: 6px !important;
        background: white !important;
        color: rgb(15 23 42) !important;
        font-size: .8rem !important;
      }

      .pratiche-documenti-master-page textarea {
        min-height: 120px !important;
      }

      .pratiche-documenti-master-page input[type="checkbox"] {
        min-height: auto !important;
        accent-color: rgb(3 105 161) !important;
      }

      .pratiche-documenti-master-page button {
        min-height: 34px !important;
        border-radius: 6px !important;
        font-size: .78rem !important;
      }

      .pratiche-documenti-master-page button[type="submit"] {
        background: rgb(3 105 161) !important;
        color: white !important;
        border-color: rgb(3 105 161) !important;
      }

      .pratiche-documenti-master-page button[type="submit"]:hover {
        background: rgb(2 132 199) !important;
      }

      .pratiche-documenti-master-page table {
        width: 100% !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        background: white !important;
        font-size: .76rem !important;
      }

      .pratiche-documenti-master-page thead {
        position: sticky !important;
        top: 0 !important;
        z-index: 4 !important;
      }

      .pratiche-documenti-master-page thead th {
        padding: 8px 10px !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        border-bottom: 1px solid rgb(51 65 85) !important;
        font-size: .72rem !important;
        font-weight: 700 !important;
        text-transform: none !important;
      }

      .pratiche-documenti-master-page tbody td {
        padding: 8px 10px !important;
        border-bottom: 1px solid rgb(226 232 240) !important;
        color: rgb(15 23 42) !important;
        background: white !important;
        vertical-align: middle !important;
      }

      .pratiche-documenti-master-page tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }

      .pratiche-documenti-master-page tbody button {
        color: rgb(3 105 161) !important;
      }

      .pratiche-documenti-master-page tbody button:last-child {
        color: rgb(220 38 38) !important;
      }

      .pratiche-documenti-master-page [style*="display: grid"] {
        gap: 12px !important;
      }
    `}</style>
  );
}
