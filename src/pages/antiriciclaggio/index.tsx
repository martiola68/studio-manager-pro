import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getStudioId } from "@/services/getStudioId";
import { FolderOpen, Trash2, X } from "lucide-react";

type Cliente = {
  id: string;
  cod_cliente?: string | null;
  ragione_sociale?: string | null;
  codice_fiscale?: string | null;
  utente_operatore_id?: string | null;
  utente_operatore?: {
    nome?: string | null;
    cognome?: string | null;
  } | null;
};

type AV4Info = {
  id?: string;
  av1_id?: string | null;
  Av4InviatoCL?: boolean | null;
  public_sent_at?: string | null;
  compilato_da_cliente?: boolean | null;
};

type ResponsabileAV = {
  id: string;
  cognome_nome?: string | null;
  societa_id?: string | null;
};

type SocietaOption = {
  id: string;
  Denominazione: string;
  codice_fiscale?: string | null;
  antiriciclaggio_enabled?: boolean | null;
};

type AV1Row = {
  id: string;
  studio_id?: string | null;
  cliente_id?: string | null;
  incaricato_adeguata_verifica_id?: string | null;
  DataVerifica?: string | null;
  ScadenzaVerifica?: string | null;
  AV1Conferma?: boolean | null;
  AV2Generato?: boolean | null;
  AV4Generato?: boolean | null;
  tbclienti?: Cliente | Cliente[] | null;
  av4_info?: AV4Info | AV4Info[] | null;
};

const AML_SESSION_KEY = "antiriciclaggio_unlocked_societa_id";
const AML_SELECTED_SOCIETA_KEY = "antiriciclaggio_selected_societa_id";
const AML_TIMEOUT_MS = 5 * 60 * 1000;
const AML_WARNING_MS = 60 * 1000;

export default function AntiriciclaggioPage() {
  const router = useRouter();

  const [rows, setRows] = useState<AV1Row[]>([]);
  const [responsabili, setResponsabili] = useState<ResponsabileAV[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const [societaOptions, setSocietaOptions] = useState<SocietaOption[]>([]);
  const [societaFilter, setSocietaFilter] = useState("");
  const [selectedSocieta, setSelectedSocieta] = useState<SocietaOption | null>(null);

  const [unlockedSocietaId, setUnlockedSocietaId] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showForgotPasswordInfo, setShowForgotPasswordInfo] = useState(false);

  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [timeoutCountdown, setTimeoutCountdown] = useState(
    Math.floor(AML_WARNING_MS / 1000)
  );

 useEffect(() => {
  if (typeof window === "undefined") return;

  const savedUnlocked = sessionStorage.getItem(AML_SESSION_KEY);
  const savedSelected = sessionStorage.getItem(AML_SELECTED_SOCIETA_KEY);

  if (savedSelected) {
    setSocietaFilter(savedSelected);
  }

  if (savedUnlocked) {
    setUnlockedSocietaId(savedUnlocked);
  }
}, []);

  const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";

    const normalized = dateString.includes("T")
      ? dateString.split("T")[0]
      : dateString;

    const [y, m, d] = normalized.split("-");
    if (!y || !m || !d) return dateString;

    return `${d}/${m}/${y}`;
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return "-";

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("it-IT");
  };

  const getScadenzaStatus = (dateString?: string | null) => {
    if (!dateString) return "none";

    const normalized = dateString.includes("T")
      ? dateString.split("T")[0]
      : dateString;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const scadenza = new Date(normalized);
    scadenza.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
      (scadenza.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

if (diffDays <= 0) return "expired";     // 🔴
if (diffDays <= 10) return "urgent";     // 🟠
if (diffDays <= 45) return "warning";    // 🟡
return "ok";
  };

  const getAV4Info = (row: AV1Row): AV4Info | null => {
    if (!row.av4_info) return null;
    return Array.isArray(row.av4_info) ? row.av4_info[0] : row.av4_info;
  };

  const getCliente = (row: AV1Row): Cliente | null => {
    if (!row.tbclienti) return null;
    return Array.isArray(row.tbclienti) ? row.tbclienti[0] : row.tbclienti;
  };

  const getResponsabileById = (id?: string | null) => {
    if (!id) return null;
    return responsabili.find((r) => r.id === id) || null;
  };

  const getRowClassName = (row: AV1Row) => {
    const scadenzaStatus = getScadenzaStatus(row.ScadenzaVerifica);

    if (scadenzaStatus === "expired") return "bg-red-100";
    if (scadenzaStatus === "warning") return "bg-orange-50";
    if (!row.AV1Conferma || !row.AV2Generato || !row.AV4Generato) {
      return "bg-red-50";
    }

    return "";
  };

  const getScadenzaCellClassName = (dateString?: string | null) => {
    const status = getScadenzaStatus(dateString);

if (status === "expired") return "font-bold text-red-700";
if (status === "urgent") return "font-bold text-orange-600";
if (status === "warning") return "font-semibold text-yellow-600";

    return "";
  };

  const getStatoInfo = (row: AV1Row) => {
    const scadenzaStatus = getScadenzaStatus(row.ScadenzaVerifica);

    if (scadenzaStatus === "expired") {
      return {
        dotClass: "bg-red-500",
        text: "Scaduta",
        className: "font-bold text-red-700",
      };
    }

    if (scadenzaStatus === "warning") {
      return {
        dotClass: "bg-orange-500",
        text: "In scadenza",
        className: "font-semibold text-orange-600",
      };
    }

    if (!row.AV1Conferma) {
      return {
        dotClass: "bg-orange-500",
        text: "AV1 da confermare",
        className: "font-semibold text-orange-700",
      };
    }

    if (!row.AV2Generato) {
      return {
        dotClass: "bg-red-500",
        text: "AV2 da generare",
        className: "font-semibold text-red-700",
      };
    }

     if (!(getAV4Info(row)?.Av4InviatoCL || getAV4Info(row)?.public_sent_at)) {
      return {
        dotClass: "bg-red-500",
        text: "AV4 da generare",
        className: "font-semibold text-red-700",
      };
    }

    return {
      dotClass: "bg-green-500",
      text: "Completa",
      className: "font-semibold text-green-700",
    };
  };

  const getIconBorderClass = (enabled: boolean) => {
  return enabled
    ? "border-2 border-lime-500 shadow-[0_0_10px_rgba(132,204,22,0.9)]"
    : "border-2 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]";
};

const getAV4IconBorderClass = (row: AV1Row) => {
  const av4Info = getAV4Info(row);

  if (av4Info?.compilato_da_cliente) {
    return "border-2 border-lime-500 shadow-[0_0_10px_rgba(132,204,22,0.9)]";
  }

  if (av4Info?.Av4InviatoCL || av4Info?.public_sent_at) {
    return "border-2 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.9)]";
  }

  return "border-2 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]";
};
  
  const loadSocietaOptions = async () => {
    try {
      const studioId = await getStudioId();
      if (!studioId) return;

      const supabase = getSupabaseClient() as any;

      const { data, error } = await supabase
        .from("tbRespAVSocieta")
        .select("id, Denominazione, codice_fiscale, antiriciclaggio_enabled")
        .eq("studio_id", studioId)
        .order("Denominazione", { ascending: true });

      if (error) throw new Error(error.message);

      setSocietaOptions(data || []);
    } catch (err: any) {
      console.error("Errore caricamento società:", err?.message || err);
    }
  };

  const loadResponsabili = async () => {
    try {
      const studioId = await getStudioId();
      if (!studioId) return;

      const supabase = getSupabaseClient() as any;

      const { data, error } = await supabase
        .from("tbRespAV")
        .select("id, cognome_nome, societa_id")
        .eq("studio_id", studioId);

      if (error) throw new Error(error.message);

      setResponsabili(data || []);
    } catch (err: any) {
      console.error("Errore caricamento responsabili:", err?.message || err);
      setResponsabili([]);
    }
  };

  const loadRowsBySocieta = async (societaId: string) => {
    try {
      setLoading(true);
      setRows([]);

      const responsabiliIds = responsabili
        .filter((r) => r.societa_id === societaId)
        .map((r) => r.id);

      if (responsabiliIds.length === 0) {
        setRows([]);
        return;
      }

      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      const { data, error } = await supabaseAny
        .from("tbAV1")
        .select(`
          id,
          studio_id,
          cliente_id,
          incaricato_adeguata_verifica_id,
          DataVerifica,
          ScadenzaVerifica,
          AV1Conferma,
          AV2Generato,
          AV4Generato,
          tbclienti (
            id,
          cod_cliente,
          ragione_sociale,
          utente_operatore_id,
          utente_operatore:tbutenti!tbclienti_utente_operatore_id_fkey (
          nome,
          cognome
            )
            ),
          av4_info:tbAV4 (
            id,
            av1_id,
            Av4InviatoCL,
            public_sent_at,
            compilato_da_cliente
          )
        `)
        .in("incaricato_adeguata_verifica_id", responsabiliIds)
        .order("DataVerifica", { ascending: false });

      if (error) {
        console.error("Errore caricamento tbAV1:", error);
        alert(`Errore caricamento tbAV1: ${error.message}`);
        setRows([]);
        return;
      }

      setRows((data as AV1Row[]) || []);
    } catch (err: any) {
      console.error("Errore loadRowsBySocieta:", err);
      alert(`Errore loadRowsBySocieta: ${err?.message || "errore sconosciuto"}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const clearAmlTimers = () => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }

    if (warningIntervalRef.current) {
      clearInterval(warningIntervalRef.current);
      warningIntervalRef.current = null;
    }

    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
  };

  const closeTimeoutModal = () => {
    setShowTimeoutModal(false);
    setTimeoutCountdown(Math.floor(AML_WARNING_MS / 1000));

    if (warningIntervalRef.current) {
      clearInterval(warningIntervalRef.current);
      warningIntervalRef.current = null;
    }

    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
  };

 const clearAccessState = () => {
    setUnlockedSocietaId(null);
    setRows([]);
    setPassword("");
    setPasswordError("");
    setShowPasswordModal(false);
    setShowForgotPasswordInfo(false);
    setShowTimeoutModal(false);
    setWorkingId(null);

    if (typeof window !== "undefined") {
      sessionStorage.removeItem(AML_SESSION_KEY);
    }
  };

  const handleCloseAccess = () => {
    clearAmlTimers();
closeTimeoutModal();
clearAccessState();

// 🔥 AGGIUNGI QUESTO
setSocietaFilter("");
setSelectedSocieta(null);

setRows([]);
setWorkingId(null);

if (typeof window !== "undefined") {
  sessionStorage.removeItem(AML_SESSION_KEY);
  sessionStorage.removeItem(AML_SELECTED_SOCIETA_KEY);
}
  };

  const startWarningPhase = () => {
    closeTimeoutModal();

    setShowTimeoutModal(true);
    setTimeoutCountdown(Math.floor(AML_WARNING_MS / 1000));

    warningIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remainingMs = Math.max(0, AML_TIMEOUT_MS - elapsed);
      const remainingSec = Math.ceil(remainingMs / 1000);

      setTimeoutCountdown(remainingSec);

      if (remainingSec <= 0 && warningIntervalRef.current) {
        clearInterval(warningIntervalRef.current);
        warningIntervalRef.current = null;
      }
    }, 1000);

    autoCloseTimeoutRef.current = setTimeout(() => {
      closeTimeoutModal();
      handleCloseAccess();
    }, AML_WARNING_MS);
  };

  const resetInactivityTimer = () => {
    if (!canAccessAntiriciclaggio) return;

    lastActivityRef.current = Date.now();

    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    inactivityTimeoutRef.current = setTimeout(() => {
      startWarningPhase();
    }, AML_TIMEOUT_MS - AML_WARNING_MS);
  };

  const handleContinueSession = () => {
    lastActivityRef.current = Date.now();
    closeTimeoutModal();
    resetInactivityTimer();
  };

  const unlockSocietaDirectly = async (societa: SocietaOption) => {
    setUnlockedSocietaId(societa.id);

    if (typeof window !== "undefined") {
      sessionStorage.setItem(AML_SESSION_KEY, societa.id);
      sessionStorage.setItem(AML_SELECTED_SOCIETA_KEY, societa.id);
    }

    await loadRowsBySocieta(societa.id);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadSocietaOptions();
      await loadResponsabili();
      setLoading(false);
    };

    void init();
  }, []);

   useEffect(() => {
    if (!societaFilter || societaOptions.length === 0) {
      setSelectedSocieta(null);
      return;
    }

    const societa = societaOptions.find((s) => s.id === societaFilter) || null;
    setSelectedSocieta(societa);
  }, [societaFilter, societaOptions]);

  useEffect(() => {
    const tryRestoreAccess = async () => {
      if (!societaFilter || !selectedSocieta) {
        setRows([]);
        return;
      }

      const isProtected = !!selectedSocieta.antiriciclaggio_enabled;

      if (!isProtected) {
        await unlockSocietaDirectly(selectedSocieta);
        return;
      }

      if (unlockedSocietaId === societaFilter) {
        await loadRowsBySocieta(societaFilter);
        return;
      }

      setRows([]);
    };

    void tryRestoreAccess();
  }, [societaFilter, selectedSocieta, unlockedSocietaId, responsabili]);

  const isProtectedSocieta = !!selectedSocieta?.antiriciclaggio_enabled;
  const canAccessAntiriciclaggio =
    !!societaFilter &&
    !!selectedSocieta &&
    (!isProtectedSocieta || unlockedSocietaId === societaFilter);

  const isSocietaSelectionLocked =
    !!societaFilter &&
    !!selectedSocieta &&
    !!isProtectedSocieta &&
    unlockedSocietaId === societaFilter;

  useEffect(() => {
    if (typeof window === "undefined" || !canAccessAntiriciclaggio) {
      clearAmlTimers();
      closeTimeoutModal();
      return;
    }

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    const onActivity = () => {
      if (showTimeoutModal) return;
      resetInactivityTimer();
    };

    events.forEach((eventName) => {
      window.addEventListener(eventName, onActivity);
    });

    resetInactivityTimer();

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });
      clearAmlTimers();
    };
  }, [canAccessAntiriciclaggio, showTimeoutModal]);

   useEffect(() => {
    if (typeof window === "undefined") return;

    const handleRouteChangeStart = (url: string) => {
      if (!url.startsWith("/antiriciclaggio")) {
        clearAmlTimers();
        closeTimeoutModal();
        clearAccessState();
        setSocietaFilter("");
        setSelectedSocieta(null);
        sessionStorage.removeItem(AML_SELECTED_SOCIETA_KEY);
      }
    };

    router.events.on("routeChangeStart", handleRouteChangeStart);

    return () => {
      router.events.off("routeChangeStart", handleRouteChangeStart);
    };
  }, [router.events]);

  const filteredRows = useMemo(() => {
    if (!societaFilter || !canAccessAntiriciclaggio) return [];

    return rows.filter((row) => {
      const responsabile = getResponsabileById(row.incaricato_adeguata_verifica_id);
      return responsabile?.societa_id === societaFilter;
    });
  }, [rows, responsabili, societaFilter, canAccessAntiriciclaggio]);

  const handleSocietaChange = (societaId: string) => {
    if (isSocietaSelectionLocked) return;

    setSocietaFilter(societaId);

    if (typeof window !== "undefined") {
      if (societaId) {
        sessionStorage.setItem(AML_SELECTED_SOCIETA_KEY, societaId);
      } else {
        sessionStorage.removeItem(AML_SELECTED_SOCIETA_KEY);
      }

      sessionStorage.removeItem(AML_SESSION_KEY);
    }

    clearAmlTimers();
    closeTimeoutModal();
    setRows([]);
    setPassword("");
    setPasswordError("");
    setShowForgotPasswordInfo(false);
    setWorkingId(null);
    setUnlockedSocietaId(null);

    if (!societaId) {
      setSelectedSocieta(null);
      setShowPasswordModal(false);
      return;
    }

    const societa = societaOptions.find((s) => s.id === societaId) || null;
    setSelectedSocieta(societa);

    if (societa?.antiriciclaggio_enabled) {
      setShowPasswordModal(true);
      return;
    }

    setShowPasswordModal(false);
  };

  const handleUnlockSocieta = async () => {
    try {
      if (!selectedSocieta?.id) {
        setPasswordError("Seleziona una società.");
        return;
      }

      if (!password.trim()) {
        setPasswordError("Inserisci la password.");
        return;
      }

      setPasswordLoading(true);
      setPasswordError("");

      const res = await fetch("/api/antiriciclaggio/verify-societa-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          societaId: selectedSocieta.id,
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setPasswordError(data?.error || "Password non corretta.");
        return;
      }

      setUnlockedSocietaId(selectedSocieta.id);

      if (typeof window !== "undefined") {
        sessionStorage.setItem(AML_SESSION_KEY, selectedSocieta.id);
        sessionStorage.setItem(AML_SELECTED_SOCIETA_KEY, selectedSocieta.id);
      }

      setShowPasswordModal(false);
      setShowForgotPasswordInfo(false);
      setPassword("");
      lastActivityRef.current = Date.now();
      await loadRowsBySocieta(selectedSocieta.id);
    } catch (err: any) {
      console.error("Errore verifica password società:", err);
      setPasswordError(err?.message || "Errore durante la verifica password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleNuovoAV1 = () => {
    if (!canAccessAntiriciclaggio) return;
    router.push("/antiriciclaggio/modello-av1");
  };

  const handleApriAV1 = (id: string) => {
    if (!canAccessAntiriciclaggio) return;
    router.push(`/antiriciclaggio/modello-av1?id=${id}`);
  };

  const handleApriAV2 = async (row: AV1Row) => {
    if (!canAccessAntiriciclaggio) return;

    try {
      setWorkingId(row.id);

      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      const { data: av2, error: av2Error } = await supabaseAny
        .from("tbAV2")
        .select("id")
        .eq("av1_id", row.id)
        .maybeSingle();

      if (av2Error) {
        console.error("Errore ricerca AV2:", av2Error);
        alert("Errore durante la ricerca del modello AV2.");
        return;
      }

      if (!row.AV2Generato) {
        const { error: updateError } = await supabaseAny
          .from("tbAV1")
          .update({ AV2Generato: true })
          .eq("id", row.id);

        if (updateError) {
          console.error("Errore aggiornamento AV2Generato:", updateError);
          alert("Errore durante l'aggiornamento del flag AV2.");
          return;
        }
      }

      await loadRowsBySocieta(societaFilter);

      if (av2?.id) {
        router.push(
          `/antiriciclaggio/modello-av2?id=${av2.id}&av1_id=${row.id}&cliente_id=${row.cliente_id || ""}&studio_id=${row.studio_id || ""}`
        );
      } else {
        router.push(
          `/antiriciclaggio/modello-av2?av1_id=${row.id}&cliente_id=${row.cliente_id || ""}&studio_id=${row.studio_id || ""}`
        );
      }
    } catch (err: any) {
      console.error("Errore apertura AV2:", err);
      alert(
        `Errore durante l'apertura del modello AV2: ${
          err?.message || "errore sconosciuto"
        }`
      );
    } finally {
      setWorkingId(null);
    }
  };

  const handleApriAV4 = async (row: AV1Row) => {
    if (!canAccessAntiriciclaggio) return;

    try {
      setWorkingId(row.id);

      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      const { data: av4, error: av4Error } = await supabaseAny
        .from("tbAV4")
        .select("id")
        .eq("av1_id", row.id)
        .maybeSingle();

      if (av4Error) {
        console.error("Errore ricerca AV4:", av4Error);
        alert("Errore durante la ricerca del modello AV4.");
        return;
      }

      if (!row.AV4Generato) {
        const { error: updateError } = await supabaseAny
          .from("tbAV1")
          .update({ AV4Generato: true })
          .eq("id", row.id);

        if (updateError) {
          console.error("Errore aggiornamento AV4Generato:", updateError);
          alert("Errore durante l'aggiornamento del flag AV4.");
          return;
        }
      }

      await loadRowsBySocieta(societaFilter);

      if (av4?.id) {
        router.push(
          `/antiriciclaggio/modello-av4?id=${av4.id}&av1_id=${row.id}&cliente_id=${row.cliente_id || ""}&studio_id=${row.studio_id || ""}`
        );
      } else {
        router.push(
          `/antiriciclaggio/modello-av4?av1_id=${row.id}&cliente_id=${row.cliente_id || ""}&studio_id=${row.studio_id || ""}`
        );
      }
    } catch (err: any) {
      console.error("Errore apertura AV4:", err);
      alert(
        `Errore durante l'apertura del modello AV4: ${
          err?.message || "errore sconosciuto"
        }`
      );
    } finally {
      setWorkingId(null);
    }
  };

 const handleApriDocumenti = (row: AV1Row) => {
  if (!canAccessAntiriciclaggio) return;

  router.push(
    `/antiriciclaggio/fascicolo-documenti?av1_id=${row.id}&cliente_id=${row.cliente_id || ""}`
  );
};
  
  const handleEliminaCompleto = async (av1Id: string) => {
    if (!canAccessAntiriciclaggio) return;

    const conferma = window.confirm(
      "Vuoi eliminare AV1 e gli eventuali AV2/AV4 collegati?"
    );
    if (!conferma) return;

    try {
      const supabase = getSupabaseClient();
      const supabaseAny = supabase as any;

      const { data: av4Rows, error: av4Error } = await supabaseAny
        .from("tbAV4")
        .select("id")
        .eq("av1_id", av1Id);

      if (av4Error) throw av4Error;

      const av4Ids = (av4Rows || []).map((r: any) => r.id);

      if (av4Ids.length > 0) {
        const { error: titolariError } = await supabaseAny
          .from("tbAV4_titolari")
          .delete()
          .in("av4_id", av4Ids);

        if (titolariError) throw titolariError;

        const { error: deleteAV4Error } = await supabaseAny
          .from("tbAV4")
          .delete()
          .in("id", av4Ids);

        if (deleteAV4Error) throw deleteAV4Error;
      }

      const { error: deleteAV2Error } = await supabaseAny
        .from("tbAV2")
        .delete()
        .eq("av1_id", av1Id);

      if (deleteAV2Error) throw deleteAV2Error;

      const { error: deleteAV1Error } = await supabaseAny
        .from("tbAV1")
        .delete()
        .eq("id", av1Id);

      if (deleteAV1Error) throw deleteAV1Error;

      await loadRowsBySocieta(societaFilter);
    } catch (err: any) {
      console.error("Errore eliminazione completa:", err);
      alert(
        `Errore durante l'eliminazione del record: ${
          err?.message || "errore sconosciuto"
        }`
      );
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className="text-2xl font-bold">Elenco Antiriciclaggio</h1>

        <div className="flex items-center gap-2">
          {canAccessAntiriciclaggio && isProtectedSocieta && (
            <button
              type="button"
              onClick={handleCloseAccess}
              className="rounded border border-red-300 bg-white px-4 py-2 text-red-700 hover:bg-red-50"
            >
              Chiudi accesso
            </button>
          )}

          <button
            type="button"
            onClick={handleNuovoAV1}
            disabled={!canAccessAntiriciclaggio}
            className={`rounded px-4 py-2 text-white ${
              canAccessAntiriciclaggio
                ? "bg-blue-600 hover:bg-blue-700"
                : "cursor-not-allowed bg-gray-400"
            }`}
          >
            Nuova pratica
          </button>
        </div>
      </div>

      <div className="mb-4 max-w-md">
        <label className="mb-1 block text-sm font-medium">
          Seleziona soggetto responsabile
        </label>

        <select
          className={`w-full rounded-md border px-3 py-2 ${
            isSocietaSelectionLocked
              ? "cursor-not-allowed bg-gray-100 text-gray-500"
              : ""
          }`}
          value={societaFilter}
          onChange={(e) => handleSocietaChange(e.target.value)}
          disabled={isSocietaSelectionLocked}
        >
          <option value="">Seleziona soggetto responsabile</option>
          {societaOptions.map((soc) => (
            <option key={soc.id} value={soc.id}>
              {soc.Denominazione}
            </option>
          ))}
        </select>

        {isSocietaSelectionLocked && selectedSocieta && (
          <div className="mt-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Accesso attivo su{" "}
            <span className="font-semibold">{selectedSocieta.Denominazione}</span>.
            Per cambiare soggetto responsabile usa prima{" "}
            <span className="font-semibold">Chiudi accesso</span>.
          </div>
        )}
      </div>

      {selectedSocieta && isProtectedSocieta && !canAccessAntiriciclaggio && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Per visualizzare le pratiche antiriciclaggio della società selezionata
          è necessaria l’autenticazione con password.
        </div>
      )}

      {loading ? (
        <div>Caricamento...</div>
      ) : !societaFilter ? (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Stato</th>
                <th className="p-3 text-left">Cliente</th>
                <th className="p-3 text-left">Utente fiscale</th>
                <th className="p-3 text-left">Data verifica</th>
                <th className="p-3 text-left">Scadenza verifica</th>
                <th className="p-3 text-center">AV1 conferma</th>
                <th className="p-3 text-center">AV2 generato</th>
                <th className="w-[90px] p-2 text-center leading-tight">
                  AV4
                  <br />
                  inviato
                </th>
                <th className="p-3 text-center">Data invio AV4</th>
                <th className="p-3 text-center">AV4 confermato</th>
                <th className="p-3 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={11} className="p-4 text-center">
                  Seleziona un soggetto responsabile per visualizzare le pratiche
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : !canAccessAntiriciclaggio ? (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Stato</th>
                <th className="p-3 text-left">Cliente</th>
                <th className="p-3 text-left">Utente di riferimento</th>
                <th className="p-3 text-left">Data verifica</th>
                <th className="p-3 text-left">Scadenza verifica</th>
                <th className="p-3 text-center">AV1 conferma</th>
                <th className="p-3 text-center">AV2 generato</th>
                <th className="w-[90px] p-2 text-center leading-tight">
                  AV4
                  <br />
                  inviato
                </th>
                <th className="p-3 text-center">Data invio AV4</th>
                <th className="p-3 text-center">AV4 confermato</th>
                <th className="p-3 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={11} className="p-4 text-center">
                  Accesso riservato: inserisci la password della società per
                  consultare le pratiche.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Stato</th>
                <th className="p-3 text-left">Cliente</th>
                <th className="p-3 text-left">Utente di riferimento</th>
                <th className="p-3 text-left">Data verifica</th>
                <th className="p-3 text-left">Scadenza verifica</th>
                <th className="p-3 text-center">AV1 conferma</th>
                <th className="p-3 text-center">AV2 generato</th>
                <th className="w-[90px] p-2 text-center leading-tight">
                  AV4
                  <br />
                  inviato
                </th>
                <th className="p-3 text-center">Data invio AV4</th>
                <th className="p-3 text-center">AV4 confermato</th>
                <th className="p-3 text-center">Azioni</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-4 text-center">
                    Nessuna pratica trovata per il soggetto responsabile
                    selezionato
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const cliente = getCliente(row);
                  const av4Info = getAV4Info(row);
                  const nomeCliente =
                    cliente?.ragione_sociale || cliente?.cod_cliente || "-";
                  const statoInfo = getStatoInfo(row);

                  return (
                    <tr
                      key={row.id}
                      className={`border-t ${getRowClassName(row)}`}
                    >
                      <td className={`p-3 ${statoInfo.className}`}>
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-block h-5 w-5 rounded-full ${statoInfo.dotClass} shadow`}
                          />
                          <span>{statoInfo.text}</span>
                        </div>
                      </td>

                      <td className="p-3">{nomeCliente}</td>
                     <td className="p-3">
                      {cliente?.utente_operatore
                        ? `${cliente.utente_operatore.nome || ""} ${cliente.utente_operatore.cognome || ""}`.trim() || "-"
                          : "-"}
                        </td>
                      <td className="p-3">{formatDate(row.DataVerifica)}</td>
                      <td
                        className={`p-3 ${getScadenzaCellClassName(
                          row.ScadenzaVerifica
                        )}`}
                      >
                        {formatDate(row.ScadenzaVerifica)}
                      </td>

                      <td
                        className={`p-2 text-center text-xs font-semibold ${
                          row.AV1Conferma ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {row.AV1Conferma ? "Sì" : "No"}
                      </td>

                      <td
                        className={`p-3 text-center font-semibold ${
                          row.AV2Generato ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {row.AV2Generato ? "Sì" : "No"}
                      </td>

                         <td
                        className={`p-3 text-center font-semibold ${
                          av4Info?.Av4InviatoCL || av4Info?.public_sent_at
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {av4Info?.Av4InviatoCL || av4Info?.public_sent_at ? "Sì" : "No"}
                      </td>

                      <td className="p-3 text-center">
                        {formatDateTime(av4Info?.public_sent_at)}
                      </td>

                      <td
                        className={`p-3 text-center font-semibold ${
                          av4Info?.compilato_da_cliente
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {av4Info?.compilato_da_cliente ? "Sì" : "No"}
                      </td>

                      <td className="p-3">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleApriAV1(row.id)}
                            className={`rounded-[28px] bg-white p-1 transition hover:scale-105 ${getIconBorderClass(
                              !!row.AV1Conferma
                            )}`}
                            title="Apri AV1"
                          >
                            <span className="text-xs font-semibold text-blue-600">
                              AV1
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApriAV2(row)}
                            disabled={workingId === row.id}
                            className={`rounded-[28px] bg-white p-1 transition hover:scale-105 disabled:opacity-60 ${getIconBorderClass(
                              !!row.AV2Generato
                            )}`}
                            title="Apri AV2"
                          >
                            <span className="text-xs font-semibold text-blue-600">
                              AV2
                            </span>
                          </button>

 <button
  type="button"
  onClick={() => handleApriAV4(row)}
  disabled={workingId === row.id}
  className={`rounded-[28px] bg-white p-1 transition hover:scale-105 disabled:opacity-60 ${getAV4IconBorderClass(
    row
  )}`}
  title="Apri AV4"
>
  <span className="text-xs font-semibold text-blue-600">
    AV4
  </span>
</button>

<button
  type="button"
  onClick={() => handleApriDocumenti(row)}
  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-500 bg-white shadow-[0_0_8px_rgba(59,130,246,0.35)] transition hover:scale-105"
  title="Apri fascicolo documenti"
>
  <FolderOpen
    className="h-4 w-4 text-blue-600"
    strokeWidth={2.2}
  />
</button>

<button
  type="button"
  onClick={() => handleEliminaCompleto(row.id)}
  className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-white transition hover:scale-105"
  title="Elimina record completo"
>
  <Trash2
    className="h-4 w-4 text-red-500"
    strokeWidth={2.2}
  />
</button>
                          
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {showPasswordModal && selectedSocieta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Accesso riservato antiriciclaggio
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Inserisci la password per accedere alla società{" "}
                  <span className="font-medium">
                    {selectedSocieta.Denominazione}
                  </span>
                  .
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setSocietaFilter("");
                  setSelectedSocieta(null);
                  clearAccessState();
                }}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="password"
                name="aml-access-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !passwordLoading) {
                    void handleUnlockSocieta();
                  }
                }}
                placeholder="Password"
                className="w-full rounded-md border px-3 py-2 outline-none focus:border-blue-500"
                autoFocus
              />

              {passwordError ? (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {passwordError}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordInfo((prev) => !prev)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Password dimenticata?
                </button>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setSocietaFilter("");
                      setSelectedSocieta(null);
                      clearAccessState();
                    }}
                    className="rounded border px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Annulla
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleUnlockSocieta()}
                    disabled={passwordLoading}
                    className={`rounded px-4 py-2 text-white ${
                      passwordLoading
                        ? "cursor-not-allowed bg-blue-400"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {passwordLoading ? "Verifica..." : "Accedi"}
                  </button>
                </div>
              </div>

              {showForgotPasswordInfo && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  Se hai dimenticato la password, contatta l’amministratore di
                  sistema o il responsabile abilitato per richiedere il reset
                  dell’accesso antiriciclaggio della società selezionata.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTimeoutModal && canAccessAntiriciclaggio && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-red-700">
                Sessione in scadenza
              </h2>
              <p className="mt-2 text-sm text-gray-700">
                Nessuna attività rilevata. La sessione antiriciclaggio verrà
                chiusa automaticamente tra{" "}
                <span className="font-bold text-red-600">
                  {timeoutCountdown}
                </span>{" "}
                secondi.
              </p>
            </div>

            <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-red-500 transition-all duration-1000"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      (timeoutCountdown / (AML_WARNING_MS / 1000)) * 100
                    )
                  )}%`,
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseAccess}
                className="rounded border border-red-300 bg-white px-4 py-2 text-red-700 hover:bg-red-50"
              >
                Chiudi ora
              </button>

              <button
                type="button"
                onClick={handleContinueSession}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Continua sessione
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
