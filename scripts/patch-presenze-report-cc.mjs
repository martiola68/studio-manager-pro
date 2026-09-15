import fs from "node:fs";

const componentPath = "src/components/PayrollDailyPresenceEmailConfig.tsx";
const reportPath = "src/pages/api/presenze/report-giornaliero-email.ts";
const serverPath = "src/services/sendEmailServer.ts";

function replaceOnce(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) {
    throw new Error(`[presenze-report-cc] Anchor non trovato: ${label}`);
  }
  return source.replace(oldValue, newValue);
}

// 1) UI: consente "TO; CC; CC" nei tre campi destinatario.
{
  let source = fs.readFileSync(componentPath, "utf8");

  source = source.replace(
    /<input type="email" value=\{emailFiscale\}/,
    '<input type="text" value={emailFiscale}'
  );
  source = source.replace(
    /<input type="email" value=\{emailLavoro\}/,
    '<input type="text" value={emailLavoro}'
  );
  source = source.replace(
    /<input type="email" value=\{emailConsulenza\}/,
    '<input type="text" value={emailConsulenza}'
  );

  const gridClose = `      </div>\n\n      {message &&`;
  const helper = `      </div>\n      <div className="mt-2 text-xs text-slate-500">Prima email = destinatario principale. Eventuali email successive separate da <strong>;</strong> vengono inviate in CC.</div>\n\n      {message &&`;
  if (!source.includes("Prima email = destinatario principale")) {
    source = replaceOnce(source, gridClose, helper, "nota destinatari CC");
  }

  const oldSuccessMap = `.map((r: any) => \`${'${r.settore}'}: ${'${r.to}'}\`)`;
  const newSuccessMap = `.map((r: any) => \`${'${r.settore}'}: ${'${r.to}'}${'${Array.isArray(r.cc) && r.cc.length ? ` (CC: ${r.cc.join(", ")})` : ""}'}\`)`;
  if (!source.includes("(CC:")) {
    source = replaceOnce(source, oldSuccessMap, newSuccessMap, "esito test CC");
  }

  fs.writeFileSync(componentPath, source, "utf8");
}

// 2) Server Microsoft Graph: aggiunge ccRecipients al messaggio.
{
  let source = fs.readFileSync(serverPath, "utf8");

  source = replaceOnce(
    source,
    `  to: string;\n  subject: string;`,
    `  to: string;\n  cc?: string[];\n  subject: string;`,
    "tipo cc sendEmailServer"
  );

  const attachmentAnchor = `    if (params.attachments?.length) {`;
  const ccBlock = `    const cc = (params.cc || []).map((address) => String(address || "").trim()).filter(Boolean);\n    if (cc.length) {\n      message.ccRecipients = cc.map((address) => ({\n        emailAddress: { address },\n      }));\n    }\n\n    if (params.attachments?.length) {`;
  if (!source.includes("message.ccRecipients")) {
    source = replaceOnce(source, attachmentAnchor, ccBlock, "ccRecipients Graph");
  }

  fs.writeFileSync(serverPath, source, "utf8");
}

// 3) Report automatico/test: prima email TO, successive separate da ';' CC.
{
  let source = fs.readFileSync(reportPath, "utf8");

  const helperAnchor = `function nomeCompleto(u: any) {\n  return \`${'${u.cognome || ""} ${u.nome || ""}'}\`.trim() || u.email || u.id;\n}\n`;
  const helperBlock = `function nomeCompleto(u: any) {\n  return \`${'${u.cognome || ""} ${u.nome || ""}'}\`.trim() || u.email || u.id;\n}\n\nfunction parseRecipientField(value: unknown) {\n  const emails = String(value || "")\n    .split(";")\n    .map((email) => email.trim())\n    .filter(Boolean);\n\n  return {\n    to: emails[0] || "",\n    cc: emails.slice(1),\n  };\n}\n`;
  if (!source.includes("function parseRecipientField")) {
    source = replaceOnce(source, helperAnchor, helperBlock, "parser TO/CC");
  }

  source = replaceOnce(
    source,
    `      for (const item of sectorRecipients) {\n        const to = String(item.to || "").trim();\n        if (!to) {`,
    `      for (const item of sectorRecipients) {\n        const { to, cc } = parseRecipientField(item.to);\n        if (!to) {`,
    "lettura destinatario settore"
  );

  source = replaceOnce(
    source,
    `          to,\n          subject: \`PRESENZE ${'${item.key.toUpperCase()}'} - ${'${dataIt}'}\`,`,
    `          to,\n          cc,\n          subject: \`PRESENZE ${'${item.key.toUpperCase()}'} - ${'${dataIt}'}\`,`,
    "passaggio cc a sendEmailServer"
  );

  source = replaceOnce(
    source,
    `          to,\n          success: result.success,`,
    `          to,\n          cc,\n          success: result.success,`,
    "risultato destinatari cc"
  );

  fs.writeFileSync(reportPath, source, "utf8");
}

console.log("✓ Presenze report: prima email TO, successive separate da ';' inviate in CC");
