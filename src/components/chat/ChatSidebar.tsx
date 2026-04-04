import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import type { Database } from "@/lib/supabase/types";

type Conversazione = Database["public"]["Tables"]["tbconversazioni"]["Row"];
type Messaggio = Database["public"]["Tables"]["tbmessaggi"]["Row"];

interface ConversazioneConDettagli extends Conversazione {
  partecipanti?: Array<{
    utente_id: string;
    ultimo_letto_at: string | null;
    tbutenti: {
      id: string;
      nome: string;
      cognome: string;
      email: string;
    } | null;
  }>;
  ultimo_messaggio?: Messaggio | null;
  non_letti?: number;
}

interface ChatSidebarProps {
  conversazioni: ConversazioneConDettagli[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentUserEmail?: string;
  currentUserId?: string | null;
  onNewChat: () => void;
  onDeleteConversazione: (conversazioneId: string) => void;
  className?: string;
}

export function ChatSidebar({
  conversazioni,
  selectedId,
  onSelect,
  currentUserEmail,
  currentUserId,
  onNewChat,
  onDeleteConversazione,
  className,
}: ChatSidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = conversazioni.filter((c) => {
    if (c.tipo === "gruppo") {
      const titoloMatch = c.titolo?.toLowerCase().includes(search.toLowerCase());

      const partecipantiMatch =
        c.partecipanti?.some((p) => {
          const nomeCompleto = `${p.tbutenti?.nome || ""} ${p.tbutenti?.cognome || ""}`
            .trim()
            .toLowerCase();
          return nomeCompleto.includes(search.toLowerCase());
        }) || false;

      return !!titoloMatch || partecipantiMatch;
    }

    const altroUtente = c.partecipanti?.find(
      (p) => p.tbutenti?.email !== currentUserEmail
    )?.tbutenti;

    const nome = altroUtente
      ? `${altroUtente.nome} ${altroUtente.cognome}`
      : "Chat";

    return nome.toLowerCase().includes(search.toLowerCase());
  });

  const getDisplayInfo = (conv: ConversazioneConDettagli) => {
    if (conv.tipo === "gruppo") {
      return {
        nome: conv.titolo || "Gruppo",
        initials: "GP",
        isGroup: true,
      };
    }

    const partner = conv.partecipanti?.find(
      (p) => p.tbutenti?.email !== currentUserEmail
    )?.tbutenti;

    if (partner) {
      return {
        nome: `${partner.nome} ${partner.cognome}`,
        initials: `${partner.nome.charAt(0)}${partner.cognome.charAt(0)}`.toUpperCase(),
        isGroup: false,
      };
    }

    return {
      nome: "Utente sconosciuto",
      initials: "?",
      isGroup: false,
    };
  };

 const getGroupParticipants = (conv: ConversazioneConDettagli) => {
  if (conv.tipo !== "gruppo") return [];

  return (
    conv.partecipanti
      ?.filter((p) => p.tbutenti && p.tbutenti.email !== currentUserEmail)
      .map((p) => `${p.tbutenti?.nome || ""} ${p.tbutenti?.cognome || ""}`.trim())
      .filter(Boolean) || []
  );
};

  return (
    <div className={cn("flex flex-col h-full border-r bg-background", className)}>
      <div className="p-3 md:p-4 border-b space-y-3 md:space-y-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-bold">Messaggi</h2>
          <Button size="icon" variant="ghost" onClick={onNewChat} className="shrink-0">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca conversazione..."
            className="pl-8 h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col p-2 gap-1">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nessuna conversazione trovata
            </div>
          ) : (
            filtered.map((conv) => {
              const displayInfo = getDisplayInfo(conv);
              const groupParticipants = getGroupParticipants(conv);

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg text-left transition-colors hover:bg-accent active:bg-accent/80 touch-manipulation",
                    selectedId === conv.id && "bg-accent"
                  )}
                >
                  <Avatar className="shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {displayInfo.isGroup ? (
                        <Users className="h-4 w-4" />
                      ) : (
                        displayInfo.initials
                      )}
                    </AvatarFallback>
                  </Avatar>

  <div className="flex-1 min-w-0">
  <div className="flex items-start justify-between mb-1 gap-2">
    <div className="flex items-start gap-1 flex-1 min-w-0">
      <span
        className={cn(
          conv.tipo === "gruppo"
            ? "font-semibold text-sm leading-snug whitespace-normal break-words block"
            : "font-semibold text-sm truncate",
          currentUserId && currentUserId !== conv.creato_da
            ? "text-red-600"
            : "text-black dark:text-white"
        )}
      >
        {displayInfo.nome}
      </span>

      {displayInfo.isGroup && (
        <span className="text-xs text-muted-foreground shrink-0 mt-[2px]">
          ({conv.partecipanti?.length || 0})
        </span>
      )}
    </div>

    {conv.ultimo_messaggio && (
      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
        {formatDistanceToNow(new Date(conv.ultimo_messaggio.created_at!), {
          addSuffix: false,
          locale: it,
        })}
      </span>
    )}
  </div>

  {conv.tipo === "gruppo" ? (
    <div className="text-xs text-muted-foreground leading-snug">
      {groupParticipants.length > 0 ? (
        groupParticipants.map((name, index) => (
          <div key={index} className="block">
            {name}
          </div>
        ))
      ) : (
        <div>Nessun partecipante</div>
      )}
    </div>
  ) : null}

  {conv.tipo === "gruppo" && (conv.non_letti || 0) > 0 && (
    <div className="mt-2 flex justify-end">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
        {conv.non_letti}
      </span>
    </div>
  )}
</div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
