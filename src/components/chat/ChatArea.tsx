import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, ArrowLeft, MoreVertical, Paperclip, File, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Database } from "@/lib/supabase/types";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { messaggioService } from "@/services/messaggioService";

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
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
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
    
    if (selectedFiles.length + files.length > 5) {
      toast({
        variant: "destructive",
        title: "Limite superato",
        description: "Puoi allegare massimo 5 file per messaggio.",
      });
      return;
    }

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

  const handleDeleteMessage = async () => {
    if (!messageToDelete || !currentUserId) return;

    try {
      await messaggioService.eliminaMessaggio(messageToDelete, currentUserId);
      
      toast({
        title: "Messaggio eliminato",
        description: "Il messaggio è stato eliminato con successo.",
      });
      
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    } catch (error: any) {
      console.error("Errore eliminazione messaggio:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile eliminare il messaggio.",
      });
    }
  };

  const openDeleteDialog = (messageId: string) => {
    setMessageToDelete(messageId);
    setDeleteDialogOpen(true);
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
    <div className={cn("flex flex-col bg-background", className)}>
      <div className="flex items-center gap-3 p-3 md:p-4 border-b shadow-sm bg-background flex-shrink-0 sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <Avatar className="h-9 w-9 md:h-10 md:w-10 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {getInitials(partnerName)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm md:text-base truncate">{partnerName}</h2>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Online
          </span>
        </div>

        <Button variant="ghost" size="icon" className="shrink-0">
          <MoreVertical className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3 md:p-4 bg-muted/20">
        <div className="flex flex-col gap-4 md:gap-6 max-w-3xl mx-auto pb-4">
          {Object.entries(messageGroups).map(([dateStr, msgs]) => (
            <div key={dateStr} className="space-y-3 md:space-y-4">
              <div className="flex justify-center sticky top-0 z-10">
                <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground shadow-sm">
                  {format(new Date(dateStr), "d MMMM yyyy", { locale: it })}
                </span>
              </div>
              
              {msgs.map((msg) => {
                const isMe = msg.mittente_id === currentUserId;
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"} mb-2 md:mb-4`}
                  >
                    {!isMe && (
                      <Avatar className="h-7 w-7 md:h-8 md:w-8 mr-2 shrink-0">
                        <AvatarFallback className="text-xs">
                          {msg.mittente?.nome?.[0]}{msg.mittente?.cognome?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div 
                      className={cn(
                        "max-w-[85%] md:max-w-[70%] rounded-lg p-2.5 md:p-3 relative group break-words",
                        isMe ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                      onMouseEnter={() => setHoveredMessageId(msg.id)}
                      onMouseLeave={() => setHoveredMessageId(null)}
                    >
                      {!isMe && (
                        <p className="text-xs font-semibold mb-1">
                          {msg.mittente?.nome} {msg.mittente?.cognome}
                        </p>
                      )}
                      
                      <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">
                        {msg.testo}
                      </p>
                      
                      {msg.allegati && msg.allegati.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {msg.allegati.map((att: any) => (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs underline hover:no-underline break-all"
                            >
                              <Paperclip className="h-3 w-3 shrink-0" />
                              <span className="truncate">{att.nome_file}</span>
                            </a>
                          ))}
                        </div>
                      )}
                      
                      <p className={cn(
                        "text-[10px] mt-1",
                        isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {msg.created_at && format(new Date(msg.created_at), "HH:mm", { locale: it })}
                      </p>

                      {isMe && hoveredMessageId === msg.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute -top-2 -left-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background border shadow-sm hover:bg-destructive hover:text-destructive-foreground hidden md:flex"
                          onClick={() => openDeleteDialog(msg.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {selectedFiles.length > 0 && (
        <div className="px-3 md:px-4 py-2 border-t bg-muted/50 overflow-x-auto flex-shrink-0">
          <div className="flex gap-2 min-w-min">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-background border rounded-lg p-2 min-w-[180px] md:min-w-[200px]"
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

      <div className="p-3 md:p-4 border-t bg-background flex-shrink-0 sticky bottom-0">
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
            className="shrink-0 h-10 w-10"
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
            className="flex-1 h-10 text-sm md:text-base"
            disabled={sending}
          />
          
          <Button
            type="submit"
            size="icon"
            className="shrink-0 h-10 w-10"
            disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending}
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="mx-4 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Messaggio</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo messaggio? Questa azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}