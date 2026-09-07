import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export function TipiScadenzeMasterGraficaFixes() {
  useEffect(() => {
    let frame = 0;
    let studioAdminReadOnly = false;

    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const page = document.querySelector(".tipi-scadenze-page") as HTMLElement | null;
        if (!page) return;

        const primaryButton = Array.from(page.querySelectorAll("button")).find((button) =>
          (button.textContent || "").includes("Nuovo Tipo Scadenza")
        ) as HTMLButtonElement | undefined;
        if (primaryButton) {
          primaryButton.style.setProperty("background", "rgb(3 105 161)", "important");
          primaryButton.style.setProperty("border-color", "rgb(3 105 161)", "important");
          primaryButton.style.setProperty("color", "white", "important");
        }

        page.querySelectorAll("h3").forEach((heading) => {
          const row = heading.parentElement;
          if (!row) return;
          const originBadge = Array.from(row.children).find((child) => {
            const text = (child.textContent || "").trim();
            return text.includes("Sistema") || text.includes("Personale");
          }) as HTMLElement | undefined;
          if (originBadge) {
            const isSystem = (originBadge.textContent || "").includes("Sistema");
            originBadge.style.setProperty("display", "inline-flex", "important");
            originBadge.style.setProperty("align-items", "center", "important");
            originBadge.style.setProperty("opacity", "1", "important");
            originBadge.style.setProperty("visibility", "visible", "important");
            originBadge.style.setProperty("font-size", "0.72rem", "important");
            originBadge.style.setProperty("font-weight", "700", "important");
            originBadge.style.setProperty("line-height", "1.1", "important");
            originBadge.style.setProperty("padding", "4px 9px", "important");
            originBadge.style.setProperty("border-radius", "7px", "important");
            originBadge.style.setProperty("background", isSystem ? "rgb(15 23 42)" : "rgb(254 243 199)", "important");
            originBadge.style.setProperty("border-color", isSystem ? "rgb(15 23 42)" : "rgb(252 211 77)", "important");
            originBadge.style.setProperty("color", isSystem ? "white" : "rgb(120 53 15)", "important");
            originBadge.style.setProperty("-webkit-text-fill-color", isSystem ? "white" : "rgb(120 53 15)", "important");
          }
        });

        page.querySelectorAll('[role="switch"]').forEach((node) => {
          const sw = node as HTMLButtonElement;
          const checked = sw.getAttribute("data-state") === "checked";
          sw.style.setProperty("display", "inline-flex", "important");
          sw.style.setProperty("width", "42px", "important");
          sw.style.setProperty("min-width", "42px", "important");
          sw.style.setProperty("height", "24px", "important");
          sw.style.setProperty("min-height", "24px", "important");
          sw.style.setProperty("opacity", studioAdminReadOnly ? ".65" : "1", "important");
          sw.style.setProperty("background", checked ? "rgb(3 105 161)" : "rgb(203 213 225)", "important");
          sw.style.setProperty("border-color", checked ? "rgb(3 105 161)" : "rgb(148 163 184)", "important");
          if (studioAdminReadOnly) {
            sw.disabled = true;
            sw.style.setProperty("cursor", "not-allowed", "important");
          }
          const wrapper = sw.parentElement;
          if (!wrapper) return;
          let stateText = wrapper.querySelector(".tipi-scadenze-state-text") as HTMLElement | null;
          if (!stateText) {
            stateText = document.createElement("span");
            stateText.className = "tipi-scadenze-state-text";
            wrapper.appendChild(stateText);
          }
          stateText.textContent = checked ? "Attivo" : "Non attivo";
          stateText.style.setProperty("font-size", "0.68rem", "important");
          stateText.style.setProperty("font-weight", "700", "important");
          stateText.style.setProperty("color", checked ? "rgb(21 128 61)" : "rgb(100 116 139)", "important");
          stateText.style.setProperty("white-space", "nowrap", "important");
        });

        if (studioAdminReadOnly) {
          page.querySelectorAll('button[title="Modifica"], button[title^="Rinnova"], button[title="Elimina"]').forEach((button) => {
            (button as HTMLElement).style.setProperty("display", "none", "important");
          });

          document.querySelectorAll('[role="dialog"] label').forEach((label) => {
            const text = (label.textContent || "").trim();
            if (text !== "Ha scadenzario dedicato") return;
            const wrapper = label.parentElement;
            const checkbox = wrapper?.querySelector('[role="checkbox"]') as HTMLButtonElement | null;
            if (!checkbox) return;
            if (checkbox.getAttribute("data-state") === "checked") checkbox.click();
            checkbox.disabled = true;
            checkbox.setAttribute("aria-disabled", "true");
            checkbox.style.setProperty("opacity", ".45", "important");
            checkbox.style.setProperty("cursor", "not-allowed", "important");
          });
        }
      });
    };

    void (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;
      let profile: any = null;
      const { data: byId } = await supabase
        .from("tbutenti")
        .select("tipo_utente, amministratore_sistema_generale, attivo")
        .eq("user_id", user.id)
        .maybeSingle();
      profile = byId;
      if (!profile && user.email) {
        const { data: byEmail } = await supabase
          .from("tbutenti")
          .select("tipo_utente, amministratore_sistema_generale, attivo")
          .ilike("email", user.email)
          .maybeSingle();
        profile = byEmail;
      }
      studioAdminReadOnly =
        profile?.attivo !== false &&
        String(profile?.tipo_utente || "").trim().toUpperCase() === "ADMIN" &&
        profile?.amministratore_sistema_generale !== true;
      apply();
    })();

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", apply);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);
  return null;
}
