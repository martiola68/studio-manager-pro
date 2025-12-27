import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, ArrowLeft, MoreVertical, Paperclip, File, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type Messaggio = Database["public"]["Tables"]["tbmessaggi"]["Row"];
type Allegato = Database["public"]["Tables"]["tbmessaggi_allegati"]["Row"];

interface MessaggioConMittente extends Messaggio {
  mittente?: {
    id: string;
    nome: string;
    cognome: string;
    email: string;
  } | null;
  allegati?: Allegato[];
}

interface ChatAreaProps {
  conversazioneId: string;
  messaggi: MessaggioConMittente[];
  currentUserId: string;
  partnerName: string;
  onSendMessage: (testo: string, files?: File[]) => Promise<void>;
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
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversazioneId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Limite 5 file per messaggio
    if (selectedFiles.length + files.length > 5) {
      toast({
        variant: "destructive",
        title: "Limite superato",
        description: "Puoi allegare massimo 5 file per messaggio.",
      });
      return;
    }

    // Limite 10MB per file
    const oversizedFiles = files.filter((f) => f.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        variant: "destructive",
        title: "File troppo grande",
        description: "I file devono essere inferiori a 10MB.",
      });
      return;
    }

    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!newMessage.trim() && selectedFiles.length === 0) || sending) return;

    setSending(true);
    try {
      await onSendMessage(newMessage || "(Allegato)", selectedFiles.length > 0 ? selectedFiles : undefined);
      setNewMessage("");
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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
      <div className="flex items-center gap-3 p-4 border-b shadow-sm z-10 bg-background">
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
                const hasAttachments = msg.allegati && msg.allegati.length > 0;
                
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
                      {msg.testo && <p className="whitespace-pre-wrap">{msg.testo}</p>}
                      
                      {hasAttachments && (
                        <div className="mt-2 space-y-2">
                          {msg.allegati?.map((allegato) => (
                            <a
                              key={allegato.id}
                              href={allegato.url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-2 p-2 rounded border",
                                isMe
                                  ? "bg-primary-foreground/10 border-primary-foreground/20"
                                  : "bg-muted border-border"
                              )}
                            >
                              <File className="h-4 w-4 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{allegato.nome_file}</p>
                                <p className="text-[10px] opacity-70">{formatFileSize(allegato.dimensione)}</p>
                              </div>
                              <Download className="h-3 w-3 flex-shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                      
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

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/50">
          <div className="flex gap-2 overflow-x-auto max-w-3xl mx-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-background border rounded-lg p-2 min-w-[200px]"
              >
                <File className="h-4 w-4 flex-shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <form onSubmit={handleSend} className="flex gap-2 max-w-3xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip"
          />
          
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
          >
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
          
          <Button
            type="submit"
            size="icon"
            disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending}
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}