export function DipendentiPayrollMasterGraficaEnhancer() {
  return (
    <style jsx global>{`
      .payroll-dipendenti-page {
        background: rgb(241 245 249) !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      .payroll-dipendenti-page > div.mx-auto.max-w-\[1800px\].p-4 {
        width: 100% !important;
        max-width: none !important;
        height: 100% !important;
        min-height: 0 !important;
        padding: 12px !important;
        margin: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
        overflow: hidden !important;
      }

      .payroll-dipendenti-page > div.mx-auto.max-w-\[1800px\].p-4 > div.mb-4 {
        flex: 0 0 auto !important;
        margin: 0 !important;
        padding: 10px 14px !important;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: rgb(248 250 252) !important;
      }

      .payroll-dipendenti-page h1 {
        margin: 0 !important;
        color: rgb(15 23 42) !important;
        font-size: 1.25rem !important;
        line-height: 1.7rem !important;
      }

      .payroll-dipendenti-page > div.mx-auto.max-w-\[1800px\].p-4 > div.mb-4 p {
        margin-top: 2px !important;
        color: rgb(100 116 139) !important;
        font-size: .78rem !important;
      }

      .payroll-dipendenti-page > div.mx-auto.max-w-\[1800px\].p-4 > div.mb-4 button {
        height: 34px !important;
        border-color: rgb(125 211 252) !important;
        background: white !important;
        color: rgb(3 105 161) !important;
      }

      .payroll-dipendenti-page > div.mx-auto.max-w-\[1800px\].p-4 > div:last-child {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .payroll-dipendenti-page > div.mx-auto.max-w-\[1800px\].p-4 > div:last-child > div:first-child {
        flex: 0 0 auto !important;
        padding: 10px 14px !important;
        border-bottom: 1px solid rgb(186 230 253) !important;
      }

      .payroll-dipendenti-page > div.mx-auto.max-w-\[1800px\].p-4 > div:last-child > div:last-child {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        padding: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      .payroll-dipendenti-page .overflow-x-auto.rounded-md.border {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        width: 100% !important;
        height: 100% !important;
        overflow-y: auto !important;
        overflow-x: auto !important;
        border: 0 !important;
        border-radius: 0 !important;
        scrollbar-gutter: stable both-edges !important;
      }

      .payroll-dipendenti-page table {
        width: 100% !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        background: white !important;
        font-size: .72rem !important;
      }

      .payroll-dipendenti-page thead {
        position: sticky !important;
        top: 0 !important;
        z-index: 10 !important;
      }

      .payroll-dipendenti-page thead th {
        padding: 8px 9px !important;
        background: rgb(71 85 105) !important;
        color: white !important;
        border-bottom: 1px solid rgb(51 65 85) !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
      }

      .payroll-dipendenti-page tbody td {
        padding: 7px 9px !important;
        border-bottom: 1px solid rgb(226 232 240) !important;
        background: white !important;
        vertical-align: middle !important;
      }

      .payroll-dipendenti-page tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }

      .payroll-dipendenti-page input:not([type="checkbox"]) {
        height: 32px !important;
        min-height: 32px !important;
        border-color: rgb(203 213 225) !important;
        background: white !important;
        font-size: .75rem !important;
      }

      .payroll-dipendenti-page input[type="checkbox"] {
        accent-color: rgb(3 105 161) !important;
      }

      .payroll-dipendenti-page tbody button {
        height: 32px !important;
        min-height: 32px !important;
        padding: 0 12px !important;
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }
    `}</style>
  );
}
