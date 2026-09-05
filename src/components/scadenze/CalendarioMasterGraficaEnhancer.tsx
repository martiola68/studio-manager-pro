export function CalendarioMasterGraficaEnhancer() {
  return (
    <style jsx global>{`
      .calendario-master-page {
        background: rgb(241 245 249);
      }

      .calendario-master-page > div.space-y-6 {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        grid-template-rows: auto auto auto minmax(0, 1fr);
        gap: 12px !important;
        height: 100%;
        min-height: 0;
        padding-top: 12px;
      }

      .calendario-master-page > div.space-y-6 > div:first-child {
        grid-column: 1 / -1;
        border: 1px solid rgb(186 230 253);
        border-radius: 8px;
        background: rgb(248 250 252);
        padding: 12px 16px;
      }

      .calendario-master-page > div.space-y-6 > div:first-child h1 {
        font-size: 1.5rem !important;
        line-height: 2rem !important;
        color: rgb(15 23 42) !important;
      }

      .calendario-master-page > div.space-y-6 > div:first-child p {
        margin-top: 2px !important;
        font-size: 0.875rem !important;
        color: rgb(100 116 139) !important;
      }

      .calendario-master-page > div.space-y-6 > div:first-child button {
        display: none !important;
      }

      .calendario-master-page > div.space-y-6 > div:nth-child(2),
      .calendario-master-page > div.space-y-6 > div:nth-child(3),
      .calendario-master-page > div.space-y-6 > div:nth-child(4),
      .calendario-master-page > div.space-y-6 > div:nth-child(5) {
        margin: 0 !important;
        min-width: 0;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: white !important;
        box-shadow: none !important;
      }

      .calendario-master-page > div.space-y-6 > div:nth-child(2) > div,
      .calendario-master-page > div.space-y-6 > div:nth-child(3) > div,
      .calendario-master-page > div.space-y-6 > div:nth-child(4) > div,
      .calendario-master-page > div.space-y-6 > div:nth-child(5) > div {
        padding-top: 10px !important;
        padding-bottom: 10px !important;
      }

      .calendario-master-page > div.space-y-6 > div:nth-child(2) {
        border-left: 4px solid rgb(3 105 161) !important;
      }
      .calendario-master-page > div.space-y-6 > div:nth-child(3) {
        border-left: 4px solid rgb(220 38 38) !important;
      }
      .calendario-master-page > div.space-y-6 > div:nth-child(4) {
        border-left: 4px solid rgb(234 88 12) !important;
      }
      .calendario-master-page > div.space-y-6 > div:nth-child(5) {
        border-left: 4px solid rgb(202 138 4) !important;
      }

      .calendario-master-page > div.space-y-6 > div:nth-child(6) {
        grid-column: 1 / -1;
        margin: 0 !important;
        border: 1px solid rgb(186 230 253);
        border-radius: 8px;
        background: rgb(248 250 252);
        padding: 10px 12px;
      }

      .calendario-master-page > div.space-y-6 > div:nth-child(6) button {
        height: 36px;
        background: white;
        border-color: rgb(203 213 225);
      }

      .calendario-master-page > div.space-y-6 > div:nth-child(7) {
        grid-column: 1 / -1;
        min-height: 0;
        height: 100%;
        margin: 0 !important;
        overflow: hidden;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: white !important;
        box-shadow: none !important;
      }

      .calendario-master-page > div.space-y-6 > div:nth-child(7) > div {
        height: 100%;
        min-height: 0;
      }

      .calendario-master-page > div.space-y-6 > div:nth-child(7) .relative.w-full.overflow-auto {
        max-height: none !important;
        height: 100%;
        min-height: 0;
        overflow: auto !important;
      }

      .calendario-master-page table thead,
      .calendario-master-page table thead tr,
      .calendario-master-page table thead th {
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(100 116 139) !important;
      }

      .calendario-master-page table thead {
        position: sticky;
        top: 0;
        z-index: 30;
      }

      .calendario-master-page table th,
      .calendario-master-page table td {
        padding-top: 8px !important;
        padding-bottom: 8px !important;
      }

      .calendario-master-page table tbody tr:hover {
        background: rgb(240 249 255) !important;
      }

      .calendario-master-page table tbody td:first-child {
        font-weight: 600;
      }

      @media (max-width: 1100px) {
        .calendario-master-page > div.space-y-6 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `}</style>
  );
}
