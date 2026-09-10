from pathlib import Path

# One-shot conservative migration: only known direct Resend implementations.
# Existing Microsoft sendEmailServer callers are intentionally untouched.

p = Path('src/services/emailServiceServer.ts')
s = p.read_text()
old = s
s = '''import { sendEmailServer } from "@/services/sendEmailServer";\n\ntype SendResult =\n  | { success: true; id: string }\n  | { success: false; error: string };\n\nexport async function sendPasswordResetEmailServer(\n  nome: string,\n  email: string,\n  password: string,\n  senderUserId?: string,\n  microsoftConnectionId?: string\n): Promise<SendResult> {\n  if (!senderUserId || !microsoftConnectionId) {\n    return { success: false, error: "Mittente Microsoft 365 non configurato" };\n  }\n\n  const loginUrl = "https://app.studiomanagerpro.it/login";\n  const html = `\n    <p>Ciao ${nome},</p>\n    <p>La tua password è stata resettata dall'amministratore.</p>\n    <p><strong>Email:</strong> ${email}<br/><strong>Nuova Password:</strong> ${password}</p>\n    <p><a href="${loginUrl}">Accedi a Studio Manager Pro</a></p>\n  `;\n\n  const result = await sendEmailServer({\n    senderUserId,\n    microsoftConnectionId,\n    to: email,\n    subject: "Password Reset - Studio Manager Pro",\n    html,\n  });\n\n  return result.success\n    ? { success: true, id: result.id || "microsoft-365" }\n    : { success: false, error: result.error || "Errore invio Microsoft 365" };\n}\n'''
if 'api.resend.com' in old:
    p.write_text(s)

p = Path('src/pages/api/controllo-gestione/alert.ts')
s = p.read_text()
if 'api.resend.com' in s:
    if 'import { sendEmailServer }' not in s:
        s = s.replace('import { getSupabaseAdmin } from "@/lib/supabaseAdmin";', 'import { getSupabaseAdmin } from "@/lib/supabaseAdmin";\nimport { sendEmailServer } from "@/services/sendEmailServer";')
    start = s.index('async function inviaEmail(')
    end = s.index('\n}\n\nexport default async function handler', start) + 2
    s = s[:start] + '''async function inviaEmail(\n  senderUserId: string,\n  microsoftConnectionId: string,\n  to: string,\n  subject: string,\n  html: string\n) {\n  const result = await sendEmailServer({\n    senderUserId,\n    microsoftConnectionId,\n    to,\n    subject,\n    html,\n  });\n  if (!result.success) throw new Error(result.error || "Errore invio Microsoft 365");\n}''' + s[end:]
    # Load studio_id in controllo query, then resolve studio Microsoft config/token owner per controllo.
    s = s.replace('id,\n      cliente_id,', 'id,\n      studio_id,\n      cliente_id,', 1)
    marker = '    try {\n      for (const email of emails) {\n        await inviaEmail(email, subject, html);\n      }'
    repl = '''    try {\n      const { data: studio, error: studioError } = await supabaseAdmin\n        .from("tbstudio")\n        .select("microsoft_connection_id")\n        .eq("id", controllo.studio_id)\n        .single();\n      if (studioError || !studio?.microsoft_connection_id) {\n        throw new Error("Connessione Microsoft 365 dello studio non trovata");\n      }\n\n      const { data: tokenOwner, error: tokenError } = await supabaseAdmin\n        .from("tbmicrosoft365_user_tokens")\n        .select("user_id")\n        .eq("microsoft_connection_id", studio.microsoft_connection_id)\n        .is("revoked_at", null)\n        .order("updated_at", { ascending: false })\n        .limit(1)\n        .maybeSingle();\n      if (tokenError || !tokenOwner?.user_id) {\n        throw new Error("Token Microsoft 365 dello studio non trovato");\n      }\n\n      for (const email of emails) {\n        await inviaEmail(tokenOwner.user_id, studio.microsoft_connection_id, email, subject, html);\n      }'''
    if marker not in s:
        raise SystemExit('controllo-gestione send marker not found')
    s = s.replace(marker, repl, 1)
    p.write_text(s)

# Fail closed: no direct Resend references may remain in application runtime.
for root in [Path('src')]:
    for f in root.rglob('*'):
        if f.is_file() and f.suffix in {'.ts','.tsx','.js','.jsx'}:
            text = f.read_text(errors='ignore')
            if 'api.resend.com' in text or 'RESEND_API_KEY' in text or 'RESEND_FROM' in text:
                raise SystemExit(f'Resend runtime reference remains: {f}')

print('Direct Resend runtime paths migrated to Microsoft 365 only')
