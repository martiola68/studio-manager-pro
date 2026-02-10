import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Send, Users, Wifi } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Team {
  id: string;
  displayName: string;
  channels: Channel[];
}

interface Channel {
  id: string;
  displayName: string;
}

export default function TestTeamsPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [message, setMessage] = useState("Messaggio di test da Studio Manager Pro 🚀");
  const { toast } = useToast();

  const callApi = async (action: string, data: any = {}) => {
    setLoading(true);
    setStatus(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Non autenticato");
      }

      const res = await fetch("/api/test-teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action, ...data })
      });

      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || "Errore sconosciuto");
      }

      return result;
    } catch (error: any) {
      console.error("Errore:", error);
      setStatus({ error: error.message });
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const checkConnection = async () => {
    const res = await callApi("check_connection");
    if (res) {
      setStatus({ success: res.isConnected ? "Connesso!" : "Non connesso" });
      if (res.isConnected) {
        toast({ title: "Connessione OK", description: "L'utente è connesso a Microsoft 365" });
      }
    }
  };

  const loadTeams = async () => {
    const res = await callApi("get_teams");
    if (res && res.teams) {
      setTeams(res.teams);
      setStatus({ success: `Trovati ${res.teams.length} team` });
    }
  };

  const sendMessage = async () => {
    if (!selectedTeam || !selectedChannel) {
      toast({ variant: "destructive", title: "Errore", description: "Seleziona Team e Canale" });
      return;
    }

    const res = await callApi("send_message", {
      teamId: selectedTeam,
      channelId: selectedChannel,
      message
    });

    if (res && res.success) {
      setStatus({ success: "Messaggio inviato correttamente!" });
      toast({ title: "Successo", description: "Messaggio inviato a Teams" });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <Users className="w-10 h-10 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Test Integrazione Teams</h1>
          <p className="text-muted-foreground">Strumento di debug per la messaggistica Teams</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: Verifica Connessione */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              1. Verifica Connessione
            </CardTitle>
            <CardDescription>
              Controlla se il token Microsoft è valido
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={checkConnection} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verifica Connessione
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Carica Teams */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              2. Carica Team
            </CardTitle>
            <CardDescription>
              Recupera lista Team e Canali
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadTeams} disabled={loading} variant="outline" className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Carica Lista Teams
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Risultato Operazioni */}
      {status && (
        <Alert variant={status.error ? "destructive" : "default"} className={status.success ? "border-green-500 bg-green-50 dark:bg-green-900/20" : ""}>
          {status.error ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
          <AlertTitle>{status.error ? "Errore" : "Successo"}</AlertTitle>
          <AlertDescription>
            {status.error || status.success}
          </AlertDescription>
        </Alert>
      )}

      {/* Step 3: Selezione e Invio */}
      {teams.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              3. Invia Messaggio
            </CardTitle>
            <CardDescription>
              Seleziona un canale e invia un messaggio di prova
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Team</Label>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona Team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Canale</Label>
                <Select value={selectedChannel} onValueChange={setSelectedChannel} disabled={!selectedTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona Canale" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams
                      .find((t) => t.id === selectedTeam)
                      ?.channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          {channel.displayName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Messaggio</Label>
              <Input 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                placeholder="Scrivi un messaggio..." 
              />
            </div>

            <Button onClick={sendMessage} disabled={loading || !selectedTeam || !selectedChannel} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Invia Messaggio di Test
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}