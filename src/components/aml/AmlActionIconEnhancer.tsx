import { useEffect } from "react";

/**
 * AML-only presentation enhancer. Never replaces React children or alters
 * click handlers, form submission, disabled state or navigation.
 * Accessible labels remain exposed when text is visually hidden.
 */
const getAction = (label: string): "edit" | "add" | "delete" | null => {
  const clean = label.replace(/\s+/g, " ").trim().replace(/^[+＋✎✏🖉🗑️\s]+/u, "").toLocaleLowerCase("it");
  if (!clean) return null;
  if (/^(?:modifica|modificare|aggiorna (?:dati|anagrafica|utente|responsabile)|edit)(?:\b|$)/u.test(clean)) return "edit";
  if (/^(?:elimina|eliminare|rimuovi|rimuovere|cancella|delete)(?:\b|$)/u.test(clean)) return "delete";
  if (/^(?:aggiungi|aggiungere|inserisci|inserire|nuovo|nuova|crea|creare|add)(?:\b|$)/u.test(clean)) return "add";
  return null;
};

const selectors = "button, a[href], [role='button']";

export default function AmlActionIconEnhancer() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".aml-pro-theme .aml-pro-content");
    if (!root) return;
    const decorate = (el: Element) => {
      if (!(el instanceof HTMLElement)) return;
      if (!el.matches(selectors) || el.closest("[data-aml-keep-label='true']")) return;
      // Skip menu/navigation, modal backgrounds and very long multi-action text.
      if (el.closest("nav,[role='menu']")) return;
      const label = (el.getAttribute("data-aml-original-label")
        || el.getAttribute("aria-label")
        || el.getAttribute("title")
        || el.textContent
        || "").replace(/\s+/g, " ").trim();
      if (!label || label.length > 105) return;
      const action = getAction(label);
      if (!action) {
        if (el.hasAttribute("data-aml-action")) el.removeAttribute("data-aml-action");
        return;
      }
      // Do not relabel broad commands such as new connections/restore actions
      // when they are inside form descriptions.
      el.setAttribute("data-aml-action", action);
      if (!el.hasAttribute("data-aml-original-label")) el.setAttribute("data-aml-original-label", label);
      if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", label);
      if (!el.getAttribute("title")) el.setAttribute("title", label);
      el.setAttribute("data-aml-tooltip", label);
    };

    const scan = (node: ParentNode) => {
      if (node instanceof Element && node.matches(selectors)) decorate(node);
      node.querySelectorAll(selectors).forEach(decorate);
    };

    scan(root);
    const observer = new MutationObserver((records) => {
      const targets = new Set<Element>();
      for (const record of records) {
        if (record.type === "characterData") {
          const parent = record.target.parentElement?.closest(selectors);
          if (parent && root.contains(parent)) targets.add(parent);
        } else {
          const parent = record.target instanceof Element ? record.target.closest(selectors) : null;
          if (parent && root.contains(parent)) targets.add(parent);
          record.addedNodes.forEach(node => {
            if (node instanceof Element) {
              if (node.matches(selectors)) targets.add(node);
              node.querySelectorAll(selectors).forEach(el => targets.add(el));
            }
          });
        }
      }
      targets.forEach(decorate);
    });
    observer.observe(root, {childList:true, characterData:true, subtree:true});
    return () => observer.disconnect();
  }, []);
  return null;
}
