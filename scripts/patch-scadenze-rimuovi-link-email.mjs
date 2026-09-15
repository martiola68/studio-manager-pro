import fs from "node:fs";

const filePath = "src/pages/api/scadenze-centrale/processa-alert.ts";
let source = fs.readFileSync(filePath, "utf8");

const urlBlock = `      const urlApplicazione =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "https://app.studiomanagerpro.it";
      const link = riga.link_dettaglio
        ? \`${'${urlApplicazione}${riga.link_dettaglio}'}\`
        : \`${'${urlApplicazione}/scadenze'}\`;

`;

if (source.includes(urlBlock)) {
  source = source.replace(urlBlock, "");
}

const oldLinkHtml = `<p style="margin-top:20px"><a href="${'${link}'}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#2563eb;color:#fff;text-decoration:none;font-weight:bold">Apri la scadenza</a></p>`;

if (source.includes(oldLinkHtml)) {
  source = source.replaceAll(oldLinkHtml, "");
}

if (source.includes(">Apri la scadenza</a>")) {
  throw new Error("[patch-scadenze-rimuovi-link-email] Link 'Apri la scadenza' ancora presente nell'HTML alert");
}

fs.writeFileSync(filePath, source, "utf8");
console.log("✓ Scadenze: rimosso il link 'Apri la scadenza' dalle email di alert");
