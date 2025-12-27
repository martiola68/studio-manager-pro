import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

// Definiamo i tipi manualmente basandoci su quelli del DB per gestire le relazioni
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
  onNewChat: () => void;
  className?: string;
}

export function ChatSidebar({
  conversazioni,
  selectedId,
  onSelect,
  currentUserEmail,
  onNewChat,
  className,
}: ChatSidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = conversazioni.filter((c) => {
    // Trova l'altro partecipante per la ricerca
    const altroUtente = c.partecipanti?.find(
      (p) => p.tbutenti?.email !== currentUserEmail
    )?.tbutenti;

    const nome = altroUtente
      ? `${altroUtente.nome} ${altroUtente.cognome}`
      : "Chat";
    
    return nome.toLowerCase().includes(search.toLowerCase());
  });

  const getPartner = (conv: ConversazioneConDettagli) => {
    return conv.partecipanti?.find(
      (p) => p.tbutenti?.email !== currentUserEmail
    )?.tbutenti;
  };

  const getInitials = (nome: string, cognome: string) => {
    return `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase();
  };

  return (
    <div className={cn("flex flex-col h-full border-r bg-background", className)}>
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Messaggi</h2>
          <Button size="icon" variant="ghost" onClick={onNewChat}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca conversazione..."
            className="pl-8"
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
              const partner = getPartner(conv);
              const nome = partner
                ? `${partner.nome} ${partner.cognome}`
                : "Utente sconosciuto";
              
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg text-left transition-colors hover:bg-accent",
                    selectedId === conv.id && "bg-accent"
                  )}
                >
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {partner ? getInitials(partner.nome, partner.cognome) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold truncate text-sm">
                        {nome}
                      </span>
                      {conv.ultimo_messaggio && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {formatDistanceToNow(new Date(conv.ultimo_messaggio.created_at!), {
                            addSuffix: false,
                            locale: it,
                          })}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className={cn(
                        "text-xs truncate max-w-[180px]",
                        (conv.non_letti || 0) > 0 ? "font-bold text-foreground" : "text-muted-foreground"
                      )}>
                        {conv.ultimo_messaggio?.testo || "Nessun messaggio"}
                      </p>
                      
                      {(conv.non_letti || 0) > 0 && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                          {conv.non_letti}
                        </span>
                      )}
                    </div>
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