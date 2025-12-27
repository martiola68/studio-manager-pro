import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { authService } from "@/services/authService";
import { messaggioService } from "@/services/messaggioService";
import { utenteService } from "@/services/utenteService";
import { studioService } from "@/services/studioService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";

export default function MessaggiPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [conversazioni, setConversazioni] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messaggi, setMessaggi] = useState<any[]>([]);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatType, setNewChatType] = useState<"diretta" | "gruppo">("diretta");
  const [utentiStudio, setUtentiStudio] = useState<any[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  
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
    
    await messaggioService.segnaComeLetto(convId, user.id);
    loadConversazioni(user.id);
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
          if (payload.new.mittente_id !== user?.id) {
            const { data: sender } = await supabase
              .from("tbutenti")
              .select("id, nome, cognome, email")
              .eq("id", payload.new.mittente_id)
              .single();

            const newMessage = { ...payload.new, mittente: sender };
            setMessaggi((prev) => [...prev, newMessage]);
            
            if (document.visibilityState === "visible") {
              await messaggioService.segnaComeLetto(convId, user?.id);
            }
          }
          loadConversazioni(user?.id);
        }
      )
      .subscribe();
  };

  const handleSendMessage = async (testo: string, files?: File[]) => {
    if (!user || !selectedConvId) return;

    try {
      const sentMsg = await messaggioService.inviaMessaggio(selectedConvId, user.id, testo);
      
      if (sentMsg && files && files.length > 0) {
        await Promise.all(
          files.map((file) => messaggioService.uploadAllegato(file, sentMsg.id, user.id))
        );
      }

      if (sentMsg) {
        const optimisticMsg = {
          ...sentMsg,
          mittente: {
            id: user.id,
            nome: user.nome,
            cognome: user.cognome,
            email: user.email,
          },
          allegati: [],
        };
        setMessaggi((prev) => [...prev, optimisticMsg]);
        loadConversazioni(user.id);
        
        // Ricarica messaggi per aggiornare allegati
        if (files && files.length > 0) {
          setTimeout(() => loadMessaggi(selectedConvId), 500);
        }
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

  const startDirectChat = async (targetUserId: string) => {
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

  const createGroupChat = async () => {
    if (!user || !studioId || !groupTitle.trim() || selectedMembers.length < 2) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Inserisci un titolo e seleziona almeno 2 membri.",
      });
      return;
    }

    try {
      // Aggiungi il creatore ai membri se non già presente
      const allMembers = selectedMembers.includes(user.id) 
        ? selectedMembers 
        : [user.id, ...selectedMembers];

      const conv = await messaggioService.creaConversazioneGruppo(
        groupTitle,
        user.id,
        studioId,
        allMembers
      );

      if (conv) {
        setIsNewChatOpen(false);
        setGroupTitle("");
        setSelectedMembers([]);
        await loadConversazioni(user.id);
        setSelectedConvId(conv.id);
        
        toast({
          title: "Gruppo creato",
          description: `Il gruppo "${groupTitle}" è stato creato con successo.`,
        });
      }
    } catch (error) {
      console.error("Error creating group:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile creare il gruppo.",
      });
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const getPartnerName = () => {
    if (!selectedConvId || !user) return "";
    const conv = conversazioni.find((c) => c.id === selectedConvId);
    if (!conv) return "";
    
    if (conv.tipo === "gruppo") {
      return conv.titolo || "Gruppo";
    }
    
    const partner = conv.partecipanti?.find(
      (p: any) => p.tbutenti?.email !== user.email
    )?.tbutenti;

    return partner ? `${partner.nome} ${partner.cognome}` : "Chat";
  };

  return (
    <>
      <Head>
        <title>Messaggi | Studio Manager</title>
      </Head>
      
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          
          <div className="flex-1 flex overflow-hidden">
            {/* Chat Sidebar */}
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
      </div>

      {/* New Chat Dialog */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuova Conversazione</DialogTitle>
          </DialogHeader>
          
          <Tabs value={newChatType} onValueChange={(v) => setNewChatType(v as "diretta" | "gruppo")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="diretta">Chat Diretta</TabsTrigger>
              <TabsTrigger value="gruppo">Gruppo</TabsTrigger>
            </TabsList>
            
            <TabsContent value="diretta" className="space-y-4">
              <Command>
                <CommandInput placeholder="Cerca utente..." />
                <CommandList>
                  <CommandEmpty>Nessun utente trovato.</CommandEmpty>
                  <CommandGroup>
                    {utentiStudio
                      .filter((u) => u.id !== user?.id)
                      .map((u) => (
                        <CommandItem
                          key={u.id}
                          onSelect={() => startDirectChat(u.id)}
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
            </TabsContent>
            
            <TabsContent value="gruppo" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="group-title">Nome Gruppo</Label>
                <Input
                  id="group-title"
                  placeholder="Es: Team Sviluppo"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Membri ({selectedMembers.length} selezionati)</Label>
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  {utentiStudio
                    .filter((u) => u.id !== user?.id)
                    .map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer"
                        onClick={() => toggleMember(u.id)}
                      >
                        <Checkbox
                          checked={selectedMembers.includes(u.id)}
                          onCheckedChange={() => toggleMember(u.id)}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {u.nome?.[0]}{u.cognome?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{u.nome} {u.cognome}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              
              <DialogFooter>
                <Button onClick={createGroupChat} disabled={!groupTitle.trim() || selectedMembers.length < 2}>
                  <Users className="h-4 w-4 mr-2" />
                  Crea Gruppo
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}