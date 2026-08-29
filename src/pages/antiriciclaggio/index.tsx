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
  av4_caricato_manualmente?: boolean | null;
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
  AV2Confermato?: boolean | null;
  AV4Generato?: boolean | null;
  tbclienti?: Cliente | Cliente[] | null;
  av4_info?: AV4Info | AV4Info[] | null;
  pratica_id?: string | null;
  societa_id?: string | null;
  stato_pratica?: string | null;
  is_pratica_only?: boolean;
  fascicolo_completo?: boolean | null;
  fascicolo_mancanti?: string[];
};

type PraticaAMLRow = {
  id: string;
  studio_id?: string | null;
  cliente_id?: string | null;
  societa_id?: string | null;
  data_apertura?: string | null;
  stato?: string | null;
  stato_ciclo?: string | null;
  av1_id?: string | null;
  av2_id?: string | null;
  av2_corrente_id?: string | null;
  av4_id?: string | null;
  av4_corrente_id?: string | null;
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
  const [ricercaCliente, setRicercaCliente] = useState("");

  const [unlockedSocietaId, setUnlockedSocietaId] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showForgotPasswordInfo, setShowForgotPasswordInfo] = useState(false);

  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [timeoutCountdown, setTimeoutCountdown] = useState(Math.floor(AML_WARNING_MS / 1000));
  const [amlAttivo, setAmlAttivo] = useState<boolean | null>(null);

  const REVISIONI_BYPASS_ID = "f9d3ca10-6134-4061-a2b4-0be74e8c7654";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedUnlocked = sessionStorage.getItem(AML_SESSION_KEY);
    const savedSelected = sessionStorage.getItem(AML_SELECTED_SOCIETA_KEY);
    if (savedSelected) setSocietaFilter(savedSelected);
    if (savedUnlocked) setUnlockedSocietaId(savedUnlocked);
  }, []);

  const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const hiddenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";
    const normalized = dateString.includes("T") ? dateString.split("T")[0] : dateString;
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
    const normalized = dateString.includes("T") ? dateString.split("T")[0] : dateString;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scadenza = new Date(normalized);
    scadenza.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((scadenza.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "expired";
    if (diffDays <= 10) return "urgent";
    if (diffDays <= 45) return "warning";
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
    if (row.is_pratica_only) return "bg-blue-50";
    const scadenzaStatus = getScadenzaStatus(row.ScadenzaVerifica);
    if (scadenzaStatus === "expired") return "bg-red-100";
    if (scadenzaStatus === "warning") return "bg-orange-50";
    if (!row.AV1Conferma || !row.AV2Generato || !row.AV4Generato) return "bg-red-50";
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
    if (row.is_pratica_only) return { dotClass: "bg-blue-500", text: "Pratica aperta", className: "font-semibold text-blue-700" };
    const scadenzaStatus = getScadenzaStatus(row.ScadenzaVerifica);
    if (scadenzaStatus === "expired") return { dotClass: "bg-red-500", text: "Scaduta", className: "font-bold text-red-700" };
    if (scadenzaStatus === "warning") return { dotClass: "bg-orange-500", text: "In scadenza", className: "font-semibold text-orange-600" };
    if (!row.AV1Conferma) return { dotClass: "bg-orange-500", text: "AV1 da confermare", className: "font-semibold text-orange-700" };
    if (!row.AV2Confermato) return { dotClass: "bg-red-500", text: "AV2 da confermare", className: "font-semibold text-red-700" };
    const av4Info = getAV4Info(row);
    const av4Ok = av4Info?.Av4InviatoCL || av4Info?.public_sent_at || av4Info?.compilato_da_cliente || av4Info?.av4_caricato_manualmente || row.stato_pratica === "av4_inviato" || row.stato_pratica === "av4_ricevuto";
    if (!av4Ok) return { dotClass: "bg-red-500", text: "AV4 da generare", className: "font-semibold text-red-700" };
    if (row.fascicolo_completo === false) return { dotClass: "bg-yellow-500", text: "Fascicolo incompleto", className: "font-semibold text-yellow-700" };
    return { dotClass: "bg-green-500", text: "Completa", className: "font-semibold text-green-700" };
  };

  const getIconBorderClass = (enabled: boolean) => enabled
    ? "border-2 border-lime-500 shadow-[0_0_10px_rgba(132,204,22,0.9)]"
    : "border-2 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]";

  const getAV4IconBorderClass = (row: AV1Row) => {
    const av4Info = getAV4Info(row);
    const av4Ricevuto = av4Info?.compilato_da_cliente || av4Info?.av4_caricato_manualmente || row.stato_pratica === "av4_ricevuto";
    const av4Inviato = av4Info?.Av4InviatoCL || av4Info?.public_sent_at || av4Info?.compilato_da_cliente || av4Info?.av4_caricato_manualmente || row.stato_pratica === "av4_inviato" || row.stato_pratica === "av4_ricevuto";
    if (av4Ricevuto) return "border-2 border-lime-500 shadow-[0_0_10px_rgba(132,204,22,0.9)]";
    if (av4Inviato) return "border-2 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.9)]";
    return "border-2 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]";
  };

  const loadSocietaOptions = async () => {
    try {
      const studioId = await getStudioId();
      if (!studioId) return;
      const supabase = getSupabaseClient() as any;
      const { data, error } = await supabase.from("tbRespAVSocieta").select("id, Denominazione, codice_fiscale, antiriciclaggio_enabled").eq("studio_id", studioId).order("Denominazione", { ascending: true });
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
      const { data, error } = await supabase.from("tbRespAV").select("id, cognome_nome, societa_id").eq("studio_id", studioId);
      if (error) throw new Error(error.message);
      setResponsabili(data || []);
    } catch (err: any) {
      console.error("Errore caricamento responsabili:", err?.message || err);
      setResponsabili([]);
    }
  };

  const loadLicenzaAML = async () => {
    try {
      const studioId = await getStudioId();
      if (!studioId) return;
      if (String(studioId) === REVISIONI_BYPASS_ID) {
        setAmlAttivo(true);
        return;
      }
      const supabase = getSupabaseClient() as any;
      const { data, error } = await supabase.from("tbsoftware_licenze").select("piano, prezzo_aml, stato").eq("studio_id", studioId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      const piano = String(data?.piano || "");
      const prezzoAml = Number(data?.prezzo_aml || 0);
      const stato = String(data?.stato || "");
      setAmlAttivo(stato === "attivo" && (piano.includes("AML") || prezzoAml > 0));
    } catch (err) {
      console.error("Errore caricamento licenza AML:", err);
      setAmlAttivo(false);
    }
  };

  const checkFascicoloDocumenti = async (row: AV1Row) => {
    const supabase = getSupabaseClient() as any;
    let query = supabase.from("tbAVFascicoliDocumenti").select("tipo_documento, origine");
    if (row.pratica_id) query = query.eq("pratica_id", row.pratica_id);
    else if (row.id) query = query.eq("av1_id", row.id);
    else return { completo: false, mancanti: ["Fascicolo non collegato alla pratica"] };
    const { data, error } = await query;
    if (error) return { completo: false, mancanti: ["Errore controllo fascicolo"] };
    const docs = data || [];
    const normalizza = (value: any) => String(value || "").toLowerCase().trim();
    const hasDoc = (check: (doc: any) => boolean) => docs.some(check);
    const av1 = hasDoc((doc: any) => ["av1_pdf", "av1 firmato"].includes(normalizza(doc.origine)) || ["av1 firmato", "modulo firmato"].includes(normalizza(doc.tipo_documento)));
    const av4 = hasDoc((doc: any) => ["av4_pdf", "av4 firmato"].includes(normalizza(doc.origine)) || normalizza(doc.tipo_documento) === "av4 firmato");
    const documentoIdentita = hasDoc((doc: any) => ["documento_rappresentante", "documento rappresentante"].includes(normalizza(doc.origine)) || ["documento identità", "documento identita"].includes(normalizza(doc.tipo_documento)));
    const cliente = getCliente(row);
    const nomeCliente = normalizza(cliente?.ragione_sociale || cliente?.cod_cliente);
    const isSocietaCliente = nomeCliente.includes("s.r.l") || nomeCliente.includes("srl") || nomeCliente.includes("s.p.a") || nomeCliente.includes("spa") || nomeCliente.includes("società") || nomeCliente.includes("societa");
    const visura = !isSocietaCliente || hasDoc((doc: any) => normalizza(doc.origine).includes("visura") || normalizza(doc.tipo_documento).includes("visura"));
    const contratto = hasDoc((doc: any) => normalizza(doc.origine).includes("contratto") || normalizza(doc.tipo_documento).includes("contratto"));
    const mancanti: string[] = [];
    if (!av1) mancanti.push("AV1 firmato");
    if (!av4) mancanti.push("AV4 firmato");
    if (!documentoIdentita) mancanti.push("Documento identità");
    if (isSocietaCliente && !visura) mancanti.push("Visura camerale");
    if (!contratto) mancanti.push("Contratto professionale");
    return { completo: mancanti.length === 0, mancanti };
  };

  const loadRowsBySocieta = async (societaId: string) => {
    try {
      setLoading(true);
      setRows([]);
      const supabaseAny = getSupabaseClient() as any;
      const { data: praticheData, error: praticheError } = await supabaseAny.from("tbPraticheAML").select(`id, studio_id, cliente_id, societa_id, data_apertura, stato, stato_ciclo, av1_id, av2_id, av2_corrente_id, av4_id, av4_corrente_id, tbclienti (id, cod_cliente, ragione_sociale, codice_fiscale, utente_operatore_id, utente_operatore:tbutenti!tbclienti_utente_operatore_id_fkey (nome, cognome))`).eq("societa_id", societaId).order("data_apertura", { ascending: false });
      if (praticheError) throw praticheError;
      const praticheRows = (praticheData as PraticaAMLRow[]) || [];
      const rowsBase: AV1Row[] = await Promise.all(praticheRows.map(async (pratica) => {
        const [{ data: av1 }, { data: av2 }, { data: av4 }] = await Promise.all([
          supabaseAny.from("tbAV1").select("id, studio_id, cliente_id, societa_id, pratica_id, incaricato_adeguata_verifica_id, DataVerifica, ScadenzaVerifica, AV1Conferma, AV2Generato, AV4Generato").eq("pratica_id", pratica.id).maybeSingle(),
          pratica.av2_corrente_id || pratica.av2_id ? supabaseAny.from("tbAV2").select("id, confermato").eq("id", pratica.av2_corrente_id || pratica.av2_id).maybeSingle() : supabaseAny.from("tbAV2").select("id, confermato").eq("pratica_id", pratica.id).maybeSingle(),
          supabaseAny.from("tbAV4").select("id, av1_id, Av4InviatoCL, public_sent_at, compilato_da_cliente, av4_caricato_manualmente").eq("pratica_id", pratica.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        return {
          id: av1?.id ? String(av1.id) : "",
          pratica_id: pratica.id,
          societa_id: pratica.societa_id || null,
          studio_id: pratica.studio_id || null,
          cliente_id: pratica.cliente_id || null,
          incaricato_adeguata_verifica_id: av1?.incaricato_adeguata_verifica_id || null,
          DataVerifica: av1?.DataVerifica || pratica.data_apertura || null,
          ScadenzaVerifica: av1?.ScadenzaVerifica || null,
          AV1Conferma: !!av1?.AV1Conferma,
          AV2Generato: !!av2?.confermato,
          AV2Confermato: !!av2?.confermato,
          AV4Generato: !!av4?.id,
          tbclienti: pratica.tbclienti || null,
          av4_info: av4 || null,
          stato_pratica: pratica.stato || "aperta",
          is_pratica_only: !av1?.id,
        };
      }));
      const rowsConFascicolo = await Promise.all(rowsBase.map(async (row) => {
        const check = await checkFascicoloDocumenti(row);
        return { ...row, fascicolo_completo: check.completo, fascicolo_mancanti: check.mancanti };
      }));
      setRows(rowsConFascicolo);
    } catch (err: any) {
      console.error("Errore loadRowsBySocieta:", err);
      alert(`Errore loadRowsBySocieta: ${err?.message || "errore sconosciuto"}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const clearAmlTimers = () => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    if (hiddenTimeoutRef.current) clearTimeout(hiddenTimeoutRef.current);
    inactivityTimeoutRef.current = null;
    warningIntervalRef.current = null;
    autoCloseTimeoutRef.current = null;
    hiddenTimeoutRef.current = null;
  };

  const closeTimeoutModal = () => {
    setShowTimeoutModal(false);
    setTimeoutCountdown(Math.floor(AML_WARNING_MS / 1000));
    if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    warningIntervalRef.current = null;
    autoCloseTimeoutRef.current = null;
  };

  const clearAccessState = () => {
    setUnlockedSocietaId(null);
    setRows([]);
    setRicercaCliente("");
    setPassword("");
    setPasswordError("");
    setShowPasswordModal(false);
    setShowForgotPasswordInfo(false);
    setShowTimeoutModal(false);
    setWorkingId(null);
    if (typeof window !== "undefined") sessionStorage.removeItem(AML_SESSION_KEY);
  };

  const handleCloseAccess = () => {
    clearAmlTimers();
    closeTimeoutModal();
    clearAccessState();
    setSocietaFilter("");
    setSelectedSocieta(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(AML_SESSION_KEY);
      sessionStorage.removeItem(AML_SELECTED_SOCIETA_KEY);
    }
    router.replace(router.asPath);
  };

  const startWarningPhase = () => {
    closeTimeoutModal();
    const warningStartedAt = Date.now();
    setShowTimeoutModal(true);
    setTimeoutCountdown(Math.ceil(AML_WARNING_MS / 1000));
    warningIntervalRef.current = setInterval(() => {
      const remainingMs = Math.max(0, AML_WARNING_MS - (Date.now() - warningStartedAt));
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
    const isProtectedSocieta = !!selectedSocieta?.antiriciclaggio_enabled;
    const canAccess = !!societaFilter && !!selectedSocieta && (!isProtectedSocieta || unlockedSocietaId === societaFilter);
    if (!canAccess) return;
    lastActivityRef.current = Date.now();
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    inactivityTimeoutRef.current = setTimeout(startWarningPhase, AML_TIMEOUT_MS - AML_WARNING_MS);
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
      await loadLicenzaAML();
      setLoading(false);
    };
    void init();
  }, []);

  useEffect(() => {
    if (!societaFilter || societaOptions.length === 0) {
      setSelectedSocieta(null);
      return;
    }
    setSelectedSocieta(societaOptions.find((s) => s.id === societaFilter) || null);
  }, [societaFilter, societaOptions]);

  useEffect(() => {
    const tryRestoreAccess = async () => {
      if (!societaFilter || !selectedSocieta) {
        setRows([]);
        return;
      }
      if (!selectedSocieta.antiriciclaggio_enabled) {
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
  const canAccessAntiriciclaggio = !!societaFilter && !!selectedSocieta && (!isProtectedSocieta || unlockedSocietaId === societaFilter);
  const isSocietaSelectionLocked = !!societaFilter && !!selectedSocieta && !!isProtectedSocieta && unlockedSocietaId === societaFilter;

  useEffect(() => {
    if (typeof window === "undefined" || !canAccessAntiriciclaggio) {
      clearAmlTimers();
      closeTimeoutModal();
      return;
    }
    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    const onActivity = () => {
      if (!showTimeoutModal) resetInactivityTimer();
    };
    events.forEach((eventName) => window.addEventListener(eventName, onActivity));
    if (!showTimeoutModal) resetInactivityTimer();
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      if (!showTimeoutModal) clearAmlTimers();
    };
  }, [canAccessAntiriciclaggio]);

  useEffect(() => {
    if (typeof window === "undefined" || !canAccessAntiriciclaggio) return;
    const closeAfterHidden = () => {
      if (hiddenTimeoutRef.current) clearTimeout(hiddenTimeoutRef.current);
      hiddenTimeoutRef.current = setTimeout(handleCloseAccess, AML_TIMEOUT_MS);
    };
    const cancelHiddenClose = () => {
      if (hiddenTimeoutRef.current) clearTimeout(hiddenTimeoutRef.current);
      hiddenTimeoutRef.current = null;
      resetInactivityTimer();
    };
    document.addEventListener("visibilitychange", () => document.hidden ? closeAfterHidden() : cancelHiddenClose());
    window.addEventListener("blur", closeAfterHidden);
    window.addEventListener("focus", cancelHiddenClose);
    return () => {
      window.removeEventListener("blur", closeAfterHidden);
      window.removeEventListener("focus", cancelHiddenClose);
      if (hiddenTimeoutRef.current) clearTimeout(hiddenTimeoutRef.current);
    };
  }, [canAccessAntiriciclaggio]);

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
    return () => router.events.off("routeChangeStart", handleRouteChangeStart);
  }, [router.events]);

  const filteredRows = useMemo(() => {
    if (!societaFilter || !canAccessAntiriciclaggio) return [];
    const ricerca = ricercaCliente.trim().toLocaleLowerCase("it");
    return rows
      .filter((row) => {
        if (row.societa_id !== societaFilter) return false;
        if (!ricerca) return true;
        const cliente = getCliente(row);
        const valori = [cliente?.ragione_sociale, cliente?.cod_cliente, cliente?.codice_fiscale]
          .map((value) => String(value || "").toLocaleLowerCase("it"));
        return valori.some((value) => value.includes(ricerca));
      })
      .sort((a, b) => {
        const clienteA = getCliente(a);
        const clienteB = getCliente(b);
        const nomeA = String(clienteA?.ragione_sociale || clienteA?.cod_cliente || clienteA?.codice_fiscale || "").toLowerCase();
        const nomeB = String(clienteB?.ragione_sociale || clienteB?.cod_cliente || clienteB?.codice_fiscale || "").toLowerCase();
        return nomeA.localeCompare(nomeB, "it");
      });
  }, [rows, societaFilter, canAccessAntiriciclaggio, ricercaCliente]);

  const handleSocietaChange = (societaId: string) => {
    if (isSocietaSelectionLocked) return;
    setRicercaCliente("");
    setSocietaFilter(societaId);
    if (typeof window !== "undefined") {
      if (societaId) sessionStorage.setItem(AML_SELECTED_SOCIETA_KEY, societaId);
      else sessionStorage.removeItem(AML_SELECTED_SOCIETA_KEY);
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
    setShowPasswordModal(!!societa?.antiriciclaggio_enabled);
  };

  const handleUnlockSocieta = async () => {
    try {
      if (!selectedSocieta?.id) return setPasswordError("Seleziona una società.");
      if (!password.trim()) return setPasswordError("Inserisci la password.");
      setPasswordLoading(true);
      setPasswordError("");
      const res = await fetch("/api/antiriciclaggio/verify-societa-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ societaId: selectedSocieta.id, password: password.trim() }) });
      const data = await res.json();
      if (!res.ok || !data?.ok) return setPasswordError(data?.error || "Password non corretta.");
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
      setPasswordError(err?.message || "Errore durante la verifica password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleNuovoAV1 = () => {
    if (!canAccessAntiriciclaggio) return;
    router.push(selectedSocieta?.id ? `/antiriciclaggio/pratiche/nuovo?societa_id=${selectedSocieta.id}` : "/antiriciclaggio/pratiche/nuovo");
  };

  const handleApriAV1 = (row: AV1Row) => {
    if (!canAccessAntiriciclaggio) return;
    if (row.id) return void router.push(`/antiriciclaggio/modello-av1?id=${row.id}`);
    if (row.pratica_id) return void router.push(`/antiriciclaggio/modello-av1?pratica_id=${row.pratica_id}&societa_id=${row.societa_id || ""}&cliente_id=${row.cliente_id || ""}&studio_id=${row.studio_id || ""}`);
  };

  const handleApriAV2 = (row: AV1Row) => {
    if (!canAccessAntiriciclaggio) return;
    router.push(`/antiriciclaggio/modello-av2?pratica_id=${row.pratica_id || ""}&societa_id=${row.societa_id || ""}&cliente_id=${row.cliente_id || ""}&studio_id=${row.studio_id || ""}`);
  };

  const handleApriAV4 = (row: AV1Row) => {
    if (!canAccessAntiriciclaggio) return;
    router.push(`/antiriciclaggio/modello-av4?pratica_id=${row.pratica_id || ""}&societa_id=${row.societa_id || ""}&cliente_id=${row.cliente_id || ""}&studio_id=${row.studio_id || ""}`);
  };

  const handleApriDocumenti = (row: AV1Row) => {
    if (!canAccessAntiriciclaggio) return;
    const query = new URLSearchParams({ pratica_id: row.pratica_id || "", av1_id: row.id || "", cliente_id: row.cliente_id || "", societa_id: row.societa_id || "", studio_id: row.studio_id || "" });
    router.push(`/antiriciclaggio/fascicolo-documenti?${query.toString()}`);
  };

  const handleEliminaCompleto = async (row: AV1Row) => {
    if (!canAccessAntiriciclaggio || !row.pratica_id) return;
    if (!window.confirm("Vuoi eliminare questa pratica AML?")) return;
    const supabaseAny = getSupabaseClient() as any;
    const { error } = await supabaseAny.from("tbPraticheAML").delete().eq("id", row.pratica_id);
    if (error) return alert(error.message);
    await loadRowsBySocieta(societaFilter);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className="text-2xl font-bold">Elenco Antiriciclaggio</h1>
        <div className="flex items-center gap-2">
          {canAccessAntiriciclaggio && isProtectedSocieta && <button type="button" onClick={handleCloseAccess} className="rounded border border-red-300 bg-white px-4 py-2 text-red-700 hover:bg-red-50">Chiudi accesso</button>}
          <button type="button" onClick={handleNuovoAV1} disabled={!canAccessAntiriciclaggio} className={`rounded px-4 py-2 text-white ${canAccessAntiriciclaggio ? "bg-blue-600 hover:bg-blue-700" : "cursor-not-allowed bg-gray-400"}`}>Nuova pratica</button>
        </div>
      </div>

      <div className="mb-4 max-w-md">
        <label className="mb-1 block text-sm font-medium">Seleziona soggetto responsabile</label>
        <select className={`w-full rounded-md border px-3 py-2 ${isSocietaSelectionLocked ? "cursor-not-allowed bg-gray-100 text-gray-500" : ""}`} value={societaFilter} onChange={(e) => handleSocietaChange(e.target.value)} disabled={isSocietaSelectionLocked}>
          <option value="">Seleziona soggetto responsabile</option>
          {societaOptions.map((soc) => <option key={soc.id} value={soc.id}>{soc.Denominazione}</option>)}
        </select>
        {isSocietaSelectionLocked && selectedSocieta && <div className="mt-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">Accesso attivo su <span className="font-semibold">{selectedSocieta.Denominazione}</span>. Per cambiare soggetto responsabile usa prima <span className="font-semibold">Chiudi accesso</span>.</div>}
      </div>

      {canAccessAntiriciclaggio && (
        <div className="mb-4 max-w-md">
          <label className="mb-1 block text-sm font-medium">Ricerca cliente</label>
          <input
            type="search"
            value={ricercaCliente}
            onChange={(e) => setRicercaCliente(e.target.value)}
            placeholder="Cerca nominativo, codice cliente o C.F...."
            className="w-full rounded-md border bg-white px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>
      )}

      {selectedSocieta && isProtectedSocieta && !canAccessAntiriciclaggio && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Per visualizzare le pratiche antiriciclaggio della società selezionata è necessaria l’autenticazione con password.</div>}

      {loading ? <div>Caricamento...</div> : !societaFilter ? <div>Seleziona un soggetto responsabile per visualizzare le pratiche</div> : !canAccessAntiriciclaggio ? <div>Accesso riservato: inserisci la password della società per consultare le pratiche.</div> : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-100"><tr><th className="p-3 text-left">Stato</th><th className="p-3 text-left">Cliente</th><th className="p-3 text-left">Utente di riferimento</th><th className="p-3 text-left">Data verifica</th><th className="p-3 text-left">Scadenza verifica</th><th className="p-2 text-center">AV1<br/>conferma</th><th className="p-2 text-center">AV2<br/>confermato</th><th className="p-2 text-center">AV4<br/>inviato</th><th className="p-2 text-center">AV4<br/>manuale</th><th className="p-3 text-center">Data invio AV4</th><th className="p-2 text-center">AV4<br/>confermato</th><th className="p-3 text-center">Azioni</th></tr></thead>
            <tbody>
              {filteredRows.length === 0 ? <tr><td colSpan={12} className="p-4 text-center">{ricercaCliente ? "Nessun cliente corrisponde alla ricerca" : "Nessuna pratica trovata per il soggetto responsabile selezionato"}</td></tr> : filteredRows.map((row) => {
                const cliente = getCliente(row);
                const av4Info = getAV4Info(row);
                const nomeCliente = cliente?.ragione_sociale || cliente?.cod_cliente || cliente?.codice_fiscale || "-";
                const statoInfo = getStatoInfo(row);
                return <tr key={row.pratica_id || row.id} className={`border-t ${getRowClassName(row)}`}>
                  <td className={`p-3 ${statoInfo.className}`}><div className="flex items-center gap-3"><span className={`inline-block h-5 w-5 rounded-full ${statoInfo.dotClass} shadow`}/><span>{statoInfo.text}</span></div></td>
                  <td className="p-3">{nomeCliente}</td>
                  <td className="p-3">{cliente?.utente_operatore ? `${cliente.utente_operatore.nome || ""} ${cliente.utente_operatore.cognome || ""}`.trim() || "-" : "-"}</td>
                  <td className="p-3">{formatDate(row.DataVerifica)}</td>
                  <td className={`p-3 ${getScadenzaCellClassName(row.ScadenzaVerifica)}`}>{formatDate(row.ScadenzaVerifica)}</td>
                  <td className="p-2 text-center">{row.AV1Conferma ? "Sì" : "No"}</td>
                  <td className="p-2 text-center">{row.AV2Generato ? "Sì" : "No"}</td>
                  <td className="p-2 text-center">{av4Info?.Av4InviatoCL || av4Info?.public_sent_at ? "Sì" : "No"}</td>
                  <td className="p-2 text-center">{av4Info?.av4_caricato_manualmente ? "Sì" : "-"}</td>
                  <td className="p-3 text-center">{formatDateTime(av4Info?.public_sent_at)}</td>
                  <td className="p-2 text-center">{av4Info?.compilato_da_cliente || row.stato_pratica === "av4_ricevuto" ? "Sì" : "No"}</td>
                  <td className="p-3"><div className="flex items-center justify-center gap-3">
                    <button onClick={() => handleApriAV1(row)} className={`rounded-[28px] bg-white p-1 ${getIconBorderClass(!!row.AV1Conferma)}`}>AV1</button>
                    <button onClick={() => handleApriAV2(row)} className={`rounded-[28px] bg-white p-1 ${getIconBorderClass(!!row.AV2Generato)}`}>AV2</button>
                    <button onClick={() => handleApriAV4(row)} className={`rounded-[28px] bg-white p-1 ${getAV4IconBorderClass(row)}`}>AV4</button>
                    <button onClick={() => handleApriDocumenti(row)} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-500 bg-white"><FolderOpen className="h-4 w-4 text-blue-600"/></button>
                    <button onClick={() => handleEliminaCompleto(row)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white"><Trash2 className="h-4 w-4 text-red-500"/></button>
                  </div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}

      {showPasswordModal && selectedSocieta && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-start justify-between"><div><h2 className="text-lg font-semibold">Accesso riservato antiriciclaggio</h2><p className="mt-1 text-sm text-gray-600">Inserisci la password per accedere alla società <span className="font-medium">{selectedSocieta.Denominazione}</span>.</p></div><button onClick={() => { setShowPasswordModal(false); setSocietaFilter(""); setSelectedSocieta(null); clearAccessState(); }}><X className="h-5 w-5"/></button></div><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !passwordLoading) void handleUnlockSocieta(); }} className="w-full rounded-md border px-3 py-2" autoFocus/>{passwordError && <div className="mt-3 text-sm text-red-700">{passwordError}</div>}<div className="mt-4 flex justify-end gap-2"><button onClick={() => setShowPasswordModal(false)} className="rounded border px-4 py-2">Annulla</button><button onClick={() => void handleUnlockSocieta()} disabled={passwordLoading} className="rounded bg-blue-600 px-4 py-2 text-white">{passwordLoading ? "Verifica..." : "Accedi"}</button></div></div></div>}

      {showTimeoutModal && canAccessAntiriciclaggio && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-semibold text-red-700">Sessione in scadenza</h2><p className="mt-2 text-sm">La sessione verrà chiusa tra <strong>{timeoutCountdown}</strong> secondi.</p><div className="mt-4 flex justify-end gap-2"><button onClick={handleCloseAccess} className="rounded border px-4 py-2">Chiudi ora</button><button onClick={handleContinueSession} className="rounded bg-blue-600 px-4 py-2 text-white">Continua sessione</button></div></div></div>}
    </div>
  );
}
