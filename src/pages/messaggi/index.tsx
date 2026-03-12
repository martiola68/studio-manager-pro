import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { authService } from "@/services/authService";
import { messaggioService } from "@/services/messaggioService";
import { utenteService } from "@/services/utenteService";
import { studioService } from "@/services/studioService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MessaggiPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [user, setUser] = useState<any>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [isPartner, setIsPartner] = useState(false);
  const [conversazioni, setConversazioni] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [messaggi, setMessaggi] = useState<any[]>([]);

  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatType, setNewChatType] = useState<"diretta" | "gruppo">("diretta");
  const [utentiStudio, setUtentiStudio] = useState<any[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editGroupTitle, setEditGroupTitle] = useState("");
  const [editSelectedMembers, setEditSelectedMembers] = useState<string[]>([]);

  const subscriptionRef = useRef<any>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isChatReadyRef = useRef(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio("/sounds/message.mp3");
      audioRef.current.preload = "auto";
    }
  }, []);

 useEffect(() => {
  isChatReadyRef.current = false;

  if (selectedConvId && authUserId) {
    loadMessaggi(selectedConvId).then(() => {
      subscribeToChat(selectedConvId);
      isChatReadyRef.current = true;
    });
  }

  return () => {
    isChatReadyRef.current = false;

    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
  };
}, [selectedConvId, authUserId]);
  
  const checkAuth = async () => {
    try {
      const authUser = await authService.getCurrentUser();
      if (!authUser) {
        router.push("/login");
        return;
      }

      setAuthUserId(authUser.id);

      const profile = await authService.getUserProfile(authUser.id);
      if (!profile) {
        router.push("/login");
        return;
      }

      setUser(profile);

      const isPartnerUser = profile.tipo_utente?.toLowerCase() === "partner";
      setIsPartner(isPartnerUser);

      const studio = await studioService.getStudio();
      if (studio) {
        setStudioId(studio.id);
        await loadUtentiStudio(studio.id);
      }

      await loadConversazioni(authUser.id);
    } catch (error) {
      console.error("Auth error:", error);
      router.push("/login");
    }
  };

  const loadConversazioni = async (userId: string) => {
    const data = await messaggioService.getConversazioni(userId);
    setConversazioni(data || []);
  };

  const loadUtentiStudio = async (sId: string) => {
    try {
      const data = await utenteService.getUtentiStudio(sId);
      setUtentiStudio(data || []);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const playIncomingSound = async () => {
    try {
      if (!audioRef.current) return;
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
    } catch (error) {
      console.warn("Audio blocked:", error);
    }
  };

  const mergeMessagesAndNotify = (incoming: any[]) => {
    setMessaggi((prev) => {
      const prevIds = new Set(prev.map((m) => m.id));
      const newRemoteMessages = (incoming || []).filter(
        (m) => !prevIds.has(m.id) && m.mittente_id !== authUserId
      );

      if (newRemoteMessages.length > 0) {
        playIncomingSound();
      }

      return incoming || [];
    });
  };

  const loadMessaggi = async (convId: string) => {
    if (!authUserId) return;

    const data = await messaggioService.getMessaggi(convId);
    mergeMessagesAndNotify(data || []);

    await messaggioService.segnaComeLetto(convId, authUserId);
    await loadConversazioni(authUserId);
  };

  const loadMessaggiSilent = async (convId: string) => {
    if (!authUserId) return;

    const data = await messaggioService.getMessaggi(convId);
    mergeMessagesAndNotify(data || []);

    if (document.visibilityState === "visible") {
      await messaggioService.segnaComeLetto(convId, authUserId);
    }

    await loadConversazioni(authUserId);
  };

 const subscribeToChat = (convId: string) => {
  if (!authUserId) return;

  const currentUserId = authUserId;

  if (subscriptionRef.current) {
    supabase.removeChannel(subscriptionRef.current);
    subscriptionRef.current = null;
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
        const { data: sender } = await supabase
          .from("tbutenti")
          .select("id, nome, cognome, email")
          .eq("id", payload.new.mittente_id)
          .single();

        const newMessage = {
        ...(payload.new as { id: string; mittente_id: string; [key: string]: any }),
          mittente: sender,
          };

        setMessaggi((prev) => {
          const exists = prev.some((msg) => msg.id === newMessage.id);
          if (exists) return prev;
          return [...prev, newMessage];
        });

        if (newMessage.mittente_id !== currentUserId && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }

        window.dispatchEvent(new Event("messaggi-updated"));
      }
    )
    .subscribe();
};

  const handleSendMessage = async (testo: string, files?: File[]) => {
    if (!authUserId || !selectedConvId) return;

    const testoFinale = (testo || "").trim() || " ";

    try {
      const sentMsg = await messaggioService.inviaMessaggio(
        selectedConvId,
        authUserId,
        testoFinale
      );

      if (sentMsg && files && files.length > 0) {
        await Promise.all(
          files.map((file) =>
            messaggioService.uploadAllegato(file, sentMsg.id, authUserId)
          )
        );
      }

      if (sentMsg && user) {
        const optimisticMsg = {
          ...sentMsg,
          mittente: {
            id: authUserId,
            nome: user.nome,
            cognome: user.cognome,
            email: user.email,
          },
          allegati: [],
        };

        setMessaggi((prev) => {
          const exists = prev.some((m) => m.id === optimisticMsg.id);
          if (exists) return prev;
          return [...prev, optimisticMsg];
        });

        await loadConversazioni(authUserId);

        if (files && files.length > 0) {
          setTimeout(() => {
            if (selectedConvId) loadMessaggi(selectedConvId);
          }, 500);
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
    if (!authUserId || !studioId) {
      toast({
        title: "Errore",
        description: "Dati utente non disponibili. Riprova ad effettuare il login.",
        variant: "destructive",
      });
      return;
    }

    setIsNewChatOpen(false);

    try {
      const conv = await messaggioService.getOrCreateConversazioneDiretta(
        authUserId,
        targetUserId,
        studioId
      );

      if (!conv) {
        throw new Error("Impossibile creare la conversazione");
      }

      await loadConversazioni(authUserId);
      handleSelectConversation(conv.id);

      toast({
        title: "✅ Chat creata",
        description: "Puoi iniziare a inviare messaggi",
      });
    } catch (error: any) {
      console.error("Errore avvio chat:", error);
      toast({
        title: "❌ Errore",
        description: error.message || "Impossibile creare la chat. Verifica i permessi.",
        variant: "destructive",
      });
    }
  };

  const createGroupChat = async () => {
    const trimmedTitle = groupTitle.trim();

    if (!authUserId || !studioId || !trimmedTitle || selectedMembers.length < 2) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Inserisci un titolo e seleziona almeno 2 membri.",
      });
      return;
    }

    try {
      const allMembers = selectedMembers.includes(authUserId)
        ? selectedMembers
        : [authUserId, ...selectedMembers];

      const conv = await messaggioService.creaConversazioneGruppo(
        trimmedTitle,
        authUserId,
        studioId,
        allMembers
      );

      if (conv) {
        setIsNewChatOpen(false);
        setGroupTitle("");
        setSelectedMembers([]);
        await loadConversazioni(authUserId);
        handleSelectConversation(conv.id);

        toast({
          title: "Gruppo creato",
          description: `Il gruppo "${trimmedTitle}" è stato creato con successo.`,
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

  const openEditGroupDialog = () => {
    if (!selectedConvId || !authUserId) return;

    const conv = conversazioni.find((c) => c.id === selectedConvId);
    if (!conv || conv.tipo !== "gruppo") return;

    const participantIds =
      conv.partecipanti
        ?.map((p: any) => p.utente_id || p.tbutenti?.id)
        .filter(Boolean) || [];

    setEditGroupId(conv.id);
    setEditGroupTitle(conv.titolo || "");
    setEditSelectedMembers(participantIds.filter((id: string) => id !== authUserId));
    setIsEditGroupOpen(true);
  };

  const saveGroupChanges = async () => {
    const trimmedTitle = editGroupTitle.trim();

    if (!authUserId || !editGroupId || !trimmedTitle || editSelectedMembers.length < 2) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Inserisci un titolo e seleziona almeno 2 membri.",
      });
      return;
    }

    try {
      const allMembers = [authUserId, ...editSelectedMembers];

      await messaggioService.aggiornaConversazioneGruppo(
        editGroupId,
        trimmedTitle,
        allMembers,
        authUserId
      );

      setIsEditGroupOpen(false);
      setEditGroupId(null);
      setEditGroupTitle("");
      setEditSelectedMembers([]);

      await loadConversazioni(authUserId);

      toast({
        title: "✅ Gruppo aggiornato",
        description: "Titolo e partecipanti aggiornati correttamente.",
      });
    } catch (error: any) {
      console.error("Error updating group:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile aggiornare il gruppo.",
      });
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleEditMember = (userId: string) => {
    setEditSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectConversation = (convId: string | null) => {
    setSelectedConvId(convId);

    if (convId) {
      const conv = conversazioni.find((c) => c.id === convId);
      setSelectedCreatorId(conv?.creato_da || null);
    } else {
      setSelectedCreatorId(null);
    }
  };

  const handleDeleteConversazione = async (conversazioneId: string) => {
    if (!authUserId) return;

    const conv = conversazioni.find((c) => c.id === conversazioneId);
    const nomeConv =
      conv?.tipo === "gruppo"
        ? conv.titolo
        : conv?.partecipanti?.find((p: any) => p.tbutenti?.email !== user?.email)
            ?.tbutenti?.nome || "questa conversazione";

    if (
      !confirm(
        `Sei sicuro di voler eliminare "${nomeConv}"? Tutti i messaggi saranno eliminati permanentemente.`
      )
    ) {
      return;
    }

    try {
      await messaggioService.eliminaConversazione(conversazioneId, authUserId);

      if (selectedConvId === conversazioneId) {
        setSelectedConvId(null);
        setSelectedCreatorId(null);
      }

      await loadConversazioni(authUserId);

      toast({
        title: "✅ Conversazione eliminata",
        description: "La conversazione e tutti i messaggi sono stati eliminati.",
      });
    } catch (error: any) {
      console.error("Errore eliminazione:", error);
      toast({
        variant: "destructive",
        title: "❌ Errore",
        description:
          error.message ||
          "Impossibile eliminare la conversazione. Solo il creatore può eliminarla.",
      });
    }
  };

  const getSelectedConversation = () => {
    return conversazioni.find((c) => c.id === selectedConvId) || null;
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

  const selectedConversation = getSelectedConversation();
  const canEditGroup =
    selectedConversation?.tipo === "gruppo" &&
    selectedConversation?.creato_da === authUserId;

  return (
    <>
      <Head>
        <title>Messaggi | Studio Manager</title>
      </Head>

      <div className="flex flex-col md:flex-row h-screen">
        <div
          className={cn(
            "w-full md:w-80 border-r bg-background flex-shrink-0 overflow-y-auto",
            selectedConvId ? "hidden md:block" : "block"
          )}
        >
          <ChatSidebar
            conversazioni={conversazioni}
            selectedId={selectedConvId}
            onSelect={handleSelectConversation}
            currentUserEmail={user?.email}
            currentUserId={authUserId}
            onNewChat={() => setIsNewChatOpen(true)}
            onDeleteConversazione={handleDeleteConversazione}
          />
        </div>

        <div
          className={cn(
            "flex-1 bg-muted/10 flex flex-col min-w-0",
            selectedConvId ? "block" : "hidden md:block"
          )}
        >
          {selectedConvId ? (
            <ChatArea
              conversazioneId={selectedConvId}
              messaggi={messaggi}
              currentUserId={authUserId!}
              partnerName={getPartnerName()}
              creatorId={selectedCreatorId || ""}
              conversationType={selectedConversation?.tipo || "diretta"}
              canEditGroup={canEditGroup}
              onEditGroup={openEditGroupDialog}
              onSendMessage={handleSendMessage}
              onBack={() => {
                setSelectedConvId(null);
                setSelectedCreatorId(null);
              }}
              onDeleteChat={() => handleDeleteConversazione(selectedConvId)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-4 py-12">
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
              <p className="text-center px-4">
                Seleziona una conversazione per iniziare
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Nuova Conversazione</DialogTitle>
          </DialogHeader>

          <Tabs
            value={newChatType}
            onValueChange={(v) => setNewChatType(v as "diretta" | "gruppo")}
          >
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
                              {u.nome?.[0]}
                              {u.cognome?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {u.nome} {u.cognome}
                            </p>
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
                            {u.nome?.[0]}
                            {u.cognome?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {u.nome} {u.cognome}
                          </p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={createGroupChat}
                  disabled={!groupTitle.trim() || selectedMembers.length < 2}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Crea Gruppo
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditGroupOpen} onOpenChange={setIsEditGroupOpen}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Modifica Gruppo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-group-title">Nome Gruppo</Label>
              <Input
                id="edit-group-title"
                placeholder="Es: Team Sviluppo"
                value={editGroupTitle}
                onChange={(e) => setEditGroupTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Membri ({editSelectedMembers.length} selezionati)</Label>
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                {utentiStudio
                  .filter((u) => u.id !== user?.id)
                  .map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer"
                      onClick={() => toggleEditMember(u.id)}
                    >
                      <Checkbox
                        checked={editSelectedMembers.includes(u.id)}
                        onCheckedChange={() => toggleEditMember(u.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {u.nome?.[0]}
                          {u.cognome?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {u.nome} {u.cognome}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={saveGroupChanges}
                disabled={!editGroupTitle.trim() || editSelectedMembers.length < 2}
              >
                Salva modifiche
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
