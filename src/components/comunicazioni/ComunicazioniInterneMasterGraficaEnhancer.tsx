import { useEffect } from "react";

export function ComunicazioniInterneMasterGraficaEnhancer() {
  useEffect(() => {
    document.body.classList.add("master-grafica-comunicazioni-interne");
    return () => document.body.classList.remove("master-grafica-comunicazioni-interne");
  }, []);

  return (
    <style jsx global>{`
      .comunicazioni-interne-master-page {
        background: rgb(241 245 249);
      }

      .comunicazioni-interne-master-page > div {
        width: 100% !important;
        max-width: none !important;
        height: 100%;
        min-height: 0;
        padding-top: 12px !important;
        padding-bottom: 12px !important;
        display: flex;
        flex-direction: column;
      }

      .comunicazioni-interne-master-page > div > div:first-child {
        flex: 0 0 auto;
        margin-bottom: 10px !important;
        padding: 10px 14px;
        border: 1px solid rgb(186 230 253);
        border-radius: 8px;
        background: rgb(248 250 252);
      }

      .comunicazioni-interne-master-page > div > div:first-child h1 {
        color: rgb(15 23 42) !important;
        font-size: 1.5rem !important;
        line-height: 2rem !important;
      }

      .comunicazioni-interne-master-page > div > div:first-child p {
        margin-top: 2px !important;
        color: rgb(100 116 139) !important;
        font-size: .875rem !important;
      }

      .comunicazioni-interne-master-page > div > .space-y-5 {
        min-height: 0;
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 10px !important;
      }

      .comunicazioni-interne-master-page > div > .space-y-5 > div:first-child {
        flex: 0 0 auto;
        margin: 0 !important;
        border: 1px solid rgb(186 230 253) !important;
        border-radius: 8px !important;
        background: rgb(248 250 252) !important;
        box-shadow: none !important;
      }

      .comunicazioni-interne-master-page > div > .space-y-5 > div:first-child > div:first-child {
        padding: 10px 14px 6px !important;
      }

      .comunicazioni-interne-master-page > div > .space-y-5 > div:first-child > div:first-child h3 {
        font-size: .95rem !important;
        color: rgb(30 41 59) !important;
      }

      .comunicazioni-interne-master-page > div > .space-y-5 > div:first-child > div:nth-child(2) {
        padding: 8px 14px 12px !important;
        gap: 10px !important;
      }

      .comunicazioni-interne-master-page label {
        color: rgb(51 65 85) !important;
        font-size: .75rem !important;
        font-weight: 600 !important;
      }

      .comunicazioni-interne-master-page input,
      .comunicazioni-interne-master-page textarea {
        background: white !important;
        border-color: rgb(203 213 225) !important;
      }

      .comunicazioni-interne-master-page input {
        height: 34px !important;
      }

      .comunicazioni-interne-master-page textarea {
        min-height: 120px !important;
        height: 120px !important;
      }

      .comunicazioni-interne-master-page button[class*="bg-blue-600"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .comunicazioni-interne-master-page button.border-input {
        background: white !important;
        border-color: rgb(125 211 252) !important;
        color: rgb(3 105 161) !important;
      }

      .comunicazioni-interne-master-page button.border-input:hover {
        background: rgb(240 249 255) !important;
      }

      .comunicazioni-interne-master-page [data-state="checked"] {
        background: rgb(3 105 161) !important;
        border-color: rgb(3 105 161) !important;
        color: white !important;
      }

      .comunicazioni-interne-master-page .max-h-\[150px\] {
        max-height: 138px !important;
        background: white;
        border-color: rgb(203 213 225) !important;
      }

      .comunicazioni-interne-master-page .max-h-\[150px\] label {
        min-height: 31px;
        padding-top: 5px !important;
        padding-bottom: 5px !important;
      }

      .comunicazioni-interne-master-page > div > .space-y-5 > div:last-child {
        min-height: 0;
        flex: 1 1 auto;
        margin: 0 !important;
        overflow: auto;
        border-color: rgb(186 230 253) !important;
        border-radius: 8px !important;
        box-shadow: none !important;
        background: white !important;
      }

      .comunicazioni-interne-master-page table thead,
      .comunicazioni-interne-master-page table thead tr,
      .comunicazioni-interne-master-page table thead th {
        background: rgb(71 85 105) !important;
        color: white !important;
        border-color: rgb(100 116 139) !important;
      }

      .comunicazioni-interne-master-page table thead {
        position: sticky;
        top: 0;
        z-index: 30;
      }

      .comunicazioni-interne-master-page table tbody tr:hover td {
        background: rgb(240 249 255) !important;
      }
    `}</style>
  );
}
