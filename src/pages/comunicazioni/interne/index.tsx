import { useEffect, useState } from "react";
import { Send } from "lucide-react";

import HeaderComunicazioni from "@/components/comunicazioni/HeaderComunicazioni";
import StoricoComunicazioni from "@/components/comunicazioni/StoricoComunicazioni";
import UploadAllegati from "@/components/comunicazioni/UploadAllegati";

import { comunicazioneService } from "@/services/comunicazioneService";
import { emailService } from "@/services/emailService";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type Comunicazione = Database["public"]["Tables"]["tbcomunicazioni"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

type AllegatoComunicazione = {
  nome: string;
  tipo: string;
  dimensione: number;
  bucket: string;
  path: string;
};

export default function ComunicazioniInternePage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [comunicazioni, setComunicazioni] = useState<Comunicazione[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [searchUtenti, setSearchUtenti] = useState("");
  const [selectedDestinatari, setSelectedDestinatari] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    oggetto: "",
    messaggio: "",
  });

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const supabase = getSupabaseClient();

      const [comunicazioniData, utentiData] = await Promise.all([
        comunicazioneService.getComunicazioni(),
        supabase
          .from("tbutenti")
          .select("*")
          .eq("attivo", true)
          .order("cognome"),
      ]);

      setComunicazioni(
        comunicazioniData.filter((c) => c.tipo === "interna")
      );

      setUtenti(utentiData.data || []);
    } catch (error) {
      console.error(error);

      toast({
        title: "Errore",
        description: "Errore caricamento dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadAllegati = async (): Promise<AllegatoComunicazione[]> => {
    if (selectedFiles.length === 0) return [];

    const supabase = getSupabaseClient();
    const uploadedFiles: AllegatoComunicazione[] = [];

    for (const file of selectedFiles) {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const fileName = `${Date.now()}_${safeName}`;
      const filePath = `comunicazioni/${fileName}`;

      const { error } = await supabase.storage
        .from("messaggi-allegati")
        .upload(filePath, file);

      if (error) throw error;

      uploadedFiles.push({
        nome: file.name,
        tipo: file.type,
        dimensione: file.size,
        bucket: "messaggi-allegati",
        path: filePath,
      });
    }

    return uploadedFiles;
  };

  const handleToggleUtente = (id: string) => {
    setSelectedDestinatari((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedDestinatari(utentiFiltrati.map((u) => u.id));
  };

  const handleClearAll = () => {
    setSelectedDestinatari([]);
  };

 const handleSelectBySettore = (settore: string) => {
  const ids = utenti
    .filter(
      (u) =>
        String((u as any).settore || "").toLowerCase() === settore
    )
    .map((u) => u.id);

  setSelectedDestinatari((prev) => [
    ...new Set([...prev, ...ids]),
  ]);
};
  
  const handleSubmit = async () => {
    try {
      if (!formData.oggetto || !formData.messaggio) {
        toast({
          title: "Errore",
          description: "Oggetto e messaggio obbligatori",
          variant: "destructive",
        });

        return;
      }

      if (selectedDestinatari.length === 0) {
        toast({
          title: "Errore",
          description: "Seleziona almeno un destinatario",
          variant: "destructive",
        });

        return;
      }

      setSending(true);

      const allegati =
        selectedFiles.length > 0 ? await uploadAllegati() : [];

      await comunicazioneService.createComunicazione({
        tipo: "interna",
        oggetto: formData.oggetto,
        messaggio: formData.messaggio,
        allegati,
        destinatari_count: selectedDestinatari.length,
        stato: "Inviata",
        data_invio: new Date().toISOString(),
      });

      await emailService.sendComunicazioneEmail({
        tipo: "interna",
        destinatariIds: selectedDestinatari,
        oggetto: formData.oggetto,
        messaggio: formData.messaggio,
        allegati,
      });

      toast({
        title: "Comunicazione inviata",
      });

      setFormData({
        oggetto: "",
        messaggio: "",
      });

      setSelectedFiles([]);
      setSelectedDestinatari([]);

      await loadData();
    } catch (error) {
      console.error(error);

      toast({
        title: "Errore",
        description: "Errore invio comunicazione",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await comunicazioneService.deleteComunicazione(id);

      toast({
        title: "Comunicazione eliminata",
      });

      await loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const utentiFiltrati = utenti.filter((u) => {
    const nome = `${u.nome || ""} ${u.cognome || ""}`.toLowerCase();

    return nome.includes(searchUtenti.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Caricamento...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-1 md:px-8 md:pb-8 md:pt-2">
      <HeaderComunicazioni
        titolo="Comunicazioni Interne"
        descrizione="Invio comunicazioni agli operatori dello studio"
      />

      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Nuova Comunicazione</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_360px] md:items-start">
   <div className="space-y-2">
  <div className="h-[24px] flex items-center">
    <Label>Cerca destinatari</Label>
  </div>

  <Input
    value={searchUtenti}
    onChange={(e) => setSearchUtenti(e.target.value)}
    placeholder="Cerca utenti..."
    className="w-full"
  />

  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      <Button type="button" variant="outline" size="sm" onClick={() => handleSelectBySettore("fiscale")}>
        Fiscale
      </Button>

      <Button type="button" variant="outline" size="sm" onClick={() => handleSelectBySettore("lavoro")}>
        Lavoro
      </Button>

      <Button type="button" variant="outline" size="sm" onClick={() => handleSelectBySettore("consulenza")}>
        Consulenza
      </Button>

      <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
        Tutti
      </Button>

      <Button type="button" variant="outline" size="sm" onClick={handleClearAll}>
        Deseleziona
      </Button>
    </div>

    <p className="text-sm text-gray-500">
      Selezionati: {selectedDestinatari.length}
    </p>
  </div>

<div className="mt-[24px] max-h-[150px] overflow-y-auto rounded-md border p-2">
    {utentiFiltrati.map((utente) => (
      <label
        key={utente.id}
        className="flex cursor-pointer items-center gap-2 border-b py-2 text-sm hover:bg-gray-50"
      >
        <Checkbox
          checked={selectedDestinatari.includes(utente.id)}
          onCheckedChange={() => handleToggleUtente(utente.id)}
        />

        <span>
          {utente.nome} {utente.cognome}
          {(utente as any).settore && (
            <span className="ml-2 text-gray-500">
              ({(utente as any).settore})
            </span>
          )}
        </span>
      </label>
    ))}
  </div>
</div>

            <div className="space-y-2">
              <Label>Oggetto</Label>

              <Input
                value={formData.oggetto}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    oggetto: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Messaggio</Label>

              <Textarea
                rows={9}
                value={formData.messaggio}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    messaggio: e.target.value,
                  }))
                }
              />
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="w-full md:max-w-xl">
                <UploadAllegati
                  files={selectedFiles}
                  onChange={setSelectedFiles}
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={sending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Invio..." : "Invia Comunicazione"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <StoricoComunicazioni
          comunicazioni={comunicazioni}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
