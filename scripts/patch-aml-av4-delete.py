from pathlib import Path

p = Path('src/pages/antiriciclaggio/index.tsx')
s = p.read_text(encoding='utf-8')
original = s

old_state = '''    const av4Info = getAV4Info(row);
    const av4Ok = av4Info?.Av4InviatoCL || av4Info?.public_sent_at || av4Info?.compilato_da_cliente || av4Info?.av4_caricato_manualmente || row.stato_pratica === "av4_inviato" || row.stato_pratica === "av4_ricevuto";
    if (!av4Ok) return { dotClass: "bg-red-500", text: "AV4 da generare", className: "font-semibold text-red-700" };
    if (row.fascicolo_completo === false) return { dotClass: "bg-yellow-500", text: "Fascicolo incompleto", className: "font-semibold text-yellow-700" };
    return { dotClass: "bg-green-500", text: "Completa", className: "font-semibold text-green-700" };'''
new_state = '''    const av4Info = getAV4Info(row);
    // Lo stato pratica non basta a dichiarare AV4 ricevuto: il verde richiede
    // una compilazione reale del cliente oppure un caricamento manuale reale.
    const av4Ricevuto = !!(av4Info?.compilato_da_cliente || av4Info?.av4_caricato_manualmente);
    const av4Inviato = !!(av4Info?.Av4InviatoCL || av4Info?.public_sent_at || av4Ricevuto);
    if (!av4Inviato) return { dotClass: "bg-red-500", text: "AV4 da generare", className: "font-semibold text-red-700" };
    if (!av4Ricevuto) return { dotClass: "bg-yellow-400", text: "AV4 inviato - in attesa", className: "font-semibold text-yellow-700" };
    if (row.fascicolo_completo === false) return { dotClass: "bg-yellow-500", text: "Fascicolo incompleto", className: "font-semibold text-yellow-700" };
    return { dotClass: "bg-green-500", text: "Completa", className: "font-semibold text-green-700" };'''
if old_state not in s:
    raise SystemExit('getStatoInfo marker not found')
s = s.replace(old_state, new_state, 1)

old_border = '''    const av4Info = getAV4Info(row);
    const av4Ricevuto = av4Info?.compilato_da_cliente || av4Info?.av4_caricato_manualmente || row.stato_pratica === "av4_ricevuto";
    const av4Inviato = av4Info?.Av4InviatoCL || av4Info?.public_sent_at || av4Info?.compilato_da_cliente || av4Info?.av4_caricato_manualmente || row.stato_pratica === "av4_inviato" || row.stato_pratica === "av4_ricevuto";
    if (av4Ricevuto) return "border-2 border-lime-500 shadow-[0_0_10px_rgba(132,204,22,0.9)]";
    if (av4Inviato) return "border-2 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.9)]";'''
new_border = '''    const av4Info = getAV4Info(row);
    const av4Ricevuto = !!(av4Info?.compilato_da_cliente || av4Info?.av4_caricato_manualmente);
    const av4Inviato = !!(av4Info?.Av4InviatoCL || av4Info?.public_sent_at || av4Ricevuto);
    if (av4Ricevuto) return "border-2 border-lime-500 shadow-[0_0_10px_rgba(132,204,22,0.9)]";
    if (av4Inviato) return "border-2 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.9)]";'''
if old_border not in s:
    raise SystemExit('getAV4IconBorderClass marker not found')
s = s.replace(old_border, new_border, 1)

old_delete = '''    const supabaseAny = getSupabaseClient() as any;
    const { error } = await supabaseAny.from("tbPraticheAML").delete().eq("id", row.pratica_id);
    if (error) return alert(error.message);
    await loadRowsBySocieta(societaFilter);'''
new_delete = '''    const supabaseAny = getSupabaseClient() as any;
    setWorkingId(row.pratica_id);
    try {
      const { data: { session }, error: sessionError } = await supabaseAny.auth.getSession();
      if (sessionError || !session?.access_token) {
        return alert("Sessione non valida. Effettua nuovamente l'accesso.");
      }

      const response = await fetch("/api/antiriciclaggio/pratiche/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pratica_id: row.pratica_id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.ok) {
        return alert(body?.error || "Errore eliminazione pratica AML");
      }
      await loadRowsBySocieta(societaFilter);
    } finally {
      setWorkingId(null);
    }'''
if old_delete not in s:
    raise SystemExit('delete marker not found')
s = s.replace(old_delete, new_delete, 1)

if s == original:
    raise SystemExit('No changes applied')

for token in [
    'AV4 inviato - in attesa',
    '/api/antiriciclaggio/pratiche/delete',
    'Authorization: `Bearer ${session.access_token}`',
    'const av4Ricevuto = !!(av4Info?.compilato_da_cliente || av4Info?.av4_caricato_manualmente)',
]:
    if token not in s:
        raise SystemExit(f'Missing verification token: {token}')

p.write_text(s, encoding='utf-8')
print('AML AV4 status and complete delete UI patched')
