import { useEffect, useState } from "react";

import { Send } from "lucide-react";

import HeaderComunicazioni from "@/components/comunicazioni/HeaderComunicazioni";
import SimulazioneInvio from "@/components/comunicazioni/SimulazioneInvio";
import StoricoComunicazioni from "@/components/comunicazioni/StoricoComunicazioni";
import UploadAllegati from "@/components/comunicazioni/UploadAllegati";

import { comunicazioneService } from "@/services/comunicazioneService";
import { emailService } from "@/services/emailService";

import { getSupabaseClient } from "@/lib/supabase/client";

import type { Database } from "@/lib/supabase/types";

import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

import { Checkbox } from "@/components/ui/checkbox";

type Comunicazione =
  Database["public"]["Tables"]["tbcomunicazioni"]["Row"];

type Utente =
  Database["public"]["Tables"]["tbutenti"]["Row"];

type AllegatoComunicazione = {
  nome: string;
  tipo: string;
  dimensione: number;
  bucket: string;
  path: string;
};

export default function ComunicazioniInternePage() {
  const { toast } = useToast();

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [comunicazioni, setComunicazioni] =
    useState<Comunicazione[]>([]);

  const [utenti, setUtenti] =
    useState<Utente[]>([]);

  const [selectedFiles, setSelectedFiles] =
    useState<File[]>([]);

  const [simulazioneInvio, setSimulazioneInvio] =
    useState(true);

  const [searchUtenti, setSearchUtenti] =
    useState("");

  const [selectedDestinatari, setSelectedDestinatari] =
    useState<string[]>([]);

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

      const supabase =
        getSupabaseClient();

      const [
        comunicazioniData,
        utentiData,
      ] = await Promise.all([
        comunicazioneService.getComunicazioni(),

        supabase
          .from("tbutenti")
          .select("*")
          .eq("attivo", true)
          .order("cognome"),
      ]);

      setComunicazioni(
        comunicazioniData.filter(
          (c) => c.tipo === "interna"
        )
      );

      setUtenti(
        utentiData.data || []
      );
    } catch (error) {
      console.error(error);

      toast({
        title: "Errore",
        description:
          "Errore caricamento dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadAllegati =
    async (): Promise<
      AllegatoComunicazione[]
    > => {
      if (selectedFiles.length === 0) {
        return [];
      }

      const supabase =
        getSupabaseClient();

      const uploadedFiles:
        AllegatoComunicazione[] = [];

      for (const file of selectedFiles) {
        const safeName =
          file.name.replace(
            /[^\w.\-]+/g,
            "_"
          );

        const fileName = `${Date.now()}_${safeName}`;

        const filePath = `comunicazioni/${fileName}`;

        const { error } =
          await supabase.storage
            .from("messaggi-allegati")
            .upload(
              filePath,
              file
            );

        if (error) {
          throw error;
        }

        uploadedFiles.push({
          nome: file.name,
          tipo: file.type,
          dimensione: file.size,
          bucket:
            "messaggi-allegati",
          path: filePath,
        });
      }

      return uploadedFiles;
    };

  const handleToggleUtente = (
    id: string
  ) => {
    setSelectedDestinatari(
      (prev) =>
        prev.includes(id)
          ? prev.filter(
              (x) => x !== id
            )
          : [...prev, id]
    );
  };

  const handleSubmit =
    async () => {
      try {
        if (
          !formData.oggetto ||
          !formData.messaggio
        ) {
          toast({
            title: "Errore",
            description:
              "Oggetto e messaggio obbligatori",
            variant:
              "destructive",
          });

          return;
        }

        if (
          selectedDestinatari.length ===
          0
        ) {
          toast({
            title: "Errore",
            description:
              "Seleziona almeno un destinatario",
            variant:
              "destructive",
          });

          return;
        }

        setSending(true);

        let allegati:
          AllegatoComunicazione[] =
          [];

        if (
          selectedFiles.length > 0
        ) {
          allegati =
            await uploadAllegati();
        }

        await comunicazioneService.createComunicazione(
          {
            tipo: "interna",
            oggetto:
              formData.oggetto,
            messaggio:
              formData.messaggio,
            allegati,
            destinatari_count:
              selectedDestinatari.length,
            stato: "Inviata",
            data_invio:
              new Date().toISOString(),
          }
        );

        if (
          simulazioneInvio
        ) {
          toast({
            title:
              "Simulazione invio",
            description: `Nessuna email inviata. Destinatari previsti: ${selectedDestinatari.length}`,
          });

          return;
        }

        await emailService.sendComunicazioneEmail(
          {
            tipo: "interna",
            destinatariIds:
              selectedDestinatari,
            oggetto:
              formData.oggetto,
            messaggio:
              formData.messaggio,
            allegati,
          }
        );

        toast({
          title:
            "Comunicazione inviata",
        });

        setFormData({
          oggetto: "",
          messaggio: "",
        });

        setSelectedFiles([]);

        setSelectedDestinatari(
          []
        );

        await loadData();
      } catch (error) {
        console.error(error);

        toast({
          title: "Errore",
          description:
            "Errore invio comunicazione",
          variant:
            "destructive",
        });
      } finally {
        setSending(false);
      }
    };

  const handleDelete =
    async (id: string) => {
      try {
        await comunicazioneService.deleteComunicazione(
          id
        );

        toast({
          title:
            "Comunicazione eliminata",
        });

        await loadData();
      } catch (error) {
        console.error(error);
      }
    };

  const utentiFiltrati =
    utenti.filter((u) => {
      const nome =
        `${u.nome} ${u.cognome}`.toLowerCase();

      return nome.includes(
        searchUtenti.toLowerCase()
      );
    });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Caricamento...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <HeaderComunicazioni
        titolo="Comunicazioni Interne"
        descrizione="Invio comunicazioni agli operatori dello studio"
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Nuova Comunicazione
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>
                Cerca destinatari
              </Label>

              <Input
                value={
                  searchUtenti
                }
                onChange={(e) =>
                  setSearchUtenti(
                    e.target.value
                  )
                }
                placeholder="Cerca utenti..."
              />
            </div>

            <div className="max-h-[260px] overflow-y-auto rounded-md border p-2">
              {utentiFiltrati.map(
                (utente) => (
                  <div
                    key={utente.id}
                    className="flex items-center gap-2 border-b py-2"
                  >
                    <Checkbox
                      checked={selectedDestinatari.includes(
                        utente.id
                      )}
                      onCheckedChange={() =>
                        handleToggleUtente(
                          utente.id
                        )
                      }
                    />

                    <span>
                      {utente.nome}{" "}
                      {utente.cognome}
                    </span>
                  </div>
                )
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Oggetto
              </Label>

              <Input
                value={
                  formData.oggetto
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    oggetto:
                      e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Messaggio
              </Label>

              <Textarea
                rows={10}
                value={
                  formData.messaggio
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    messaggio:
                      e.target.value,
                  })
                }
              />
            </div>

            <UploadAllegati
              files={
                selectedFiles
              }
              onChange={
                setSelectedFiles
              }
            />

            <SimulazioneInvio
              value={
                simulazioneInvio
              }
              onChange={
                setSimulazioneInvio
              }
            />

            <div className="flex justify-end">
              <Button
                onClick={
                  handleSubmit
                }
                disabled={sending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="mr-2 h-4 w-4" />

                {sending
                  ? "Invio..."
                  : "Invia Comunicazione"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <StoricoComunicazioni
          comunicazioni={
            comunicazioni
          }
          onDelete={
            handleDelete
          }
        />
      </div>
    </div>
  );
}
