import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, ArrowLeft, MoreVertical, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Messaggio = Database["public"]["Tables"]["tbmessaggi"]["Row"];

interface MessaggioConMittente extends Messaggio {
  mittente?: {
    id: string;
    nome: string;
    cognome: string;
    email: string;
  } | null;
}

interface ChatAreaProps {
  conversazioneId: string;
  messaggi: MessaggioConMittente[];
  currentUserId: string;
  partnerName: string;
  onSendMessage: (testo: string) => Promise<void>;
  onBack: () => void;
  className?: string;
}

export function ChatArea({
  conversazioneId,
  messaggi,
  currentUserId,
  partnerName,
  onSendMessage,
  onBack,
  className,
}: ChatAreaProps) {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversazioneId]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await onSendMessage(newMessage);
      setNewMessage("");
    } finally {
      setSending(false);
      // Keep focus
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const groupMessagesByDate = (msgs: MessaggioConMittente[]) => {
    const groups: { [key: string]: MessaggioConMittente[] } = {};
    
    msgs.forEach((msg) => {
      if (!msg.created_at) return;
      const date = new Date(msg.created_at).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    
    return groups;
  };

  const messageGroups = groupMessagesByDate(messaggi);

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b shadow-sm z-10">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(partnerName)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <h2 className="font-semibold">{partnerName}</h2>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Online
          </span>
        </div>

        <Button variant="ghost" size="icon">
          <MoreVertical className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 bg-muted/20">
        <div className="flex flex-col gap-6 max-w-3xl mx-auto">
          {Object.entries(messageGroups).map(([dateStr, msgs]) => (
            <div key={dateStr} className="space-y-4">
              <div className="flex justify-center">
                <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                  {format(new Date(dateStr), "d MMMM yyyy", { locale: it })}
                </span>
              </div>
              
              {msgs.map((msg) => {
                const isMe = msg.mittente_id === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2 max-w-[80%]",
                      isMe ? "ml-auto flex-row-reverse" : ""
                    )}
                  >
                    <div
                      className={cn(
                        "p-3 rounded-lg shadow-sm text-sm break-words",
                        isMe
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-background border rounded-tl-none"
                      )}
                    >
                      <p>{msg.testo}</p>
                      <div
                        className={cn(
                          "text-[10px] mt-1 flex justify-end",
                          isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}
                      >
                        {format(new Date(msg.created_at!), "HH:mm")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <form onSubmit={handleSend} className="flex gap-2 max-w-3xl mx-auto">
          <Button type="button" variant="ghost" size="icon" className="shrink-0">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </Button>
          
          <Input
            ref={inputRef}
            placeholder="Scrivi un messaggio..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
            disabled={sending}
          />
          
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}