import { useEffect } from "react";

const GENERAL_SYSTEM_ADMIN_EMAIL = "m.artiola@revisionicommerciali.it";

export function GestioneUtentiMasterGraficaFixes() {
  useEffect(() => {
    let frame = 0;

    const applyGeneralAdminGuard = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.querySelectorAll('[role="dialog"]').forEach((dialog) => {
          const emailInput = dialog.querySelector('input[type="email"]') as HTMLInputElement | null;
          const allowed =
            String(emailInput?.value || "").trim().toLowerCase() === GENERAL_SYSTEM_ADMIN_EMAIL;

          const label = Array.from(dialog.querySelectorAll("label")).find(
            (node) => (node.textContent || "").trim() === "Amministratore generale di sistema"
          ) as HTMLLabelElement | undefined;

          if (!label) return;
          const wrapper = label.parentElement;
          const checkbox = wrapper?.querySelector('[role="checkbox"]') as HTMLButtonElement | null;
          if (!checkbox) return;

          if (!allowed) {
            if (checkbox.getAttribute("data-state") === "checked") checkbox.click();
            checkbox.disabled = true;
            checkbox.setAttribute("aria-disabled", "true");
            checkbox.style.setProperty("opacity", ".4", "important");
            checkbox.style.setProperty("cursor", "not-allowed", "important");
            label.style.setProperty("opacity", ".55", "important");
            label.style.setProperty("cursor", "not-allowed", "important");
            label.title = "Disponibile esclusivamente per Mario Artiola - m.artiola@revisionicommerciali.it";
          } else {
            checkbox.disabled = false;
            checkbox.removeAttribute("aria-disabled");
            checkbox.style.removeProperty("opacity");
            checkbox.style.removeProperty("cursor");
            label.style.removeProperty("opacity");
            label.style.removeProperty("cursor");
            label.title = "";
          }
        });
      });
    };

    applyGeneralAdminGuard();
    const observer = new MutationObserver(applyGeneralAdminGuard);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <style jsx global>{`
      .anagrafiche-master-page:has(h1:first-of-type) table {
        background: white !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody tr {
        background: white !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody tr:hover {
        background: rgb(248 250 252) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td {
        border-bottom: 1.5px solid rgb(148 163 184) !important;
        color: rgb(15 23 42) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody tr:last-child td {
        border-bottom-color: rgb(203 213 225) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td > div[class*="inline-flex"],
      .anagrafiche-master-page:has(h1:first-of-type) table tbody td > span[class*="inline-flex"] {
        opacity: 1 !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td:nth-child(4) > div {
        min-width: 74px !important;
        justify-content: center !important;
        border: 1px solid rgb(125 211 252) !important;
        background: rgb(240 249 255) !important;
        color: rgb(3 105 161) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td:nth-child(5) > div {
        min-width: 70px !important;
        justify-content: center !important;
        border: 1px solid rgb(125 211 252) !important;
        background: rgb(240 249 255) !important;
        color: rgb(3 105 161) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td:nth-child(5) span[class*="bg-yellow-100"] {
        background: rgb(254 249 195) !important;
        color: rgb(133 77 14) !important;
        border-color: rgb(253 224 71) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td:nth-child(6) > div {
        min-width: 94px !important;
        justify-content: center !important;
        border: 1px solid rgb(125 211 252) !important;
        background: rgb(224 242 254) !important;
        color: rgb(3 105 161) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td:nth-child(8) > div {
        min-width: 92px !important;
        justify-content: center !important;
        border: 1px solid rgb(134 239 172) !important;
        background: rgb(240 253 244) !important;
        color: rgb(21 128 61) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody tr.opacity-60 td {
        opacity: 1 !important;
        color: rgb(71 85 105) !important;
        background: rgb(248 250 252) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody tr.opacity-60 td:nth-child(8) > div {
        border-color: rgb(203 213 225) !important;
        background: rgb(241 245 249) !important;
        color: rgb(71 85 105) !important;
      }

      .anagrafiche-master-page:has(h1:first-of-type) table tbody td:nth-child(7) {
        color: rgb(30 41 59) !important;
        font-weight: 500 !important;
      }
    `}</style>
  );
}
