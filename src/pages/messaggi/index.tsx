import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Header from "@/components/Header";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { authService } from "@/services/authService";
import { messaggioService } from "@/services/messaggioService";
import { utenteService } from "@/services/utenteService";
import { studioService } from "@/services/studioService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function MessaggiPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [conversazioni, setConversazioni] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messaggi, setMessaggi] = useState<any[]>([]);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [utentiStudio, setUtentiStudio] = useState<any[]>([]);
  
  // Realtime subscription ref
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      loadMessaggi(selectedConvId);
      subscribeToChat(selectedConvId);
    }
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [selectedConvId]);

  const checkAuth = async () => {
    try {
      const authUser = await authService.getCurrentUser();
      if (!authUser) {
        router.push("/login");
        return;
      }

      const profile = await authService.getUserProfile(authUser.id);
      if (!profile) {
        router.push("/login");
        return;
      }
      setUser(profile);
      
      // Fetch studio info
      const studio = await studioService.getStudio();
      if (studio) {
        setStudioId(studio.id);
        loadUtentiStudio(studio.id);
      }
      
      loadConversazioni(profile.id);
    } catch (error) {
      console.error("Auth error:", error);
      router.push("/login");
    }
  };

  const loadConversazioni = async (userId: string) => {
    const data = await messaggioService.getConversazioni(userId);
    setConversazioni(data);
  };

  const loadUtentiStudio = async (sId: string) => {
    try {
      const data = await utenteService.getUtentiStudio(sId);
      setUtentiStudio(data || []);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const loadMessaggi = async (convId: string) => {
    if (!user) return;
    const data = await messaggioService.getMessaggi(convId);
    setMessaggi(data);
    
    // Mark as read
    await messaggioService.segnaComeLetto(convId, user.id);
    loadConversazioni(user.id); // Refresh counters
  };

  const subscribeToChat = (convId: string) => {
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    subscriptionRef.current = supabase
      .channel(`chat:${convId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tbmessaggi",
          filter: `conversazione_id=eq.${convId}`,
        },
        async (payload) => {
          // If message is not from me, add it
          if (payload.new.mittente_id !== user?.id) {
            // Fetch sender info for the new message
            const { data: sender } = await supabase
              .from("tbutenti")
              .select("id, nome, cognome, email")
              .eq("id", payload.new.mittente_id)
              .single();

            const newMessage = { ...payload.new, mittente: sender };
            setMessaggi((prev) => [...prev, newMessage]);
            
            // Mark as read if I'm looking at this chat
            if (document.visibilityState === "visible") {
              await messaggioService.segnaComeLetto(convId, user?.id);
            }
          }
          loadConversazioni(user?.id); // Refresh sidebar snippet
        }
      )
      .subscribe();
  };

  const handleSendMessage = async (testo: string) => {
    if (!user || !selectedConvId) return;

    try {
      const sentMsg = await messaggioService.inviaMessaggio(selectedConvId, user.id, testo);
      if (sentMsg) {
        // Optimistic update
        const optimisticMsg = {
          ...sentMsg,
          mittente: {
            id: user.id,
            nome: user.nome,
            cognome: user.cognome,
            email: user.email,
          },
        };
        setMessaggi((prev) => [...prev, optimisticMsg]);
        loadConversazioni(user.id);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile inviare il messaggio.",
      });
    }
  };

  const startNewChat = async (targetUserId: string) => {
    if (!user || !studioId) return;
    
    setIsNewChatOpen(false);
    
    try {
      const conv = await messaggioService.getOrCreateConversazioneDiretta(
        user.id,
        targetUserId,
        studioId
      );

      if (conv) {
        await loadConversazioni(user.id);
        setSelectedConvId(conv.id);
      }
    } catch (error) {
      console.error("Error creating chat:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile creare la conversazione.",
      });
    }
  };

  const getPartnerName = () => {
    if (!selectedConvId || !user) return "";
    const conv = conversazioni.find((c) => c.id === selectedConvId);
    if (!conv) return "";
    
    const partner = conv.partecipanti?.find(
      (p: any) => p.tbutenti?.email !== user.email
    )?.tbutenti;

    return partner ? `${partner.nome} ${partner.cognome}` : "Chat";
  };

  return (
    <div className="flex h-screen bg-background">
      <Head>
        <title>Messaggi | Studio Manager</title>
      </Head>

      <div className="w-64 hidden md:block border-r">
        <Header />
        {/* Sidebar content logic would need to be duplicated or Header refactored. 
            For now, let's assume the user navigates via the main layout. 
            Ideally, this page should be wrapped in a Layout component. 
            Given the current structure, I'll use a simplified layout.
        */}
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header / Main Header */}
        <div className="md:hidden">
           <Header />
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Chat Sidebar (Conversation List) */}
          <div className={`
            w-full md:w-80 border-r bg-background flex-shrink-0
            ${selectedConvId ? "hidden md:flex" : "flex"}
          `}>
            <ChatSidebar
              conversazioni={conversazioni}
              selectedId={selectedConvId}
              onSelect={setSelectedConvId}
              currentUserEmail={user?.email}
              onNewChat={() => setIsNewChatOpen(true)}
            />
          </div>

          {/* Chat Area */}
          <div className={`
            flex-1 bg-muted/10
            ${selectedConvId ? "flex" : "hidden md:flex"}
          `}>
            {selectedConvId ? (
              <ChatArea
                conversazioneId={selectedConvId}
                messaggi={messaggi}
                currentUserId={user?.id}
                partnerName={getPartnerName()}
                onSendMessage={handleSendMessage}
                onBack={() => setSelectedConvId(null)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-4">
                <div className="p-4 bg-muted rounded-full">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p>Seleziona una conversazione per iniziare</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Chat Dialog */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova Conversazione</DialogTitle>
          </DialogHeader>
          <Command>
            <CommandInput placeholder="Cerca utente..." />
            <CommandList>
              <CommandEmpty>Nessun utente trovato.</CommandEmpty>
              <CommandGroup heading="Utenti Studio">
                {utentiStudio
                  .filter((u) => u.id !== user?.id)
                  .map((u) => (
                    <CommandItem
                      key={u.id}
                      onSelect={() => startNewChat(u.id)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {u.nome?.[0]}{u.cognome?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{u.nome} {u.cognome}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}