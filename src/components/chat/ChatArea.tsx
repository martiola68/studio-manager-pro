import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface ChatAreaProps {
  conversazioneId: string;
  messaggi: any[];
  currentUserId: string;
  partnerName: string;
  creatorId: string;
  conversationType?: "diretta" | "gruppo";
  onSendMessage: (testo: string) => Promise<void>;
  onBack: () => void;
  onDeleteChat: () => void;
}

export function ChatArea({
  conversazioneId,
  messaggi,
  currentUserId,
  partnerName,
  onSendMessage,
  onBack,
}: ChatAreaProps) {
  const [newMessage, setNewMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<any[]>(messaggi);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalMessages(messaggi);
  }, [messaggi]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversazioneId]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim()) return;

    await onSendMessage(newMessage);
    setNewMessage("");
  };

  const groupMessagesByDate = (msgs: any[]) => {
    const groups: Record<string, any[]> = {};

    msgs.forEach((msg) => {
      if (!msg.created_at) return;
      const date = new Date(msg.created_at).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate(localMessages);

  return (
    <div className="flex flex-col h-full bg-background">
      
      {/* HEADER */}
      <div className="flex items-center p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft />
        </Button>

        <Avatar className="ml-2">
          <AvatarFallback>
            {partnerName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="ml-3">
          <p className="font-semibold">{partnerName}</p>
        </div>
      </div>

      {/* MESSAGGI */}
      <div className="flex-1 overflow-y-auto p-4 bg-muted/20">
        {Object.entries(messageGroups).map(([dateStr, msgs]) => (
          <div key={dateStr} className="mb-4">
            <div className="text-center text-xs text-muted-foreground mb-2">
              {format(new Date(dateStr), "d MMMM yyyy", { locale: it })}
            </div>

            {msgs.map((msg: any) => {
              const isMe = msg.mittente_id === currentUserId;

              const isLetto =
                msg.ultimo_letto_at &&
                new Date(msg.created_at) <= new Date(msg.ultimo_letto_at);

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex mb-2",
                    isMe ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg p-3 shadow-sm",
                      isMe
                        ? "bg-green-100 text-gray-900 border border-green-200"
                        : "bg-gray-100 text-gray-900 border border-gray-200"
                    )}
                  >
                    {!isMe && (
                      <p className="text-xs font-semibold mb-1">
                        {msg.mittente?.nome} {msg.mittente?.cognome}
                      </p>
                    )}

                    <p className="text-sm">{msg.testo}</p>

                    {/* ORA + SPUNTE */}
                    <div className="flex justify-end items-center gap-1 mt-1">
                      <span className="text-[10px] text-gray-500">
                        {msg.created_at &&
                          format(new Date(msg.created_at), "HH:mm", {
                            locale: it,
                          })}
                      </span>

                      {isMe && (
                        <span
                          className={cn(
                            "text-xs",
                            isLetto ? "text-green-600" : "text-gray-400"
                          )}
                        >
                          {isLetto ? "✔✔" : "✔"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
        <Input
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Scrivi..."
        />

        <Button type="submit">
          <Send />
        </Button>
      </form>
    </div>
  );
}
