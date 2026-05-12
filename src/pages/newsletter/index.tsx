import { useEffect, useState } from "react";

import { Send } from "lucide-react";

import HeaderComunicazioni from "@/components/comunicazioni/HeaderComunicazioni";

import StoricoComunicazioni from "@/components/comunicazioni/StoricoComunicazioni";
import UploadAllegati from "@/components/comunicazioni/UploadAllegati";

import { comunicazioneService } from "@/services/comunicazioneService";
import { clienteService } from "@/services/clienteService";
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

type Comunicazione =
  Database["public"]["Tables"]["tbcomunicazioni"]["Row"];

type Cliente =
  Database["public"]["Tables"]["tbclienti"]["Row"];

type AllegatoComunicazione = {
  nome: string;
  tipo: string;
  dimensione: number;
  bucket: string;
  path: string;
};

export default function NewsletterPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [comunicazioni, setComunicazioni] =
    useState<Comunicazione[]>([]);

  const [clienti, setClienti] =
    useState<Cliente[]>([]);

  const [selectedFiles, setSelectedFiles] =
    useState<File[]>([]);

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

      const [comunicazioniData, clientiData] =
        await Promise.all([
          comunicazioneService.getComunicazioni(),
          clienteService.getClienti(),
        ]);

      setComunicazioni(
        comunicazioniData.filter(
          (c) => c.tipo === "newsletter"
        )
      );

      setClienti(clientiData);
    } catch (error) {
      console.error(error);

      toast({
        title: "Errore",
        description:
          "Impossibile caricare i dati",
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

      const supabase = getSupabaseClient();

      const uploadedFiles:
        AllegatoComunicazione[] = [];

      for (const file of selectedFiles) {
        const safeName =
          file.name.replace(/[^\w.\-]+/g, "_");

        const fileName = `${Date.now()}_${safeName}`;

        const filePath = `comunicazioni/${fileName}`;

        const { error } =
          await supabase.storage
            .from("messaggi-allegati")
            .upload(filePath, file);

        if (error) {
          throw error;
        }

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

  const handleSubmit = async () => {
    try {
      if (
        !formData.oggetto ||
        !formData.messaggio
      ) {
        toast({
          title: "Errore",
          description:
            "Oggetto e messaggio obbligatori",
          variant: "destructive",
        });

        return;
      }

      setSending(true);

      let allegati:
        AllegatoComunicazione[] = [];

      if (selectedFiles.length > 0) {
        allegati = await uploadAllegati();
      }

      const destinatariCount =
        clienti.filter(
          (c) =>
            c.attivo &&
            c.flag_mail_attivo &&
            c.flag_mail_newsletter
        ).length;

      await comunicazioneService.createComunicazione({
        tipo: "newsletter",
        oggetto: formData.oggetto,
        messaggio: formData.messaggio,
        allegati,
        destinatari_count:
          destinatariCount,
        stato: "Inviata",
        data_invio:
          new Date().toISOString(),
      });

        await emailService.sendComunicazioneEmail({
        tipo: "newsletter",
        oggetto: formData.oggetto,
        messaggio: formData.messaggio,
        allegati,
      });

      toast({
        title: "Newsletter inviata",
      });

      setFormData({
        oggetto: "",
        messaggio: "",
      });

      setSelectedFiles([]);

      await loadData();
    } catch (error) {
      console.error(error);

      toast({
        title: "Errore",
        description:
          "Errore invio newsletter",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (
    id: string
  ) => {
    try {
      await comunicazioneService.deleteComunicazione(
        id
      );

      toast({
        title: "Eliminata",
      });

      await loadData();
    } catch (error) {
      console.error(error);
    }
  };

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
        titolo="Newsletter"
        descrizione="Invio newsletter massive ai clienti"
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Invio Newsletter
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>
                Oggetto
              </Label>

              <Input
                value={formData.oggetto}
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
                value={formData.messaggio}
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
              files={selectedFiles}
              onChange={
                setSelectedFiles
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
                  : "Invia Newsletter"}
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
