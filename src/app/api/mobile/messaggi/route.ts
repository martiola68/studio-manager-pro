import { getMobileUser, mobileError, mobileSupabaseAdmin } from "@/lib/mobileApiAuth";

async function participantIds(conversationId: string) {
  const { data, error } = await mobileSupabaseAdmin
    .from("tbconversazioni_utenti")
    .select("utente_id,ultimo_letto_at")
    .eq("conversazione_id", conversationId);
  if (error) throw error;
  return data || [];
}

async function assertConversationAccess(conversationId: string, userId: string, studioId: string) {
  const { data: conv, error } = await mobileSupabaseAdmin
    .from("tbconversazioni")
    .select("id,studio_id,tipo,titolo,creato_da,created_at,updated_at")
    .eq("id", conversationId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw error;
  if (!conv) throw Object.assign(new Error("Conversazione non trovata."), { status: 404 });
  const participants = await participantIds(conversationId);
  if (!participants.some((p: any) => String(p.utente_id) === String(userId))) {
    throw Object.assign(new Error("Non autorizzato alla conversazione."), { status: 403 });
  }
  return { conv, participants };
}

function userLabel(user: any) {
  return [user?.nome, user?.cognome].filter(Boolean).join(" ").trim() || user?.email || "Utente";
}

export async function GET(request: Request) {
  try {
    const { utente } = await getMobileUser(request);
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversation_id");
    const summaryOnly = searchParams.get("summary") === "1";

    const { data: users, error: usersError } = await mobileSupabaseAdmin
      .from("tbutenti")
      .select("id,nome,cognome,email,attivo")
      .eq("studio_id", utente.studio_id)
      .eq("attivo", true)
      .order("nome", { ascending: true });
    if (usersError) throw usersError;
    const usersById = new Map((users || []).map((u: any) => [String(u.id), u]));

    const { data: memberships, error: membershipsError } = await mobileSupabaseAdmin
      .from("tbconversazioni_utenti")
      .select("conversazione_id,ultimo_letto_at")
      .eq("utente_id", utente.id);
    if (membershipsError) throw membershipsError;

    const convIds = (memberships || []).map((m: any) => m.conversazione_id).filter(Boolean);
    let conversations: any[] = [];

    if (convIds.length) {
      const { data: convRows, error: convError } = await mobileSupabaseAdmin
        .from("tbconversazioni")
        .select("id,studio_id,tipo,titolo,creato_da,created_at,updated_at")
        .in("id", convIds)
        .eq("studio_id", utente.studio_id)
        .order("updated_at", { ascending: false });
      if (convError) throw convError;

      for (const conv of convRows || []) {
        const parts = await participantIds(conv.id);
        const me = parts.find((p: any) => String(p.utente_id) === String(utente.id));
        const others = parts.filter((p: any) => String(p.utente_id) !== String(utente.id));
        const { data: latest, error: latestError } = await mobileSupabaseAdmin
          .from("tbmessaggi")
          .select("id,conversazione_id,mittente_id,testo,created_at")
          .eq("conversazione_id", conv.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestError) throw latestError;

        let unreadQuery = mobileSupabaseAdmin
          .from("tbmessaggi")
          .select("id", { count: "exact", head: true })
          .eq("conversazione_id", conv.id)
          .neq("mittente_id", utente.id)
          .is("deleted_at", null);
        if (me?.ultimo_letto_at) unreadQuery = unreadQuery.gt("created_at", me.ultimo_letto_at);
        const { count: unread, error: unreadError } = await unreadQuery;
        if (unreadError) throw unreadError;

        const otherUsers = others.map((p: any) => usersById.get(String(p.utente_id))).filter(Boolean);
        const displayName = conv.tipo === "gruppo"
          ? (conv.titolo || "Gruppo")
          : (otherUsers.length ? userLabel(otherUsers[0]) : "Conversazione");

        conversations.push({
          ...conv,
          nome: displayName,
          partecipanti: parts.map((p: any) => ({
            utente_id: p.utente_id,
            ultimo_letto_at: p.ultimo_letto_at,
            utente: usersById.get(String(p.utente_id)) || null,
          })),
          ultimo_messaggio: latest || null,
          non_letti: unread || 0,
        });
      }
    }

    const unreadTotal = conversations.reduce((n, c) => n + Number(c.non_letti || 0), 0);
    const received = conversations
      .map((c) => c.ultimo_messaggio ? { ...c.ultimo_messaggio, conversazione_nome: c.nome } : null)
      .filter((m: any) => m && String(m.mittente_id) !== String(utente.id))
      .sort((a: any, b: any) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    const latestReceived = received[0] || null;
    if (latestReceived) {
      latestReceived.mittente_nome = userLabel(usersById.get(String(latestReceived.mittente_id)));
    }

    if (summaryOnly) {
      return Response.json({ success: true, unread_total: unreadTotal, latest_received: latestReceived });
    }

    if (conversationId) {
      await assertConversationAccess(conversationId, utente.id, utente.studio_id);
      const { data: messages, error: messagesError } = await mobileSupabaseAdmin
        .from("tbmessaggi")
        .select("id,conversazione_id,mittente_id,testo,created_at,deleted_at")
        .eq("conversazione_id", conversationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (messagesError) throw messagesError;

      return Response.json({
        success: true,
        utente_corrente: { id: utente.id, nome: utente.nome, cognome: utente.cognome, email: utente.email },
        utenti: (users || []).filter((u: any) => String(u.id) !== String(utente.id)),
        conversazioni: conversations,
        messaggi: (messages || []).map((m: any) => ({
          ...m,
          mittente_nome: userLabel(usersById.get(String(m.mittente_id))),
        })),
        unread_total: unreadTotal,
      });
    }

    return Response.json({
      success: true,
      utente_corrente: { id: utente.id, nome: utente.nome, cognome: utente.cognome, email: utente.email },
      utenti: (users || []).filter((u: any) => String(u.id) !== String(utente.id)),
      conversazioni: conversations,
      unread_total: unreadTotal,
      latest_received: latestReceived,
    });
  } catch (error) {
    return mobileError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { utente } = await getMobileUser(request);
    const body = await request.json();
    const action = String(body?.action || "");

    if (action === "read") {
      const conversationId = String(body?.conversation_id || "");
      await assertConversationAccess(conversationId, utente.id, utente.studio_id);
      const { error } = await mobileSupabaseAdmin
        .from("tbconversazioni_utenti")
        .update({ ultimo_letto_at: new Date().toISOString() })
        .eq("conversazione_id", conversationId)
        .eq("utente_id", utente.id);
      if (error) throw error;
      return Response.json({ success: true });
    }

    if (action === "send") {
      const conversationId = String(body?.conversation_id || "");
      const text = String(body?.testo || "").trim();
      if (!text) throw Object.assign(new Error("Scrivi un messaggio."), { status: 400 });
      await assertConversationAccess(conversationId, utente.id, utente.studio_id);

      const { data: message, error } = await mobileSupabaseAdmin
        .from("tbmessaggi")
        .insert({
          studio_id: utente.studio_id,
          conversazione_id: conversationId,
          mittente_id: utente.id,
          testo: text,
        })
        .select("id,conversazione_id,mittente_id,testo,created_at")
        .single();
      if (error) throw error;

      await mobileSupabaseAdmin
        .from("tbconversazioni")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("studio_id", utente.studio_id);

      return Response.json({ success: true, data: message });
    }

    if (action === "direct") {
      const recipientId = String(body?.recipient_id || "");
      if (!recipientId || recipientId === String(utente.id)) {
        throw Object.assign(new Error("Destinatario non valido."), { status: 400 });
      }

      const { data: recipient, error: recipientError } = await mobileSupabaseAdmin
        .from("tbutenti")
        .select("id,nome,cognome,email,attivo")
        .eq("id", recipientId)
        .eq("studio_id", utente.studio_id)
        .eq("attivo", true)
        .maybeSingle();
      if (recipientError) throw recipientError;
      if (!recipient) throw Object.assign(new Error("Utente non trovato."), { status: 404 });

      const { data: mine, error: mineError } = await mobileSupabaseAdmin
        .from("tbconversazioni_utenti")
        .select("conversazione_id")
        .eq("utente_id", utente.id);
      if (mineError) throw mineError;

      for (const row of mine || []) {
        const { data: conv } = await mobileSupabaseAdmin
          .from("tbconversazioni")
          .select("id,tipo,studio_id")
          .eq("id", row.conversazione_id)
          .eq("studio_id", utente.studio_id)
          .eq("tipo", "diretta")
          .maybeSingle();
        if (!conv) continue;
        const parts = await participantIds(conv.id);
        const ids = parts.map((p: any) => String(p.utente_id));
        if (ids.length === 2 && ids.includes(String(utente.id)) && ids.includes(recipientId)) {
          return Response.json({ success: true, conversation_id: conv.id, nome: userLabel(recipient) });
        }
      }

      const { data: conv, error: convError } = await mobileSupabaseAdmin
        .from("tbconversazioni")
        .insert({
          studio_id: utente.studio_id,
          tipo: "diretta",
          creato_da: utente.id,
        })
        .select("id")
        .single();
      if (convError) throw convError;

      const { error: partError } = await mobileSupabaseAdmin
        .from("tbconversazioni_utenti")
        .insert([
          { conversazione_id: conv.id, utente_id: utente.id },
          { conversazione_id: conv.id, utente_id: recipientId },
        ]);
      if (partError) throw partError;

      return Response.json({ success: true, conversation_id: conv.id, nome: userLabel(recipient) });
    }

    throw Object.assign(new Error("Azione non valida."), { status: 400 });
  } catch (error) {
    return mobileError(error);
  }
}
