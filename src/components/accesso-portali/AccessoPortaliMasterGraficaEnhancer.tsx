import { useEffect } from "react";

export function AccessoPortaliMasterGraficaEnhancer() {
  useEffect(() => {
    document.body.classList.add("master-grafica-accesso-portali");
    return () => document.body.classList.remove("master-grafica-accesso-portali");
  }, []);

  return (
    <style jsx global>{`
      .accesso-portali-master-page {
        background: rgb(241 245 249);
      }

      .accesso-portali-master-page > div {
        max-width: none !important;
        width: 100% !important;
        height: 100%;
        min-height: 0;
        padding-top: 12px !important;
        padding-bottom: 12px !important;
        display: flex;
        flex-direction: column;
      }

      .accesso-portali-master-page > div > div:first-child {
        flex: 0 0 auto;
        margin-bottom: 10px !important;
        padding: 12px 14px;
        border: 1px solid rgb(186 230 253);
        border-radius: 8px;
        background: rgb(248 250 252);
      }

      .accesso-portali-master-page > div > div:first-child h1 {
        color: rgb(15 23 42) !important;
      }

      .accesso-portali-master-page > div > div:first-child h1 svg {
        color: rgb(3 105 161) !important;
      }

      .accesso-portali-master-page > div > div:first-child button:last-child {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .accesso-portali-master-page > div > div:nth-child(2) {
        flex: 0 0 auto;
        margin-bottom: 10px !important;
        padding: 10px 12px !important;
        border: 1px solid rgb(186 230 253);
        border-radius: 8px;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .accesso-portali-master-page > div > div:nth-child(2) input {
        background: white !important;
        border: 1px solid rgb(203 213 225) !important;
        border-radius: 6px !important;
        padding-left: 12px !important;
      }

      .accesso-portali-master-page > div > div:nth-child(3) {
        min-height: 0;
        flex: 1 1 auto;
        overflow: auto;
        border: 1px solid rgb(186 230 253);
        border-radius: 8px;
        background: white !important;
        box-shadow: none !important;
      }

      .accesso-portali-master-page table {
        width: 100% !important;
        table-layout: fixed;
      }

      .accesso-portali-master-page thead,
      .accesso-portali-master-page thead tr,
      .accesso-portali-master-page thead th {
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(100 116 139) !important;
      }

      .accesso-portali-master-page thead {
        position: sticky;
        top: 0;
        z-index: 30;
      }

      .accesso-portali-master-page tbody tr {
        border-color: rgb(226 232 240) !important;
      }

      .accesso-portali-master-page tbody td {
        padding-top: 6px !important;
        padding-bottom: 6px !important;
      }

      .accesso-portali-master-page tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }

      .accesso-portali-master-page table th:nth-child(1),
      .accesso-portali-master-page table td:nth-child(1) { width: 15%; }
      .accesso-portali-master-page table th:nth-child(2),
      .accesso-portali-master-page table td:nth-child(2) { width: 20%; }
      .accesso-portali-master-page table th:nth-child(3),
      .accesso-portali-master-page table td:nth-child(3) { width: 16%; }
      .accesso-portali-master-page table th:nth-child(4),
      .accesso-portali-master-page table td:nth-child(4) { width: 14%; }
      .accesso-portali-master-page table th:nth-child(5),
      .accesso-portali-master-page table td:nth-child(5) { width: 8%; }
      .accesso-portali-master-page table th:nth-child(6),
      .accesso-portali-master-page table td:nth-child(6) { width: 17%; }
      .accesso-portali-master-page table th:nth-child(7),
      .accesso-portali-master-page table td:nth-child(7) { width: 10%; }

      body.master-grafica-accesso-portali [role="dialog"] {
        width: min(92vw, 860px) !important;
        max-width: 860px !important;
        background: rgb(248 250 252) !important;
        border-color: rgb(186 230 253) !important;
      }

      body.master-grafica-accesso-portali [role="dialog"] input,
      body.master-grafica-accesso-portali [role="dialog"] textarea {
        background: white !important;
        border-color: rgb(203 213 225) !important;
      }

      body.master-grafica-accesso-portali [role="dialog"] button[type="submit"],
      body.master-grafica-accesso-portali [role="dialog"] button:last-child {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }
    `}</style>
  );
}
