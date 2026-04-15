import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase/client";
import { authService } from "@/services/authService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Archive,
  Plus,
  AlertTriangle,
  CalendarCog,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

type ScadenzeAdempimentoState = {
  iva: string;
  ccgg: string;
  cu: string;
  fiscali: string;
  bilanci: string;
  modello770: string;
};

type ScadenzariFlagsState = {
  iva: boolean;
  ccgg: boolean;
  cu: boolean;
  fiscali: boolean;
  bilanci: boolean;
  modello770: boolean;
  lipe: boolean;
  esterometro: boolean;
  proforma: boolean;
  imu: boolean;
};

type ScadenzarioConfig = {
  key: keyof ScadenzariFlagsState;
  label: string;
  table: string;
  hasScadenzaAdempimento?: boolean;
};

const SCADENZARI_CONFIG: ScadenzarioConfig[] = [
  { key: "iva", label: "IVA", table: "tbscadiva", hasScadenzaAdempimento: true },
  { key: "ccgg", label: "CCGG", table: "tbscadccgg", hasScadenzaAdempimento: true },
  { key: "cu", label: "CU", table: "tbscadcu", hasScadenzaAdempimento: true },
  {
    key: "fiscali",
    label: "Fiscali",
    table: "tbscadfiscali",
    hasScadenzaAdempimento: true,
  },
  {
    key: "bilanci",
    label: "Bilanci",
    table: "tbscadbilanci",
    hasScadenzaAdempimento: true,
  },
  {
    key: "modello770",
    label: "Modello 770",
    table: "tbscad770",
    hasScadenzaAdempimento: true,
  },
  { key: "lipe", label: "LIPE", table: "tbscadlipe" },
  { key: "esterometro", label: "Esterometro", table: "tbscadestero" },
  { key: "proforma", label: "Proforma", table: "tbscadproforma" },
  { key: "imu", label: "IMU", table: "tbscadimu" },
];

function buildDefaultScadenzeAdempimento(
  anno: number
): ScadenzeAdempimentoState {
  return {
    iva: `${anno}-04-30`,
    ccgg: `${anno}-06-16`,
    cu: `${anno}-03-31`,
    fiscali: `${anno}-10-31`,
    bilanci: `${anno}-05-30`,
    modello770: `${anno}-10-31`,
  };
}

function subtractDays(dateString: string, days: number): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

export default function GenerazioneScadenzariPage() {
  const router = useRouter();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [annoArchiviazione, setAnnoArchiviazione] = useState(currentYear - 1);
  const [annoGenerazione, setAnnoGenerazione] = useState(currentYear);
  const [annoEliminazione, setAnnoEliminazione] = useState(currentYear - 1);

  const [showScadenzeModal, setShowScadenzeModal] = useState(false);

  const [scadenzeAdempimento, setScadenzeAdempimento] =
    useState<ScadenzeAdempimentoState>(
      buildDefaultScadenzeAdempimento(currentYear)
    );

  const [scadenzariFlags, setScadenzariFlags] =
    useState<ScadenzariFlagsState>({
      iva: true,
      ccgg: true,
      cu: true,
      fiscali: true,
      bilanci: true,
      modello770: true,
      lipe: true,
      esterometro: true,
      proforma: true,
      imu: true,
    });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    setScadenzeAdempimento(buildDefaultScadenzeAdempimento(annoGenerazione));
  }, [annoGenerazione]);

  const anni = useMemo(
    () => Array.from({ length: 10 }, (_, i) => currentYear - 5 + i),
    [currentYear]
  );

  const scadenzariConData = useMemo(
    () =>
      SCADENZARI_CONFIG.filter(
        (item) => item.hasScadenzaAdempimento && scadenzariFlags[item.key]
      ),
    [scadenzariFlags]
  );

  const hasScadenzariConData = scadenzariConData.length > 0;

  const checkAuth = async () => {
    try {
      const authUser = await authService.getCurrentUser();

      if (!authUser || !authUser.id) {
        router.push("/login");
        return;
      }

      await authService.getUserProfile(authUser.id);

      const { data: utente } = await supabase
        .from("tbutenti")
        .select("tipo_utente")
        .eq("email", authUser.email)
        .single();

      if (utente?.tipo_utente !== "Admin") {
        router.push("/dashboard");
        return;
      }

      setLoading(false);
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const getSelectedScadenzari = () =>
    SCADENZARI_CONFIG.filter((item) => scadenzariFlags[item.key]);

  const handleScadenzaChange = (
    key: keyof ScadenzeAdempimentoState,
    value: string
  ) => {
    setScadenzeAdempimento((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const validateScadenzeAdempimento = (): string[] => {
    const errors: string[] = [];

    if (scadenzariFlags.iva && !scadenzeAdempimento.iva) errors.push("IVA");
    if (scadenzariFlags.ccgg && !scadenzeAdempimento.ccgg) errors.push("CCGG");
    if (scadenzariFlags.cu && !scadenzeAdempimento.cu) errors.push("CU");
    if (scadenzariFlags.fiscali && !scadenzeAdempimento.fiscali) {
      errors.push("Fiscali");
    }
    if (scadenzariFlags.bilanci && !scadenzeAdempimento.bilanci) {
      errors.push("Bilanci");
    }
    if (scadenzariFlags.modello770 && !scadenzeAdempimento.modello770) {
      errors.push("Modello 770");
    }

    return errors;
  };

  const handleArchivia = async () => {
    const selezionati = getSelectedScadenzari();

    if (selezionati.length === 0) {
      toast({
        title: "Attenzione",
        description: "Seleziona almeno uno scadenzario da archiviare",
      });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      toast({
        title: "Errore",
        description: "Sessione non valida",
        variant: "destructive",
      });
      return;
    }

    if (
      !confirm(
        `Sei sicuro di voler archiviare logicamente gli scadenzari selezionati per l'anno ${annoArchiviazione}?\n\nI dati resteranno consultabili ma verranno marcati come archiviati.`
      )
    ) {
      return;
    }

    try {
      setProcessing(true);

      for (const item of selezionati) {
        const { error } = await supabase
          .from(item.table as any)
          .update({
            archiviato: true,
            data_archiviazione: new Date().toISOString(),
            archiviato_da: session.user.id,
          } as any)
          .eq("anno_riferimento", annoArchiviazione)
          .eq("archiviato", false);

        if (error) throw error;
      }

      toast({
        title: "Successo",
        description: `Archiviazione logica completata per l'anno ${annoArchiviazione}`,
      });
    } catch (error) {
      console.error("Errore archiviazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile archiviare le scadenze selezionate",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleEliminaArchivi = async (
    nomeScadenzario: string,
    nomeTabella: string
  ) => {
    if (
      !confirm(
        `Sei sicuro di voler ELIMINARE DEFINITIVAMENTE gli archivi ${nomeScadenzario} dell'anno ${annoEliminazione}?\n\nVerranno cancellati solo i record già archiviati di quell'anno. Questa operazione NON può essere annullata!`
      )
    ) {
      return;
    }

    try {
      setProcessing(true);

      const { error } = await supabase
        .from(nomeTabella as any)
        .delete()
        .eq("anno_riferimento", annoEliminazione)
        .eq("archiviato", true);

      if (error) throw error;

      toast({
        title: "Successo",
        description: `Archivi ${nomeScadenzario} dell'anno ${annoEliminazione} eliminati definitivamente`,
      });
    } catch (error) {
      console.error("Errore eliminazione archivi:", error);
      toast({
        title: "Errore",
        description: `Impossibile eliminare gli archivi ${nomeScadenzario}`,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const executeGenerazione = async () => {
    try {
      setProcessing(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Errore",
          description: "Sessione non valida",
          variant: "destructive",
        });
        return;
      }

      const { data: utenteData, error: utenteError } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("id", session.user.id)
        .single();

      if (utenteError || !utenteData?.studio_id) {
        toast({
          title: "Errore",
          description: "Impossibile recuperare lo studio_id",
          variant: "destructive",
        });
        return;
      }

      const currentStudioId = utenteData.studio_id;

      let generati = 0;
      let errori = 0;

      const ivaAlert1 = subtractDays(scadenzeAdempimento.iva, 15);
      const ivaAlert2 = subtractDays(scadenzeAdempimento.iva, 7);

      const ccggAlert1 = subtractDays(scadenzeAdempimento.ccgg, 15);
      const ccggAlert2 = subtractDays(scadenzeAdempimento.ccgg, 7);

      const cuAlert1 = subtractDays(scadenzeAdempimento.cu, 15);
      const cuAlert2 = subtractDays(scadenzeAdempimento.cu, 7);

      const fiscaliAlert1 = subtractDays(scadenzeAdempimento.fiscali, 15);
      const fiscaliAlert2 = subtractDays(scadenzeAdempimento.fiscali, 7);

      const bilanciAlert1 = subtractDays(scadenzeAdempimento.bilanci, 15);
      const bilanciAlert2 = subtractDays(scadenzeAdempimento.bilanci, 7);

      const modello770Alert1 = subtractDays(
        scadenzeAdempimento.modello770,
        15
      );
      const modello770Alert2 = subtractDays(
        scadenzeAdempimento.modello770,
        7
      );

      const getClientiByFlag = async (flagColumn: string) => {
        const { data, error } = await supabase
          .from("tbclienti")
          .select("*")
          .eq("attivo", true)
          .eq("studio_id", currentStudioId)
          .eq(flagColumn, true);

        if (error) throw error;
        return data || [];
      };

      if (scadenzariFlags.iva) {
        const clientiIva = await getClientiByFlag("flag_iva");

        for (const cliente of clientiIva) {
          try {
            const { data: existing } = await supabase
              .from("tbscadiva")
              .select("id")
              .eq("cliente_id", cliente.id)
              .eq("anno_riferimento", annoGenerazione)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabase.from("tbscadiva" as any).insert({
                cliente_id: cliente.id,
                anno_riferimento: annoGenerazione,
                archiviato: false,
                studio_id: currentStudioId,
                nominativo: cliente.ragione_sociale,
                utente_operatore_id: cliente.utente_operatore_id,
                conferma_riga: false,
                data_scadenza_adempimento: scadenzeAdempimento.iva,
                data_avviso_1: ivaAlert1,
                data_avviso_2: ivaAlert2,
                alert_1_inviato: false,
                alert_2_inviato: false,
                data_invio_alert_1: null,
                data_invio_alert_2: null,
              });

              if (!error) {
                generati++;
              } else {
                console.error("Errore inserimento IVA:", error);
                errori++;
              }
            }
          } catch (error) {
            console.error(
              `Errore elaborazione IVA ${cliente.ragione_sociale}:`,
              error
            );
            errori++;
          }
        }
      }

      if (scadenzariFlags.ccgg) {
        const clientiCcgg = await getClientiByFlag("flag_ccgg");

        for (const cliente of clientiCcgg) {
          try {
            const { data: existing } = await supabase
              .from("tbscadccgg")
              .select("id")
              .eq("cliente_id", cliente.id)
              .eq("anno_riferimento", annoGenerazione)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadccgg" as any)
                .insert({
                  cliente_id: cliente.id,
                  anno_riferimento: annoGenerazione,
                  archiviato: false,
                  studio_id: currentStudioId,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                  conferma_riga: false,
                  data_scadenza_adempimento: scadenzeAdempimento.ccgg,
                  data_avviso_1: ccggAlert1,
                  data_avviso_2: ccggAlert2,
                  alert_1_inviato: false,
                  alert_2_inviato: false,
                  data_invio_alert_1: null,
                  data_invio_alert_2: null,
                });

              if (!error) {
                generati++;
              } else {
                console.error("Errore inserimento CCGG:", error);
                errori++;
              }
            }
          } catch (error) {
            console.error(
              `Errore elaborazione CCGG ${cliente.ragione_sociale}:`,
              error
            );
            errori++;
          }
        }
      }

      if (scadenzariFlags.cu) {
        const clientiCu = await getClientiByFlag("flag_cu");

        for (const cliente of clientiCu) {
          try {
            const { data: existing } = await supabase
              .from("tbscadcu")
              .select("id")
              .eq("cliente_id", cliente.id)
              .eq("anno_riferimento", annoGenerazione)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabase.from("tbscadcu" as any).insert({
                cliente_id: cliente.id,
                anno_riferimento: annoGenerazione,
                archiviato: false,
                studio_id: currentStudioId,
                nominativo: cliente.ragione_sociale,
                utente_operatore_id: cliente.utente_operatore_id,
                conferma_riga: false,
                data_scadenza_adempimento: scadenzeAdempimento.cu,
                data_avviso_1: cuAlert1,
                data_avviso_2: cuAlert2,
                alert_1_inviato: false,
                alert_2_inviato: false,
                data_invio_alert_1: null,
                data_invio_alert_2: null,
              });

              if (!error) {
                generati++;
              } else {
                console.error("Errore inserimento CU:", error);
                errori++;
              }
            }
          } catch (error) {
            console.error(
              `Errore elaborazione CU ${cliente.ragione_sociale}:`,
              error
            );
            errori++;
          }
        }
      }

      if (scadenzariFlags.fiscali) {
        const clientiFiscali = await getClientiByFlag("flag_fiscali");

        for (const cliente of clientiFiscali) {
          try {
            const { data: existing } = await supabase
              .from("tbscadfiscali")
              .select("id")
              .eq("cliente_id", cliente.id)
              .eq("anno_riferimento", annoGenerazione)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadfiscali" as any)
                .insert({
                  cliente_id: cliente.id,
                  anno_riferimento: annoGenerazione,
                  archiviato: false,
                  studio_id: currentStudioId,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                  tipo_redditi: cliente.tipo_redditi,
                  conferma_riga: false,
                  data_scadenza_adempimento: scadenzeAdempimento.fiscali,
                  data_avviso_1: fiscaliAlert1,
                  data_avviso_2: fiscaliAlert2,
                  alert_1_inviato: false,
                  alert_2_inviato: false,
                  data_invio_alert_1: null,
                  data_invio_alert_2: null,
                });

              if (!error) {
                generati++;
              } else {
                console.error("Errore inserimento Fiscali:", error);
                errori++;
              }
            }
          } catch (error) {
            console.error(
              `Errore elaborazione Fiscali ${cliente.ragione_sociale}:`,
              error
            );
            errori++;
          }
        }
      }

      if (scadenzariFlags.bilanci) {
        const clientiBilanci = await getClientiByFlag("flag_bilancio");

        for (const cliente of clientiBilanci) {
          try {
            const { data: existing } = await supabase
              .from("tbscadbilanci")
              .select("id")
              .eq("cliente_id", cliente.id)
              .eq("anno_riferimento", annoGenerazione)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadbilanci" as any)
                .insert({
                  cliente_id: cliente.id,
                  anno_riferimento: annoGenerazione,
                  archiviato: false,
                  studio_id: currentStudioId,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                  conferma_riga: false,
                  data_scadenza_adempimento: scadenzeAdempimento.bilanci,
                  data_avviso_1: bilanciAlert1,
                  data_avviso_2: bilanciAlert2,
                  alert_1_inviato: false,
                  alert_2_inviato: false,
                  data_invio_alert_1: null,
                  data_invio_alert_2: null,
                });

              if (!error) {
                generati++;
              } else {
                console.error("Errore inserimento Bilanci:", error);
                errori++;
              }
            }
          } catch (error) {
            console.error(
              `Errore elaborazione Bilanci ${cliente.ragione_sociale}:`,
              error
            );
            errori++;
          }
        }
      }

      if (scadenzariFlags.modello770) {
        const clienti770 = await getClientiByFlag("flag_770");

        for (const cliente of clienti770) {
          try {
            const { data: existing } = await supabase
              .from("tbscad770")
              .select("id")
              .eq("cliente_id", cliente.id)
              .eq("anno_riferimento", annoGenerazione)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabase.from("tbscad770" as any).insert({
                cliente_id: cliente.id,
                anno_riferimento: annoGenerazione,
                archiviato: false,
                studio_id: currentStudioId,
                nominativo: cliente.ragione_sociale,
                utente_operatore_id: cliente.utente_operatore_id,
                utente_payroll_id: cliente.utente_payroll_id,
                professionista_payroll_id: cliente.professionista_payroll_id,
                conferma_riga: false,
                data_scadenza_adempimento: scadenzeAdempimento.modello770,
                data_avviso_1: modello770Alert1,
                data_avviso_2: modello770Alert2,
                alert_1_inviato: false,
                alert_2_inviato: false,
                data_invio_alert_1: null,
                data_invio_alert_2: null,
              });

              if (!error) {
                generati++;
              } else {
                console.error("Errore inserimento 770:", error);
                errori++;
              }
            }
          } catch (error) {
            console.error(
              `Errore elaborazione 770 ${cliente.ragione_sociale}:`,
              error
            );
            errori++;
          }
        }
      }

      if (scadenzariFlags.lipe) {
        const clientiLipe = await getClientiByFlag("flag_lipe");

        for (const cliente of clientiLipe) {
          try {
            const { data: existing } = await supabase
              .from("tbscadlipe")
              .select("id")
              .eq("cliente_id", cliente.id)
              .eq("anno_riferimento", annoGenerazione)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabase.from("tbscadlipe" as any).insert({
                cliente_id: cliente.id,
                anno_riferimento: annoGenerazione,
                archiviato: false,
                studio_id: currentStudioId,
                nominativo: cliente.ragione_sociale,
                utente_operatore_id: cliente.utente_operatore_id,
              });

              if (!error) {
                generati++;
              } else {
                console.error("Errore inserimento LIPE:", error);
                errori++;
              }
            }
          } catch (error) {
            console.error(
              `Errore elaborazione LIPE ${cliente.ragione_sociale}:`,
              error
            );
            errori++;
          }
        }
      }

      if (scadenzariFlags.esterometro) {
        const clientiEstero = await getClientiByFlag("flag_esterometro");

        for (const cliente of clientiEstero) {
          try {
            const { data: existing } = await supabase
              .from("tbscadestero")
              .select("id")
              .eq("cliente_id", cliente.id)
              .eq("anno_riferimento", annoGenerazione)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadestero" as any)
                .insert({
                  cliente_id: cliente.id,
                  anno_riferimento: annoGenerazione,
                  archiviato: false,
                  studio_id: currentStudioId,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                });

              if (!error) {
                generati++;
              } else {
                console.error("Errore inserimento Esterometro:", error);
                errori++;
              }
            }
          } catch (error) {
            console.error(
              `Errore elaborazione Esterometro ${cliente.ragione_sociale}:`,
              error
            );
            errori++;
          }
        }
      }

      if (scadenzariFlags.proforma) {
        const clientiProforma = await getClientiByFlag("flag_proforma");

        for (const cliente of clientiProforma) {
          try {
            const { data: existing } = await supabase
              .from("tbscadproforma")
              .select("id")
              .eq("cliente_id", cliente.id)
              .eq("anno_riferimento", annoGenerazione)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabase
                .from("tbscadproforma" as any)
                .insert({
                  cliente_id: cliente.id,
                  anno_riferimento: annoGenerazione,
                  archiviato: false,
                  studio_id: currentStudioId,
                  nominativo: cliente.ragione_sociale,
                  utente_operatore_id: cliente.utente_operatore_id,
                });

              if (!error) {
                generati++;
              } else {
                console.error("Errore inserimento Proforma:", error);
                errori++;
              }
            }
          } catch (error) {
            console.error(
              `Errore elaborazione Proforma ${cliente.ragione_sociale}:`,
              error
            );
            errori++;
          }
        }
      }

      if (scadenzariFlags.imu) {
        const clientiImu = await getClientiByFlag("flag_imu");

        for (const cliente of clientiImu) {
          try {
            const { data: existing } = await supabase
              .from("tbscadimu")
              .select("id")
              .eq("cliente_id", cliente.id)
              .eq("anno_riferimento", annoGenerazione)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabase.from("tbscadimu" as any).insert({
                id: crypto.randomUUID(),
                cliente_id: cliente.id,
                anno_riferimento: annoGenerazione,
                archiviato: false,
                studio_id: currentStudioId,
                nominativo: cliente.ragione_sociale,
                utente_operatore_id: cliente.utente_operatore_id,
                conferma_riga: false,
                alert_1_inviato: false,
                alert_2_inviato: false,
                data_invio_alert_1: null,
                data_invio_alert_2: null,
                data_archiviazione: null,
                archiviato_da: null,
              });

              if (!error) {
                generati++;
              } else {
                console.error("Errore inserimento IMU:", error);
                errori++;
              }
            }
          } catch (error) {
            console.error(
              `Errore elaborazione IMU ${cliente.ragione_sociale}:`,
              error
            );
            errori++;
          }
        }
      }

      toast({
        title: "Generazione completata",
        description: `Generati ${generati} nuovi scadenzari per l'anno ${annoGenerazione}${
          errori > 0 ? ` (${errori} errori)` : ""
        }`,
      });

      setShowScadenzeModal(false);
    } catch (error) {
      console.error("Errore generazione:", error);
      toast({
        title: "Errore",
        description: "Impossibile generare gli scadenzari",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleGenera = async () => {
    const scadenzariSelezionati = Object.entries(scadenzariFlags)
      .filter(([_, selected]) => selected)
      .map(([key]) => key);

    if (scadenzariSelezionati.length === 0) {
      toast({
        title: "Attenzione",
        description: "Seleziona almeno uno scadenzario da generare",
      });
      return;
    }

    if (hasScadenzariConData) {
      setShowScadenzeModal(true);
      return;
    }

    if (
      !confirm(
        `Sei sicuro di voler generare gli scadenzari selezionati per l'anno ${annoGenerazione}?\n\nVerranno creati record per tutti i clienti attivi in base ai flag attivi, senza duplicare quelli già esistenti per lo stesso anno.`
      )
    ) {
      return;
    }

    await executeGenerazione();
  };

  const handleConfermaDateEModale = async () => {
    const scadenzariConDataMancante = validateScadenzeAdempimento();

    if (scadenzariConDataMancante.length > 0) {
      toast({
        title: "Attenzione",
        description: `Inserisci la data scadenza adempimento per: ${scadenzariConDataMancante.join(
          ", "
        )}`,
        variant: "destructive",
      });
      return;
    }

    if (
      !confirm(
        `Sei sicuro di voler generare gli scadenzari selezionati per l'anno ${annoGenerazione}?\n\nVerranno creati record per tutti i clienti attivi in base ai flag attivi, senza duplicare quelli già esistenti per lo stesso anno.`
      )
    ) {
      return;
    }

    await executeGenerazione();
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
    <>
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Gestione Scadenzari
          </h1>
          <p className="text-gray-500 mt-1">
            Archiviazione logica per anno, generazione annuale ed eliminazione
            definitiva degli archivi
          </p>
        </div>

        <div className="space-y-6">
          <Card className="border-l-4 border-l-red-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <Archive className="h-5 w-5" />
                Archivia Scadenze
              </CardTitle>
              <CardDescription>
                Archiviazione fittizia per anno: i dati restano disponibili ma
                vengono marcati come archiviati
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">ATTENZIONE!</p>
                    <p>
                      L'archiviazione NON sposta i record in altre tabelle:
                      imposta solo lo stato archivio per l'anno selezionato,
                      lasciando lo storico consultabile in qualsiasi momento.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="anno_archiviazione">Anno da Archiviare</Label>
                <Select
                  value={annoArchiviazione.toString()}
                  onValueChange={(value) =>
                    setAnnoArchiviazione(parseInt(value))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anni.map((anno) => (
                      <SelectItem key={anno} value={anno.toString()}>
                        {anno}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Scadenzari da Archiviare</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {SCADENZARI_CONFIG.map((item) => (
                    <div
                      key={`arch_${item.key}`}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`arch_${item.key}`}
                        checked={scadenzariFlags[item.key]}
                        onCheckedChange={(checked) =>
                          setScadenzariFlags({
                            ...scadenzariFlags,
                            [item.key]: checked as boolean,
                          })
                        }
                      />
                      <label
                        htmlFor={`arch_${item.key}`}
                        className="text-sm cursor-pointer"
                      >
                        {item.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleArchivia}
                disabled={processing}
                variant="destructive"
                className="w-full"
              >
                {processing ? (
                  <>
                    <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Archiviazione in corso...
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4 mr-2" />
                    Archivia Selezionati {annoArchiviazione}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CalendarCog className="h-5 w-5" />
                Genera Nuovi Scadenzari
              </CardTitle>
              <CardDescription>
                Genera automaticamente gli scadenzari per l'anno selezionato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Come funziona:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Vengono generati scadenzari solo per i clienti attivi</li>
                    <li>
                      Vengono creati solo gli scadenzari relativi ai flag attivi
                      del cliente
                    </li>
                    <li>
                      Se uno scadenzario esiste già per lo stesso cliente e per
                      lo stesso anno, NON viene duplicato
                    </li>
                    <li>
                      Per IVA, CCGG, CU, Fiscali, Bilanci e 770 si apre una
                      modale per inserire la data scadenza adempimento
                    </li>
                    <li>
                      Alla generazione vengono salvati anche gli alert automatici
                      a 15 e 7 giorni prima
                    </li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="anno_generazione">Anno da Generare</Label>
                <Select
                  value={annoGenerazione.toString()}
                  onValueChange={(value) => setAnnoGenerazione(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anni.map((anno) => (
                      <SelectItem key={anno} value={anno.toString()}>
                        {anno}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Scadenzari da Generare</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {SCADENZARI_CONFIG.map((item) => (
                    <div
                      key={`flag_${item.key}`}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`flag_${item.key}`}
                        checked={scadenzariFlags[item.key]}
                        onCheckedChange={(checked) =>
                          setScadenzariFlags({
                            ...scadenzariFlags,
                            [item.key]: checked as boolean,
                          })
                        }
                      />
                      <label
                        htmlFor={`flag_${item.key}`}
                        className="text-sm cursor-pointer"
                      >
                        {item.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleGenera}
                disabled={processing}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {processing ? (
                  <>
                    <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Generazione in corso...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Genera Scadenzari Selezionati {annoGenerazione}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <Trash2 className="h-5 w-5" />
                Elimina Archivi Definitivamente
              </CardTitle>
              <CardDescription>
                Elimina solo i record già archiviati dell'anno selezionato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <p className="font-semibold mb-1">ATTENZIONE!</p>
                    <p>
                      L'eliminazione definitiva cancellerà solo i record già
                      archiviati dell'anno selezionato. I dati non archiviati non
                      verranno toccati.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="anno_eliminazione">
                  Anno Archivi da Eliminare
                </Label>
                <Select
                  value={annoEliminazione.toString()}
                  onValueChange={(value) =>
                    setAnnoEliminazione(parseInt(value))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anni.map((anno) => (
                      <SelectItem key={anno} value={anno.toString()}>
                        {anno}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {SCADENZARI_CONFIG.map((item) => (
                  <Button
                    key={`del_${item.key}`}
                    onClick={() => handleEliminaArchivi(item.label, item.table)}
                    disabled={processing}
                    variant="outline"
                    className="border-orange-300 hover:bg-orange-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Elimina {item.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showScadenzeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Inserisci date scadenza adempimento
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Le date verranno salvate negli scadenzari generati insieme agli
                  alert automatici a 15 e 7 giorni prima.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowScadenzeModal(false)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scadenzariFlags.iva && (
                  <div className="space-y-2">
                    <Label htmlFor="modal_scad_iva">IVA</Label>
                    <input
                      id="modal_scad_iva"
                      type="date"
                      value={scadenzeAdempimento.iva}
                      onChange={(e) =>
                        handleScadenzaChange("iva", e.target.value)
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {scadenzariFlags.ccgg && (
                  <div className="space-y-2">
                    <Label htmlFor="modal_scad_ccgg">CCGG</Label>
                    <input
                      id="modal_scad_ccgg"
                      type="date"
                      value={scadenzeAdempimento.ccgg}
                      onChange={(e) =>
                        handleScadenzaChange("ccgg", e.target.value)
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {scadenzariFlags.cu && (
                  <div className="space-y-2">
                    <Label htmlFor="modal_scad_cu">CU</Label>
                    <input
                      id="modal_scad_cu"
                      type="date"
                      value={scadenzeAdempimento.cu}
                      onChange={(e) =>
                        handleScadenzaChange("cu", e.target.value)
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {scadenzariFlags.fiscali && (
                  <div className="space-y-2">
                    <Label htmlFor="modal_scad_fiscali">Fiscali</Label>
                    <input
                      id="modal_scad_fiscali"
                      type="date"
                      value={scadenzeAdempimento.fiscali}
                      onChange={(e) =>
                        handleScadenzaChange("fiscali", e.target.value)
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {scadenzariFlags.bilanci && (
                  <div className="space-y-2">
                    <Label htmlFor="modal_scad_bilanci">Bilanci</Label>
                    <input
                      id="modal_scad_bilanci"
                      type="date"
                      value={scadenzeAdempimento.bilanci}
                      onChange={(e) =>
                        handleScadenzaChange("bilanci", e.target.value)
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {scadenzariFlags.modello770 && (
                  <div className="space-y-2">
                    <Label htmlFor="modal_scad_770">Modello 770</Label>
                    <input
                      id="modal_scad_770"
                      type="date"
                      value={scadenzeAdempimento.modello770}
                      onChange={(e) =>
                        handleScadenzaChange("modello770", e.target.value)
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowScadenzeModal(false)}
                disabled={processing}
              >
                Annulla
              </Button>
              <Button
                type="button"
                onClick={handleConfermaDateEModale}
                disabled={processing}
                className="bg-green-600 hover:bg-green-700"
              >
                {processing ? (
                  <>
                    <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Generazione in corso...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Conferma e genera
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
