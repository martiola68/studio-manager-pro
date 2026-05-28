import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function NuovoControlloGestione() {
  const router = useRouter();

  const [studioId, setStudioId] = useState("");
  const [clienti, setClienti] = useState<any[]>([]);
  const [utentiDisponibili, setUtentiDisponibili] = useState<any[]>([]);
  const [utenteSelezionato, setUtenteSelezionato] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    cliente_id: "",
    cadenza_controllo: "mensile",
    data_esecuzione: new Date().toISOString().slice(0, 10),
    note: "",
    link: "",
    step_1_completato: false,
    step_1_note: "",

    step_2_completato: false,
    step_2_note: "",

    step_3_completato: false,
    step_3_note: "",

    step_4_completato: false,
    step_4_note: "",
    utenti: [] as string[],
  });

  useEffect(() => {
    async function init() {
      const supabase = getSupabaseClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        alert("Sessione non trovata");
        return;
      }

      const { data: utente, error: utenteError } = await supabase
        .from("tbutenti")
        .select("id, studio_id, email")
        .eq("email", session.user.email)
        .single();

      if (utenteError || !utente?.studio_id) {
        alert("Studio utente non trovato");
        return;
      }

      setStudioId(utente.studio_id);

      const clientiRes = await fetch("/api/controllo-gestione/clienti-disponibili");
      const clientiData = await clientiRes.json();
      setClienti(Array.isArray(clientiData) ? clientiData : []);

      const utentiRes = await fetch("/api/controllo-gestione/utenti-disponibili");
      const utentiData = await utentiRes.json();
      setUtentiDisponibili(Array.isArray(utentiData) ? utentiData : []);
    }

    init();
  }, []);

  const utentiInseriti = useMemo(() => {
    return utentiDisponibili.filter((u) => form.utenti.includes(u.id));
  }, [utentiDisponibili, form.utenti]);

  const utentiSelezionabili = useMemo(() => {
    return utentiDisponibili.filter((u) => !form.utenti.includes(u.id));
  }, [utentiDisponibili, form.utenti]);

  function aggiungiUtente() {
    if (!utenteSelezionato) return;

    setForm((prev) => ({
      ...prev,
      utenti: [...prev.utenti, utenteSelezionato],
    }));

    setUtenteSelezionato("");
  }

  function rimuoviUtente(id: string) {
    setForm((prev) => ({
      ...prev,
      utenti: prev.utenti.filter((x) => x !== id),
    }));
  }

  async function salva() {
    if (!studioId) {
      alert("Studio utente mancante");
      return;
    }

    if (!form.cliente_id) {
      alert("Seleziona una società");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/controllo-gestione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          studio_id: studioId,
        }),
      });

      const controllo = await res.json();

      if (!res.ok) {
        alert(controllo.error || "Errore durante il salvataggio");
        setSaving(false);
        return;
      }

      if (files?.length) {
        const fd = new FormData();
        Array.from(files).forEach((f) => fd.append("files", f));

        const uploadRes = await fetch(
          `/api/controllo-gestione/${controllo.id}/allegati`,
          {
            method: "POST",
            body: fd,
          }
        );

        if (!uploadRes.ok) {
          const uploadError = await uploadRes.json();
          alert(uploadError.error || "Controllo creato, ma errore upload allegati");
        }
      }

      router.push("/controllo-gestione");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Nuovo controllo di gestione</h1>

      <div className="grid grid-cols-2 gap-4">
        <select
          className="border p-2 rounded"
          value={form.cliente_id}
          onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
        >
          <option value="">Seleziona società</option>
          {clienti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.ragione_sociale || c.nome || c.denominazione}
            </option>
          ))}
        </select>

        <select
          className="border p-2 rounded"
          value={form.cadenza_controllo}
          onChange={(e) =>
            setForm({ ...form, cadenza_controllo: e.target.value })
          }
        >
          <option value="mensile">Mensile</option>
          <option value="trimestrale">Trimestrale</option>
          <option value="quadrimestrale">Quadrimestrale</option>
          <option value="semestrale">Semestrale</option>
        </select>

<input
  type="date"
  className="border p-2 rounded col-span-2"
  value={form.data_esecuzione}
  onChange={(e) =>
    setForm({ ...form, data_esecuzione: e.target.value })
  }
/>

        <input
          className="border p-2 rounded col-span-2"
          placeholder="Link"
          value={form.link}
          onChange={(e) => setForm({ ...form, link: e.target.value })}
        />

        <textarea
          className="border p-2 rounded col-span-2"
          placeholder="Note"
          rows={4}
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />

        <input
          type="file"
          multiple
          className="border p-2 rounded col-span-2"
          onChange={(e) => setFiles(e.target.files)}
        />
      </div>

      <div className="border rounded p-4 space-y-4 col-span-2">
  <h2 className="font-semibold">Checklist controllo di gestione</h2>

  {[
    {
      n: 1,
      titolo: "Rilevamento dei Dati (Consuntivo)",
      testo:
        "Raccolta dei dati contabili ed extracontabili e aggiornamento della contabilità analitica.",
    },
    {
      n: 2,
      titolo: "Confronto e Analisi degli Scostamenti",
      testo:
        "Confronto Budget vs. Consuntivo e analisi delle cause degli scostamenti.",
    },
    {
      n: 3,
      titolo: "Redazione del Report (Reporting)",
      testo:
        "Creazione del report con KPI principali e condivisione con management o direzione.",
    },
    {
      n: 4,
      titolo: "Definizione delle Azioni Correttive",
      testo:
        "Pianificazione degli interventi e aggiornamento delle previsioni future.",
    },
  ].map((step) => (
    <div key={step.n} className="border rounded p-3 space-y-2 bg-white">
      <label className="flex items-start gap-2 font-medium">
        <input
          type="checkbox"
          checked={(form as any)[`step_${step.n}_completato`]}
          onChange={(e) =>
            setForm({
              ...form,
              [`step_${step.n}_completato`]: e.target.checked,
            } as any)
          }
        />
        <span>
          {step.n}. {step.titolo}
        </span>
      </label>

      <p className="text-sm text-gray-600">{step.testo}</p>

      <textarea
        className="border p-2 rounded w-full"
        rows={2}
        placeholder="Note step"
        value={(form as any)[`step_${step.n}_note`]}
        onChange={(e) =>
          setForm({
            ...form,
            [`step_${step.n}_note`]: e.target.value,
          } as any)
        }
      />
    </div>
  ))}
</div>

    <div className="border rounded p-4 space-y-3">
  <h2 className="font-semibold">Utenti assegnati</h2>

  <div className="flex gap-2">
    <select
      className="border p-2 rounded flex-1"
      value={utenteSelezionato}
      onChange={(e) => setUtenteSelezionato(e.target.value)}
    >
      <option value="">Seleziona utente</option>
      {utentiDisponibili
        .filter((u) => !form.utenti.includes(u.id))
        .map((u) => (
          <option key={u.id} value={u.id}>
            {[u.nome, u.cognome].filter(Boolean).join(" ") || u.email}
          </option>
        ))}
    </select>

    <button
      type="button"
      onClick={aggiungiUtente}
      className="border px-4 py-2 rounded bg-gray-100"
    >
      Aggiungi
    </button>
  </div>

  {utentiDisponibili
    .filter((u) => form.utenti.includes(u.id))
    .map((u) => (
      <div
        key={u.id}
        className="flex justify-between items-center border rounded px-3 py-2 bg-white"
      >
        <span>
          {[u.nome, u.cognome].filter(Boolean).join(" ") || u.email}
        </span>

        <button
          type="button"
          onClick={() => rimuoviUtente(u.id)}
          className="text-red-600 text-sm"
        >
          Rimuovi
        </button>
      </div>
    ))}
</div>
      <div className="flex gap-2">
  <button
    type="button"
    onClick={() => router.push("/controllo-gestione")}
    className="border px-4 py-2 rounded"
  >
    Annulla
  </button>

  <button
    onClick={salva}
    disabled={saving}
    className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
  >
    {saving ? "Salvataggio..." : "Salva record"}
  </button>
</div>
    </div>
  );
}
