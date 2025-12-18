import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { eventoService } from "@/services/eventoService";
import { clienteService } from "@/services/clienteService";
import { utenteService } from "@/services/utenteService";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Plus, Edit, Trash2, MapPin, Building2, Clock, Navigation, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type EventoAgenda = Database["public"]["Tables"]["tbagenda"]["Row"];
type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type Utente = Database["public"]["Tables"]["tbutenti"]["Row"];

const SALE = ["Riunioni", "Briefing", "Stanza Personale"];

export default function AgendaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [eventi, setEventi] = useState<EventoAgenda[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  const [vistaCorrente, setVistaCorrente] = useState<"mensile" | "settimanale">("mensile");
  const [dataSelezionata, setDataSelezionata] = useState(new Date());
  const [filtroUtente, setFiltroUtente] = useState("__all__");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvento, setEditingEvento] = useState<EventoAgenda | null>(null);

  const [formData, setFormData] = useState({
    titolo: "",
    descrizione: "",
    data_inizio: "",
    data_fine: "",
    tutto_giorno: false,
    utente_id: "",
    cliente_id: "",
    evento_generico: false,
    in_sede: true,
    sala: "",
    luogo: "",
    partecipanti: [] as string[],
    invia_a_tutti: false
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const utentiData = await utenteService.getUtenti();
      const utenteCorrente = utentiData.find(u => u.email === session.user.email);
      setCurrentUser(utenteCorrente || null);
      setFormData(prev => ({ ...prev, utente_id: utenteCorrente?.id || "" }));

      await loadData();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventiData, clientiData, utentiData] = await Promise.all([
        eventoService.getEventi(),
        clienteService.getClienti(),
        utenteService.getUtenti()
      ]);
      setEventi(eventiData);
      setClienti(clientiData);
      setUtenti(utentiData);
    } catch (error) {
      console.error("Errore caricamento:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Funzione per determinare automaticamente il colore dell'evento
  const getColoreEvento = (eventoGenerico: boolean, inSede: boolean): string => {
    if (eventoGenerico) {
      return "#3B82F6"; // BLU - Eventi generici
    }
    return inSede ? "#10B981" : "#EF4444"; // VERDE - In sede, ROSSO - Fuori sede
  };

  // Funzione per generare file .ics (iCalendar) per email
  const generaFileICS = (evento: any): string => {
    const formatDateICS = (dateString: string): string => {
      const date = new Date(dateString);
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Studio Manager Pro//Agenda//IT',
      'BEGIN:VEVENT',
      `UID:${evento.id || Date.now()}@studiomanagerpro.it`,
      `DTSTAMP:${formatDateICS(new Date().toISOString())}`,
      `DTSTART:${formatDateICS(evento.data_inizio)}`,
      `DTEND:${formatDateICS(evento.data_fine)}`,
      `SUMMARY:${evento.titolo}`,
      evento.descrizione ? `DESCRIPTION:${evento.descrizione.replace(/\n/g, '\\n')}` : '',
      evento.luogo ? `LOCATION:${evento.luogo}` : '',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    return icsContent;
  };

  // Funzione per preparare e inviare email ai partecipanti
  const inviaEmailPartecipanti = async (partecipantiIds: string[], eventoData: any) => {
    if (partecipantiIds.length === 0) return;

    try {
      // Recupera dati completi partecipanti
      const partecipantiCompleti = utenti.filter(u => partecipantiIds.includes(u.id));
      
      // Recupera dati cliente se presente
      const clienteData = eventoData.cliente_id 
        ? clienti.find(c => c.id === eventoData.cliente_id)
        : null;

      // Genera link Google Maps se c'è un indirizzo
      const googleMapsLink = eventoData.luogo 
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(eventoData.luogo)}`
        : null;

      // Genera file .ics per allegato calendario
      const icsFile = generaFileICS(eventoData);

      // Prepara i dati per l'email
      const emailData = {
        destinatari: partecipantiCompleti.map(p => ({
          email: p.email,
          nome: `${p.nome} ${p.cognome}`
        })),
        oggetto: `Nuovo Evento: ${eventoData.titolo}`,
        corpo: {
          titolo: eventoData.titolo,
          descrizione: eventoData.descrizione,
          dataInizio: new Date(eventoData.data_inizio).toLocaleString('it-IT', {
            dateStyle: 'full',
            timeStyle: 'short'
          }),
          dataFine: new Date(eventoData.data_fine).toLocaleString('it-IT', {
            dateStyle: 'full',
            timeStyle: 'short'
          }),
          tuttoGiorno: eventoData.tutto_giorno,
          cliente: clienteData ? {
            ragioneSociale: clienteData.ragione_sociale,
            indirizzo: `${clienteData.indirizzo}, ${clienteData.cap} ${clienteData.citta} (${clienteData.provincia})`,
            telefono: "N/D", // Campo non presente in tabella tbclienti
            email: clienteData.email
          } : null,
          eventoGenerico: !eventoData.cliente_id,
          inSede: eventoData.in_sede,
          sala: eventoData.sala,
          luogo: eventoData.luogo,
          googleMapsLink: googleMapsLink,
          numeroPartecipanti: partecipantiIds.length,
          tipoEvento: eventoData.evento_generico ? 'Evento Generico' : 
                      eventoData.in_sede ? 'Appuntamento in Sede' : 'Appuntamento Fuori Sede'
        },
        allegati: [
          {
            filename: `evento-${eventoData.titolo.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`,
            content: icsFile,
            contentType: 'text/calendar'
          }
        ]
      };

      // TODO: Integrare con servizio email (SendGrid, AWS SES, Resend, ecc.)
      // Esempio con SendGrid:
      /*
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailData.destinatari,
          subject: emailData.oggetto,
          html: generaTemplateEmail(emailData.corpo),
          attachments: emailData.allegati
        })
      });
      
      if (!response.ok) throw new Error('Errore invio email');
      */

      // Per ora: log dei dati preparati
      console.log('📧 Email preparata per invio:', emailData);
      
      // Simulazione invio riuscito
      return {
        success: true,
        destinatari: partecipantiCompleti.length,
        emailData
      };

    } catch (error) {
      console.error('Errore preparazione email:', error);
      throw error;
    }
  };

  // Template HTML per email (pronto per l'invio)
  const generaTemplateEmail = (dati: any): string => {
    const coloreEvento = dati.eventoGenerico ? '#3B82F6' : 
                        dati.inSede ? '#10B981' : '#EF4444';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuovo Evento - Studio Manager Pro</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">📅 Nuovo Evento in Agenda</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Studio Manager Pro</p>
        </div>

        <!-- Contenuto -->
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          
          <!-- Tipo Evento Badge -->
          <div style="margin-bottom: 20px;">
            <span style="background: ${coloreEvento}; color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
              ${dati.tipoEvento}
            </span>
          </div>

          <!-- Titolo Evento -->
          <h2 style="color: ${coloreEvento}; margin: 0 0 20px 0; font-size: 22px;">
            ${dati.titolo}
          </h2>

          <!-- Descrizione -->
          ${dati.descrizione ? `
            <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid ${coloreEvento};">
              <p style="margin: 0; color: #555;">${dati.descrizione}</p>
            </div>
          ` : ''}

          <!-- Info Evento -->
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            
            <!-- Data e Ora -->
            <div style="margin-bottom: 15px; padding: 10px; background: #f0f9ff; border-radius: 6px;">
              <p style="margin: 0; font-weight: bold; color: #0284c7;">📅 Data e Ora</p>
              <p style="margin: 5px 0 0 0; color: #333;">
                <strong>Inizio:</strong> ${dati.dataInizio}<br>
                <strong>Fine:</strong> ${dati.dataFine}
                ${dati.tuttoGiorno ? '<br><em>Evento tutto il giorno</em>' : ''}
              </p>
            </div>

            <!-- Cliente (se presente) -->
            ${dati.cliente ? `
              <div style="margin-bottom: 15px; padding: 10px; background: #fef3c7; border-radius: 6px;">
                <p style="margin: 0; font-weight: bold; color: #d97706;">🏢 Cliente</p>
                <p style="margin: 5px 0 0 0; color: #333;">
                  <strong>${dati.cliente.ragioneSociale}</strong><br>
                  ${dati.cliente.indirizzo}<br>
                  📞 ${dati.cliente.telefono || 'N/D'}<br>
                  ✉️ ${dati.cliente.email}
                </p>
              </div>
            ` : ''}

            <!-- Luogo -->
            ${dati.inSede ? `
              <div style="margin-bottom: 15px; padding: 10px; background: #d1fae5; border-radius: 6px;">
                <p style="margin: 0; font-weight: bold; color: #059669;">🏢 Sede Studio</p>
                ${dati.sala ? `<p style="margin: 5px 0 0 0; color: #333;"><strong>Sala:</strong> ${dati.sala}</p>` : ''}
              </div>
            ` : ''}

            ${dati.luogo && !dati.inSede ? `
              <div style="margin-bottom: 15px; padding: 10px; background: #fee2e2; border-radius: 6px;">
                <p style="margin: 0; font-weight: bold; color: #dc2626;">📍 Fuori Sede</p>
                <p style="margin: 5px 0 0 0; color: #333;">${dati.luogo}</p>
                ${dati.googleMapsLink ? `
                  <a href="${dati.googleMapsLink}" 
                     style="display: inline-block; margin-top: 10px; background: #dc2626; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    🗺️ Apri in Google Maps
                  </a>
                ` : ''}
              </div>
            ` : ''}

            <!-- Partecipanti -->
            ${dati.numeroPartecipanti > 1 ? `
              <div style="padding: 10px; background: #ede9fe; border-radius: 6px;">
                <p style="margin: 0; font-weight: bold; color: #7c3aed;">👥 Partecipanti</p>
                <p style="margin: 5px 0 0 0; color: #333;">
                  ${dati.numeroPartecipanti} persone invitate a questo evento
                </p>
              </div>
            ` : ''}

          </div>

          <!-- Allegato Calendario -->
          <div style="background: #fff7ed; border: 2px dashed #f59e0b; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <p style="margin: 0; color: #92400e;">
              📎 <strong>Allegato incluso:</strong> File .ics per aggiungere l'evento al tuo calendario
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">Questa è una notifica automatica da Studio Manager Pro</p>
            <p style="margin: 5px 0 0 0;">Per modifiche o cancellazioni, accedi alla piattaforma</p>
          </div>

        </div>

      </body>
      </html>
    `;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titolo || !formData.data_inizio || !formData.data_fine) {
      toast({
        title: "Errore",
        description: "Compila i campi obbligatori (Titolo, Data Inizio, Data Fine)",
        variant: "destructive"
      });
      return;
    }

    if (!formData.evento_generico && !formData.cliente_id) {
      toast({
        title: "Errore",
        description: "Seleziona un cliente oppure attiva 'Evento Generico'",
        variant: "destructive"
      });
      return;
    }

    try {
      // Determina automaticamente il colore
      const colore = getColoreEvento(formData.evento_generico, formData.in_sede);

      // Se "Invia a tutti" è attivo, prendi tutti gli ID utenti
      const partecipantiFinal = formData.invia_a_tutti 
        ? utenti.map(u => u.id)
        : formData.partecipanti;

      const dataToSave = {
        titolo: formData.titolo,
        descrizione: formData.descrizione,
        data_inizio: formData.data_inizio,
        data_fine: formData.data_fine,
        tutto_giorno: formData.tutto_giorno,
        utente_id: formData.utente_id || null,
        cliente_id: formData.evento_generico ? null : (formData.cliente_id || null),
        in_sede: formData.in_sede,
        sala: formData.sala || null,
        luogo: formData.luogo || null,
        colore: colore,
        partecipanti: partecipantiFinal
      };

      if (editingEvento) {
        await eventoService.updateEvento(editingEvento.id, dataToSave);
        toast({
          title: "Successo",
          description: "Evento aggiornato con successo"
        });
      } else {
        await eventoService.createEvento(dataToSave);
        toast({
          title: "Successo",
          description: "Evento creato con successo"
        });
      }

      // Invia email ai partecipanti
      if (partecipantiFinal.length > 0) {
        try {
          const risultatoEmail = await inviaEmailPartecipanti(partecipantiFinal, dataToSave);
          toast({
            title: "Email preparate",
            description: `Sistema pronto per inviare ${risultatoEmail.destinatari} email di notifica`,
          });
        } catch (emailError) {
          console.error('Errore invio email:', emailError);
          toast({
            title: "Attenzione",
            description: "Evento salvato ma errore nell'invio delle email",
            variant: "destructive"
          });
        }
      }

      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare l'evento",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (evento: EventoAgenda) => {
    setEditingEvento(evento);
    
    // Parse partecipanti from JSON
    let partecipantiArray: string[] = [];
    let inviaATutti = false;
    
    if (evento.partecipanti) {
      try {
        partecipantiArray = Array.isArray(evento.partecipanti) 
          ? evento.partecipanti.map(p => String(p)) 
          : [];
        
        // Se i partecipanti sono tutti gli utenti, attiva "invia a tutti"
        if (partecipantiArray.length === utenti.length && 
            utenti.every(u => partecipantiArray.includes(u.id))) {
          inviaATutti = true;
        }
      } catch {
        partecipantiArray = [];
      }
    }

    // CRITICAL FIX: Convert ISO datetime to datetime-local format
    const convertToDatetimeLocal = (isoString: string): string => {
      if (!isoString) return "";
      try {
        const date = new Date(isoString);
        // Format: YYYY-MM-DDTHH:mm (datetime-local input format)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      } catch {
        return "";
      }
    };

    setFormData({
      titolo: evento.titolo,
      descrizione: evento.descrizione || "",
      data_inizio: convertToDatetimeLocal(evento.data_inizio),
      data_fine: convertToDatetimeLocal(evento.data_fine),
      tutto_giorno: evento.tutto_giorno || false,
      utente_id: evento.utente_id || "",
      cliente_id: evento.cliente_id || "",
      evento_generico: !evento.cliente_id,
      in_sede: evento.in_sede ?? true,
      sala: evento.sala || "",
      luogo: evento.luogo || "",
      partecipanti: partecipantiArray,
      invia_a_tutti: inviaATutti
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo evento?")) return;

    try {
      await eventoService.deleteEvento(id);
      toast({
        title: "Successo",
        description: "Evento eliminato con successo"
      });
      await loadData();
    } catch (error) {
      console.error("Errore eliminazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'evento",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      titolo: "",
      descrizione: "",
      data_inizio: "",
      data_fine: "",
      tutto_giorno: false,
      utente_id: currentUser?.id || "",
      cliente_id: "",
      evento_generico: false,
      in_sede: true,
      sala: "",
      luogo: "",
      partecipanti: [],
      invia_a_tutti: false
    });
    setEditingEvento(null);
  };

  const apriGoogleMaps = (indirizzo: string) => {
    if (!indirizzo.trim()) {
      toast({
        title: "Indirizzo mancante",
        description: "Inserisci un indirizzo per calcolare il percorso",
        variant: "destructive"
      });
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(indirizzo)}`;
    window.open(url, "_blank");
  };

  const togglePartecipante = (utenteId: string) => {
    setFormData(prev => ({
      ...prev,
      partecipanti: prev.partecipanti.includes(utenteId)
        ? prev.partecipanti.filter(id => id !== utenteId)
        : [...prev.partecipanti, utenteId]
    }));
  };

  const getPartecipantiEvento = (evento: EventoAgenda): Utente[] => {
    if (!evento.partecipanti) return [];
    try {
      const partecipantiIds = Array.isArray(evento.partecipanti) 
        ? evento.partecipanti.map(p => String(p)) 
        : [];
      return utenti.filter(u => partecipantiIds.includes(u.id));
    } catch {
      return [];
    }
  };

  const getEventiPerGiorno = (data: Date) => {
    return eventi.filter(e => {
      const eventoData = new Date(e.data_inizio);
      return (
        eventoData.getDate() === data.getDate() &&
        eventoData.getMonth() === data.getMonth() &&
        eventoData.getFullYear() === data.getFullYear() &&
        (filtroUtente === "__all__" || e.utente_id === filtroUtente)
      );
    });
  };

  const renderCalendarioMensile = () => {
    const anno = dataSelezionata.getFullYear();
    const mese = dataSelezionata.getMonth();
    const primoGiornoMese = new Date(anno, mese, 1);
    const ultimoGiornoMese = new Date(anno, mese + 1, 0);
    const primoGiornoVista = new Date(primoGiornoMese);
    primoGiornoVista.setDate(primoGiornoVista.getDate() - primoGiornoVista.getDay());

    const giorniVista = [];
    const dataCorrente = new Date(primoGiornoVista);

    for (let i = 0; i < 42; i++) {
      giorniVista.push(new Date(dataCorrente));
      dataCorrente.setDate(dataCorrente.getDate() + 1);
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"].map((giorno) => (
          <div key={giorno} className="text-center font-semibold text-sm py-2 bg-gray-100 rounded">
            {giorno}
          </div>
        ))}
        {giorniVista.map((data, idx) => {
          const eventiGiorno = getEventiPerGiorno(data);
          const fuoriMese = data.getMonth() !== mese;
          const oggi = new Date().toDateString() === data.toDateString();

          return (
            <div
              key={idx}
              className={`min-h-[100px] border rounded-lg p-2 ${
                fuoriMese ? "bg-gray-50 text-gray-400" : "bg-white"
              } ${oggi ? "ring-2 ring-blue-500" : ""}`}
            >
              <div className="text-sm font-semibold mb-1">{data.getDate()}</div>
              <div className="space-y-1">
                {eventiGiorno.slice(0, 3).map((evento) => (
                  <div
                    key={evento.id}
                    className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: evento.colore || "#3B82F6", color: "white" }}
                    onClick={() => handleEdit(evento)}
                  >
                    {evento.titolo}
                  </div>
                ))}
                {eventiGiorno.length > 3 && (
                  <div className="text-xs text-gray-500">+{eventiGiorno.length - 3} altri</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCalendarioSettimanale = () => {
    const inizioSettimana = new Date(dataSelezionata);
    inizioSettimana.setDate(dataSelezionata.getDate() - dataSelezionata.getDay());

    const giorniSettimana = [];
    for (let i = 0; i < 7; i++) {
      const data = new Date(inizioSettimana);
      data.setDate(inizioSettimana.getDate() + i);
      giorniSettimana.push(data);
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {giorniSettimana.map((data) => {
          const eventiGiorno = getEventiPerGiorno(data);
          const oggi = new Date().toDateString() === data.toDateString();

          return (
            <div key={data.toISOString()} className={`border rounded-lg p-3 ${oggi ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white"}`}>
              <div className="text-center mb-3">
                <div className="text-xs text-gray-500">
                  {data.toLocaleDateString("it-IT", { weekday: "short" })}
                </div>
                <div className="text-lg font-bold">{data.getDate()}</div>
              </div>
              <div className="space-y-2">
                {eventiGiorno.map((evento) => {
                  const utenteEvento = utenti.find(u => u.id === evento.utente_id);
                  const clienteEvento = clienti.find(c => c.id === evento.cliente_id);
                  const partecipantiEvento = getPartecipantiEvento(evento);
                  
                  return (
                    <div
                      key={evento.id}
                      className="text-xs p-2 rounded cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: evento.colore || "#3B82F6", color: "white" }}
                      onClick={() => handleEdit(evento)}
                    >
                      <div className="font-semibold truncate">{evento.titolo}</div>
                      {!evento.tutto_giorno && (
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {new Date(evento.data_inizio).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                      {evento.in_sede && evento.sala && (
                        <div className="flex items-center gap-1 mt-1">
                          <Building2 className="h-3 w-3" />
                          {evento.sala}
                        </div>
                      )}
                      {evento.luogo && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{evento.luogo}</span>
                        </div>
                      )}
                      {partecipantiEvento.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Users className="h-3 w-3" />
                          <span>{partecipantiEvento.length} partecipanti</span>
                        </div>
                      )}
                      {clienteEvento && (
                        <div className="text-[10px] mt-1 opacity-90 truncate">
                          {clienteEvento.ragione_sociale}
                        </div>
                      )}
                      {utenteEvento && (
                        <div className="text-[10px] mt-1 opacity-90">
                          {utenteEvento.nome} {utenteEvento.cognome}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const cambiaSettimana = (direzione: number) => {
    const nuovaData = new Date(dataSelezionata);
    nuovaData.setDate(nuovaData.getDate() + (direzione * 7));
    setDataSelezionata(nuovaData);
  };

  const cambiaMese = (direzione: number) => {
    const nuovaData = new Date(dataSelezionata);
    nuovaData.setMonth(nuovaData.getMonth() + direzione);
    setDataSelezionata(nuovaData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Agenda</h1>
                <p className="text-gray-500 mt-1">Gestione appuntamenti e calendario</p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuovo Evento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingEvento ? "Modifica Evento" : "Nuovo Evento"}
                    </DialogTitle>
                    <DialogDescription>
                      Inserisci i dettagli dell'evento
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="titolo">Titolo *</Label>
                      <Input
                        id="titolo"
                        value={formData.titolo}
                        onChange={(e) => setFormData({ ...formData, titolo: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="descrizione">Descrizione</Label>
                      <Textarea
                        id="descrizione"
                        value={formData.descrizione}
                        onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="data_inizio">Data/Ora Inizio *</Label>
                        <Input
                          id="data_inizio"
                          type="datetime-local"
                          value={formData.data_inizio}
                          onChange={(e) => setFormData({ ...formData, data_inizio: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="data_fine">Data/Ora Fine *</Label>
                        <Input
                          id="data_fine"
                          type="datetime-local"
                          value={formData.data_fine}
                          onChange={(e) => setFormData({ ...formData, data_fine: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="tutto_giorno"
                        checked={formData.tutto_giorno}
                        onChange={(e) => setFormData({ ...formData, tutto_giorno: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="tutto_giorno" className="cursor-pointer">Tutto il giorno</Label>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex items-center space-x-2 mb-4">
                        <input
                          type="checkbox"
                          id="evento_generico"
                          checked={formData.evento_generico}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            evento_generico: e.target.checked,
                            cliente_id: e.target.checked ? "" : formData.cliente_id
                          })}
                          className="rounded"
                        />
                        <Label htmlFor="evento_generico" className="cursor-pointer font-semibold">
                          Evento Generico (senza cliente)
                        </Label>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                        <p className="font-semibold mb-2">ℹ️ Colori automatici:</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#3B82F6" }}></div>
                            <span>Blu → Evento generico (senza cliente)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#10B981" }}></div>
                            <span>Verde → Appuntamento in sede</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#EF4444" }}></div>
                            <span>Rosso → Appuntamento fuori sede</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="utente_id">Utente Responsabile</Label>
                        <Select
                          value={formData.utente_id || "__none__"}
                          onValueChange={(value) => setFormData({ ...formData, utente_id: value === "__none__" ? "" : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona utente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Nessuno</SelectItem>
                            {utenti.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.nome} {u.cognome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cliente_id">
                          Cliente {!formData.evento_generico && <span className="text-red-500">*</span>}
                        </Label>
                        <Select
                          value={formData.cliente_id || "__none__"}
                          onValueChange={(value) => setFormData({ ...formData, cliente_id: value === "__none__" ? "" : value })}
                          disabled={formData.evento_generico}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={formData.evento_generico ? "Non richiesto" : "Seleziona cliente"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Nessuno</SelectItem>
                            {clienti.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.ragione_sociale}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex items-center space-x-2 mb-4">
                        <input
                          type="checkbox"
                          id="in_sede"
                          checked={formData.in_sede}
                          onChange={(e) => setFormData({ ...formData, in_sede: e.target.checked })}
                          className="rounded"
                          disabled={formData.evento_generico}
                        />
                        <Label htmlFor="in_sede" className="cursor-pointer">
                          In Sede {formData.evento_generico && "(non applicabile per eventi generici)"}
                        </Label>
                      </div>

                      {formData.in_sede && !formData.evento_generico && (
                        <div className="space-y-2 mb-4">
                          <Label htmlFor="sala">Sala</Label>
                          <Select
                            value={formData.sala || "__none__"}
                            onValueChange={(value) => setFormData({ ...formData, sala: value === "__none__" ? "" : value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona sala" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nessuna</SelectItem>
                              {SALE.map((sala) => (
                                <SelectItem key={sala} value={sala}>
                                  {sala}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="luogo">Indirizzo / Luogo</Label>
                        <div className="flex gap-2">
                          <Input
                            id="luogo"
                            value={formData.luogo}
                            onChange={(e) => setFormData({ ...formData, luogo: e.target.value })}
                            placeholder="Via Roma 1, Milano"
                            className="flex-1"
                          />
                          {formData.luogo && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => apriGoogleMaps(formData.luogo)}
                              className="flex-shrink-0"
                            >
                              <Navigation className="h-4 w-4 mr-2" />
                              Percorso
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Inserisci un indirizzo per calcolare il percorso con Google Maps
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        Partecipanti (Notifiche Email)
                      </h3>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800">
                          📧 I partecipanti selezionati riceveranno un'email con i dettagli dell'evento
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 mb-4">
                        <input
                          type="checkbox"
                          id="invia_a_tutti"
                          checked={formData.invia_a_tutti}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            invia_a_tutti: e.target.checked,
                            partecipanti: e.target.checked ? [] : formData.partecipanti
                          })}
                          className="rounded"
                        />
                        <Label htmlFor="invia_a_tutti" className="cursor-pointer font-semibold text-blue-700">
                          📢 Invia notifica a TUTTI gli utenti dello studio ({utenti.length} persone)
                        </Label>
                      </div>

                      {!formData.invia_a_tutti && (
                        <div className="space-y-2">
                          <Label>Seleziona Partecipanti Specifici</Label>
                          <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-gray-50">
                            {utenti.length === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-4">
                                Nessun utente disponibile
                              </p>
                            ) : (
                              utenti.map((utente) => (
                                <div key={utente.id} className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`part-${utente.id}`}
                                    checked={formData.partecipanti.includes(utente.id)}
                                    onChange={() => togglePartecipante(utente.id)}
                                    className="rounded"
                                  />
                                  <Label 
                                    htmlFor={`part-${utente.id}`} 
                                    className="cursor-pointer flex-1 py-1"
                                  >
                                    {utente.nome} {utente.cognome}
                                    {utente.email && (
                                      <span className="text-xs text-gray-500 ml-2">
                                        ({utente.email})
                                      </span>
                                    )}
                                  </Label>
                                </div>
                              ))
                            )}
                          </div>
                          {formData.partecipanti.length > 0 && !formData.invia_a_tutti && (
                            <p className="text-sm text-gray-600 mt-2">
                              ✅ {formData.partecipanti.length} partecipante{formData.partecipanti.length > 1 ? 'i' : ''} selezionato{formData.partecipanti.length > 1 ? 'i' : ''}
                            </p>
                          )}
                        </div>
                      )}

                      {formData.invia_a_tutti && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                          <p className="text-sm text-green-800 font-medium">
                            ✅ Tutti gli utenti ({utenti.length}) riceveranno la notifica email
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button type="submit" className="flex-1">
                        {editingEvento ? "Aggiorna" : "Crea"} Evento
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setDialogOpen(false)}
                      >
                        Annulla
                      </Button>
                      {editingEvento && (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => {
                            handleDelete(editingEvento.id);
                            setDialogOpen(false);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => vistaCorrente === "mensile" ? cambiaMese(-1) : cambiaSettimana(-1)}
                    >
                      ←
                    </Button>
                    <CardTitle>
                      {dataSelezionata.toLocaleDateString("it-IT", { 
                        month: "long", 
                        year: "numeric" 
                      })}
                    </CardTitle>
                    <Button
                      variant="outline"
                      onClick={() => vistaCorrente === "mensile" ? cambiaMese(1) : cambiaSettimana(1)}
                    >
                      →
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDataSelezionata(new Date())}
                    >
                      Oggi
                    </Button>
                  </div>

                  <div className="flex items-center gap-4">
                    <Select value={filtroUtente} onValueChange={setFiltroUtente}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filtra per utente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Tutti gli utenti</SelectItem>
                        {utenti.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome} {u.cognome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex gap-2">
                      <Button
                        variant={vistaCorrente === "mensile" ? "default" : "outline"}
                        onClick={() => setVistaCorrente("mensile")}
                      >
                        Mensile
                      </Button>
                      <Button
                        variant={vistaCorrente === "settimanale" ? "default" : "outline"}
                        onClick={() => setVistaCorrente("settimanale")}
                      >
                        Settimanale
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {vistaCorrente === "mensile" ? renderCalendarioMensile() : renderCalendarioSettimanale()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Legenda</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: "#3B82F6" }}></div>
                    <span className="text-sm">Evento Generico</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: "#10B981" }}></div>
                    <span className="text-sm">In Sede</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: "#EF4444" }}></div>
                    <span className="text-sm">Fuori Sede</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-600" />
                    <span className="text-sm">Con Sala Assegnata</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-600" />
                    <span className="text-sm">Con Indirizzo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-600" />
                    <span className="text-sm">Con Partecipanti</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Calcola Percorso</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}