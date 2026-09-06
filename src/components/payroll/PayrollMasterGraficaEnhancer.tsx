export function PayrollMasterGraficaEnhancer() {
  return (
    <style jsx global>{`
      .presenze-page {
        background: rgb(241 245 249) !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      .presenze-page > div {
        width: 100% !important;
        max-width: none !important;
        height: 100% !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 12px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
        overflow: hidden !important;
      }

      .presenze-page > div > div:first-child {
        flex: 0 0 auto !important;
        padding: 10px 14px !important;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: rgb(248 250 252) !important;
      }

      .presenze-page h1 {
        margin: 0 !important;
        color: rgb(15 23 42) !important;
        font-size: 1.25rem !important;
        line-height: 1.7rem !important;
      }

      .presenze-page h2,
      .presenze-page h3 {
        color: rgb(15 23 42) !important;
      }

      .presenze-page > div > div:first-child p {
        margin-top: 2px !important;
        color: rgb(100 116 139) !important;
        font-size: .78rem !important;
      }

      .presenze-page button {
        min-height: 34px !important;
        border-radius: 6px !important;
        font-size: .76rem !important;
      }

      .presenze-page button[class*="bg-blue"],
      .presenze-page button[class*="bg-primary"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .presenze-page input,
      .presenze-page select,
      .presenze-page textarea {
        min-height: 34px !important;
        border-color: rgb(203 213 225) !important;
        border-radius: 6px !important;
        background: white !important;
        color: rgb(15 23 42) !important;
        font-size: .78rem !important;
      }

      .presenze-page label {
        color: rgb(51 65 85) !important;
        font-size: .72rem !important;
        font-weight: 600 !important;
      }

      .presenze-page .rounded-xl.border.bg-card,
      .presenze-page .rounded-lg.border.bg-card,
      .presenze-page [class*="rounded-xl"][class*="border"] {
        border-color: rgb(186 230 253) !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .presenze-page [class*="border-blue-200"],
      .presenze-page [class*="bg-blue-50"] {
        border-color: rgb(186 230 253) !important;
        background: rgb(240 249 255) !important;
      }

      .presenze-page table {
        border-collapse: separate !important;
        border-spacing: 0 !important;
        background: white !important;
        font-size: .72rem !important;
      }

      .presenze-page thead {
        position: sticky !important;
        top: 0 !important;
        z-index: 8 !important;
      }

      .presenze-page thead th {
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(51 65 85) !important;
        font-weight: 700 !important;
      }

      .presenze-page tbody td {
        border-color: rgb(226 232 240) !important;
        background: white !important;
      }

      .presenze-page tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }

      .presenze-page [role="dialog"] {
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 10px !important;
        background: rgb(248 250 252) !important;
      }

      .presenze-page [role="dialog"] button[class*="bg-blue"],
      .presenze-page [role="dialog"] button[class*="bg-primary"] {
        background: rgb(3 105 161) !important;
        color: white !important;
      }
    `}</style>
  );
}
