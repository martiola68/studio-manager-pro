import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, Save, ShieldCheck } from "lucide-react";
import { clienteService } from "@/services/clienteService";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useStudio } from "@/contexts/StudioContext";
import { normalizeCF, isValidCF } from "@/utils/codiceFiscale";
import {
  isEncryptionEnabled, isEncryptionLocked,
  encryptClienteSensitiveData, decryptClienteSensitiveData,
} from "@/services/encryptionService";

type Operator = { id: string; nome?: string | null; cognome?: string | null; attivo?: boolean | null };
type ClientForm = {
  cod_cliente: string;
  tipo_cliente: "Persona fisica" | "Altro";
  professionista_incaricato: boolean;
  cliente: boolean;
  attivo: boolean;
  ragione_sociale: string;
  cognome: string;
  nome: string;
  partita_iva: string;
  codice_fiscale: string;
  indirizzo: string;
  citta: string;
  provincia: string;
  cap: string;
  email: string;
  telefono: string;
  pec: string;
  utente_operatore_id: string;
  utente_professionista_id: string;
  note: string;
};
const empty: ClientForm = {
  cod_cliente: "",
  tipo_cliente: "Persona fisica",
  professionista_incaricato: false,
  cliente: true,
  attivo: true,
  ragione_sociale: "",
  cognome: "",
  nome: "",
  partita_iva: "",
  codice_fiscale: "",
  indirizzo: "",
  citta: "",
  provincia: "",
  cap: "",
  email: "",
  telefono: "",
  pec: "",
  utente_operatore_id: "",
  utente_professionista_id: "",
  note: "",
};

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";
const nullable = (value: string) => value.trim() || null;
const readonlyName = (operator: Operator) => [operator.cognome,operator.nome].filter(Boolean).join(" ").trim() || operator.id;

function Field({ label, value, onChange, type="text", required=false, disabled=false, span=false, maxLength, autoComplete }: {
  label: string; value: string; onChange: (value: string)=>void;
  type?: string; required?: boolean; disabled?: boolean; span?: boolean;
  maxLength?: number; autoComplete?: string;
}) {
  return <label className={span?"md:col-span-2":""}>
    <span className={labelClass}>{label}{required && <span className="text-red-600"> *</span>}</span>
    <input className={inputClass} value={value} onChange={e=>onChange(e.target.value)}
      type={type} required={required} disabled={disabled} maxLength={maxLength} autoComplete={autoComplete} />
  </label>;
}

export default function AmlClienteForm({ clientId }: { clientId?: string }) {
  const router = useRouter();
  const { studioId, isLoading: studioLoading } = useStudio();
  const [form, setForm] = useState<ClientForm>(empty);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [encrypted, setEncrypted] = useState(false);
  const [locked, setLocked] = useState(false);

  const update = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) =>
    setForm(old => ({ ...old, [key]: value }));

  useEffect(() => {
    if (studioLoading || !studioId || (clientId && !router.isReady)) return;
    let active = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const supabase = getSupabaseClient();
        const encryption = await isEncryptionEnabled(studioId);
        const lockedNow = encryption && isEncryptionLocked();
        if (!active) return;
        setEncrypted(encryption); setLocked(lockedNow);
        if (lockedNow) throw new Error("Dati cifrati: sblocca prima la password master SMP. Nessun dato verrà salvato senza la chiave.");
        const [{ data: users, error: usersError }, row] = await Promise.all([
          supabase.from("tbutenti").select("id,nome,cognome,attivo")
            .eq("studio_id",studioId).order("cognome"),
          clientId ? clienteService.getClienteById(clientId) : Promise.resolve(null)
        ]);
        if (usersError) throw usersError;
        if (!active) return;
        setOperators((users||[]) as Operator[]);
        if (row) {
          const source: any = row;
          const decrypted = encryption
            ? await decryptClienteSensitiveData({
                codice_fiscale:source.codice_fiscale, partita_iva:source.partita_iva, note:source.note
              })
            : { codice_fiscale:source.codice_fiscale, partita_iva:source.partita_iva, note:source.note };
          if (!active) return;
          setForm({
            cod_cliente: source.cod_cliente || "",
            tipo_cliente: source.tipo_cliente === "Altro" ? "Altro" : "Persona fisica",
            professionista_incaricato: !!source.professionista_incaricato,
            cliente: source.cliente ?? true,
            attivo: source.attivo ?? true,
            ragione_sociale: source.ragione_sociale || "",
            cognome: source.cognome || "",
            nome: source.nome || "",
            partita_iva: decrypted.partita_iva || "",
            codice_fiscale: decrypted.codice_fiscale || "",
            indirizzo: source.indirizzo || "",
            citta: source.citta || "",
            provincia: source.provincia || "",
            cap: source.cap || "",
            email: source.email || "",
            telefono: source.telefono || "",
            pec: source.pec || "",
            utente_operatore_id: source.utente_operatore_id || "",
            utente_professionista_id: source.utente_professionista_id || "",
            note: decrypted.note || "",
          });
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Caricamento anagrafica non riuscito.");
      } finally { if(active)setLoading(false); }
    };
    void run();
    return () => { active = false; };
  }, [studioId, studioLoading, clientId, router.isReady]);

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (locked || saving) return;
    setError("");
    try {
      if (!studioId) throw new Error("Studio non disponibile");
      const person = form.tipo_cliente === "Persona fisica";
      const name = person ? [form.cognome.trim(), form.nome.trim()].filter(Boolean).join(" ") : form.ragione_sociale.trim();
      if (!name) throw new Error(person ? "Inserisci cognome e nome." : "Inserisci il nome del cliente / ragione sociale.");
      if (person && (!form.cognome.trim() || !form.nome.trim())) throw new Error("Cognome e nome sono obbligatori per una persona fisica.");
      const cf = normalizeCF(form.codice_fiscale || "");
      if (!cf) throw new Error("Codice fiscale obbligatorio.");
      if (person && !isValidCF(cf)) throw new Error("Il codice fiscale della persona fisica non è valido.");
      if (!person && !/^[0-9]{11}$/.test(cf)) throw new Error("Per le società il codice fiscale deve contenere 11 cifre.");
      if (form.cliente && !form.utente_operatore_id) throw new Error("Seleziona un Utente per il settore fiscale.");
      if (encrypted && isEncryptionLocked()) throw new Error("Password master scaduta: sblocca i dati cifrati prima di salvare.");
      setSaving(true);
      // New AML clients default to Interno + Fiscale. On updates we intentionally
      // preserve every hidden field and the existing sector configuration.
      // The original SMP client form, database, and backend services are untouched.
      const payload: Record<string,unknown> = {
        cod_cliente: form.cod_cliente.trim() || (clientId ? null : "CL-"+Date.now().toString().slice(-6)),
        tipo_cliente: form.tipo_cliente,
        professionista_incaricato: form.professionista_incaricato,
        cliente: form.cliente,
        attivo: form.attivo,
        ragione_sociale: name,
        ...(person ? { cognome:nullable(form.cognome), nome:nullable(form.nome) } : { cognome:null, nome:null }),
        partita_iva: nullable(form.partita_iva),
        codice_fiscale: cf,
        indirizzo:nullable(form.indirizzo), citta:nullable(form.citta),
        provincia:nullable(form.provincia), cap:nullable(form.cap),
        email:nullable(form.email), telefono:nullable(form.telefono),
        pec:nullable(form.pec),
        utente_operatore_id:nullable(form.utente_operatore_id),
        utente_professionista_id:nullable(form.utente_professionista_id),
        note:nullable(form.note),
      };
      if (!clientId) Object.assign(payload,{
        tipologia_cliente:"Interno",
        settore_fiscale:true, settore_lavoro:false, settore_consulenza:false,
        flag_mail_attivo:false, flag_mail_newsletter:false,
        flag_mail_scadenze:false, flag_stampa_lista_clienti:true,
      });
      if (encrypted) {
        const values = await encryptClienteSensitiveData({
          codice_fiscale:payload.codice_fiscale as string,
          partita_iva:payload.partita_iva as string|null,
          note:payload.note as string|null,
        });
        Object.assign(payload,values);
      }
      if (clientId) await clienteService.updateCliente(clientId,payload as any);
      else await clienteService.createCliente(payload as any);
      await router.push("/aml/clienti");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvataggio cliente non riuscito.");
    } finally { setSaving(false); }
  };

  if (loading || studioLoading) return <p className="p-8 text-sm text-slate-500">Caricamento anagrafica AML...</p>;
  return <div className="mx-auto max-w-5xl space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Link href="/aml/clienti" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-blue-700"><ArrowLeft className="h-4 w-4"/> Torna alle anagrafiche</Link>
        <h1 className="text-2xl font-bold text-slate-900">{clientId?"Modifica cliente AML":"Nuovo cliente AML"}</h1>
        <p className="mt-1 text-sm text-slate-500">Una sola scheda · Anagrafica · stesso archivio clienti SMP</p>
      </div>
      <ShieldCheck className="h-8 w-8 text-blue-600"/>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {locked ? <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Sblocca la password master per visualizzare e modificare i dati cifrati.</p> :
    <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
      <h2 className="mb-6 border-b border-slate-100 pb-4 text-lg font-bold text-slate-900">Anagrafica</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Codice cliente" value={form.cod_cliente} onChange={v=>update("cod_cliente",v)} />
        <label><span className={labelClass}>Tipo cliente *</span><select className={inputClass} value={form.tipo_cliente} onChange={e=>update("tipo_cliente",e.target.value as ClientForm["tipo_cliente"])}>
          <option value="Persona fisica">Persona fisica</option><option value="Altro">Altro / Società</option>
        </select></label>
        <div className="md:col-span-2 flex flex-wrap gap-x-8 gap-y-3 rounded-lg bg-slate-50 px-4 py-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.professionista_incaricato} onChange={e=>update("professionista_incaricato",e.target.checked)} className="h-4 w-4 accent-blue-600"/> Professionista incaricato</label>
          <label className="inline-flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.cliente} onChange={e=>update("cliente",e.target.checked)} className="h-4 w-4 accent-blue-600"/> Cliente</label>
          <label className="inline-flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.attivo} onChange={e=>update("attivo",e.target.checked)} className="h-4 w-4 accent-blue-600"/> Cliente attivo</label>
        </div>
        <Field label="Cliente / Ragione sociale" value={form.tipo_cliente==="Persona fisica"?[form.cognome,form.nome].filter(Boolean).join(" "):form.ragione_sociale} onChange={v=>update("ragione_sociale",v)} disabled={form.tipo_cliente==="Persona fisica"} required={form.tipo_cliente==="Altro"} span/>
        <Field label="Cognome" value={form.cognome} onChange={v=>update("cognome",v)} required={form.tipo_cliente==="Persona fisica"} disabled={form.tipo_cliente!=="Persona fisica"}/>
        <Field label="Nome" value={form.nome} onChange={v=>update("nome",v)} required={form.tipo_cliente==="Persona fisica"} disabled={form.tipo_cliente!=="Persona fisica"}/>
        <Field label="Partita IVA" value={form.partita_iva} onChange={v=>update("partita_iva",v)} maxLength={11}/>
        <Field label="Codice fiscale" value={form.codice_fiscale} onChange={v=>update("codice_fiscale",v.toUpperCase())} required maxLength={16}/>
        <Field label="Indirizzo" value={form.indirizzo} onChange={v=>update("indirizzo",v)} span autoComplete="street-address"/>
        <Field label="Città" value={form.citta} onChange={v=>update("citta",v)} />
        <Field label="Provincia" value={form.provincia} onChange={v=>update("provincia",v.toUpperCase())} maxLength={2}/>
        <Field label="CAP" value={form.cap} onChange={v=>update("cap",v)} maxLength={5}/>
        <Field label="Email" value={form.email} onChange={v=>update("email",v)} type="email"/>
        <Field label="Telefono" value={form.telefono} onChange={v=>update("telefono",v)} type="tel"/>
        <Field label="PEC" value={form.pec} onChange={v=>update("pec",v)} type="email"/>
        <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
          <label><span className={labelClass}>Utente {form.cliente && <span className="text-red-600">*</span>}</span>
            <select className={inputClass} value={form.utente_operatore_id} onChange={e=>update("utente_operatore_id",e.target.value)} required={form.cliente}>
              <option value="">Seleziona utente</option>
              {operators.filter(u=>u.attivo!==false||u.id===form.utente_operatore_id).map(u=><option key={u.id} value={u.id}>{readonlyName(u)}</option>)}
            </select></label>
          <label><span className={labelClass}>Responsabile</span>
            <select className={inputClass} value={form.utente_professionista_id} onChange={e=>update("utente_professionista_id",e.target.value)}>
              <option value="">Seleziona responsabile</option>
              {operators.filter(u=>u.attivo!==false||u.id===form.utente_professionista_id).map(u=><option key={u.id} value={u.id}>{readonlyName(u)}</option>)}
            </select></label>
        </div>
        <label className="md:col-span-2"><span className={labelClass}>Note</span>
          <textarea className={inputClass+" min-h-28"} rows={4} value={form.note} onChange={e=>update("note",e.target.value)}/></label>
      </div>
      <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
        <Link href="/aml/clienti" className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Annulla</Link>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          <Save className="h-4 w-4"/>{saving?"Salvataggio...":clientId?"Salva modifiche":"Crea cliente"}
        </button>
      </div>
    </form>}
  </div>;
}
