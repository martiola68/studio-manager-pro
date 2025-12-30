import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, ArrowLeft, MoreVertical, Paperclip, File, Download, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";
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
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
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
                    className={`flex ${isMe ? "justify-end" : "justify-start"} mb-4`}
                  >
                    {!isMe && (
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarFallback className="text-xs">
                          {msg.mittente?.nome?.[0]}{msg.mittente?.cognome?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div 
                      className={`max-w-[70%] ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"} rounded-lg p-3 relative group`}
                      onMouseEnter={() => setHoveredMessageId(msg.id)}
                      onMouseLeave={() => setHoveredMessageId(null)}
                    >
                      {!isMe && (
                        <p className="text-xs font-semibold mb-1">
                          {msg.mittente?.nome} {msg.mittente?.cognome}
                        </p>
                      )}
                      
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.testo}</p>
                      
                      {msg.allegati && msg.allegati.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {msg.allegati.map((att: any) => (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs underline hover:no-underline"
                            >
                              <Paperclip className="h-3 w-3" />
                              {att.nome_file}
                            </a>
                          ))}
                        </div>
                      )}
                      
                      <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {msg.created_at && format(new Date(msg.created_at), "HH:mm", { locale: it })}
                      </p>

                      {/* Delete button - only for own messages */}
                      {isMe && hoveredMessageId === msg.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute -top-2 -left-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background border shadow-sm hover:bg-destructive hover:text-destructive-foreground"
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Messaggio</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo messaggio? Questa azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}