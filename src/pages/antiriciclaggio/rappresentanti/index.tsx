import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* =========================================================
   CONFIG
   ========================================================= */
// ⚠️ METTI QUI IL NOME REALE DEL BUCKET (quello che vedi in Supabase > Storage)
const BUCKET_NAME = "allegati"; // <-- CAMBIA (es: "allegati", "docs", "storage_docs", ecc.)

/* =========================================================
   CODICE FISCALE VALIDATOR (formale + checksum)
   ========================================================= */
const CF_RE =
  /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

const OMO_MAP: Record<string, string> = {
  L: "0",
  M: "1",
  N: "2",
  P: "3",
  Q: "4",
  R: "5",
  S: "6",
  T: "7",
  U: "8",
  V: "9",
};

function normalizeCF(cf: string) {
  return (cf || "").trim().toUpperCase();
}

function cfToDigitsForChecksum(cf: string) {
  const chars = cf.split("");
  const idxs = [6, 7, 9, 10, 12, 13, 14];
  for (const i of idxs) {
    const c = chars[i];
    if (OMO_MAP[c]) chars[i] = OMO_MAP[c];
  }
  return chars.join("");
}

const ODD_MAP: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9,
  "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9,
  F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11,
  P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const EVEN_MAP: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4,
  "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  A: 0, B: 1, C: 2, D: 3, E: 4,
  F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14,
  P: 15, Q: 16, R: 17, S: 18, T: 19,
  U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

function computeCFCheckChar(cf15: string) {
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const c = cf15[i];
    const isOddPosition = (i + 1) % 2 === 1;
    sum += isOddPosition ? ODD_MAP[c] : EVEN_MAP[c];
  }
  const r = sum % 26;
  return String.fromCharCode("A".charCodeAt(0) + r);
}

function isValidCF(cfRaw: string) {
  const cf = normalizeCF(cfRaw);
  if (!CF_RE.test(cf)) return false;
  const cfNorm = cfToDigitsForChecksum(cf);
  const expected = computeCFCheckChar(cfNorm.substring(0, 15));
  return expected === cfNorm[15];
}

/* =========================================================
   TYPES
   ========================================================= */
type FormState = {
  nome_cognom: string;
  codice_fiscale: string;
  luogo_nascita: string;
  data_nascita: string;
  citta_residenz: string;
  indirizzo_resid: string;
  nazionalita: string;
  tipo_doc: "" | "Carta di identità" | "Passaporto";
  scadenza_doc: string;
  allegato_doc: string; // ✅ URL pubblico (bucket pubblico) oppure signed URL (bucket privato)
};

export default function RappresentantiPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [studioId, setStudioId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    nome_cognom: "",
    codice_fiscale: "",
    luogo_nascita: "",
    data_nascita: "",
    citta_residenz: "",
    indirizzo_resid: "",
    nazionalita: "",
    tipo_doc: "",
    scadenza_doc: "",
    allegato_doc: "",
  });

  /* =========================================================
     STUDIO_ID: localStorage -> tbutenti (via email)
     ========================================================= */
  useEffect(() => {
    const loadStudioId = async () => {
      setErrMsg(null);

      // 1) localStorage
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("studio_id");
        if (cached) {
          setStudioId(cached);
          return;
        }
      }

      // 2) utente loggato (email)
      const { data: auth } = await supabase.auth.getUser();
      const email = auth?.user?.email;
      if (!email) {
        setErrMsg("Utente non loggato: impossibile recuperare studio_id.");
        return;
      }

      // 3) tbutenti via email
      const { data, error } = await supabase
        .from("tbutenti")
        .select("studio_id")
        .eq("email", email)
        .single();

      if (error) {
        setErrMsg(`Errore lettura tbutenti: ${error.message}`);
        return;
      }

      const sid = data?.studio_id ? String((data as any).studio_id) : "";
      if (!sid) {
        setErrMsg("studio_id non presente in tbutenti per questo utente.");
        return;
      }

      setStudioId(sid);
      if (typeof window !== "undefined") {
        localStorage.setItem("studio_id", sid);
      }
    };

    loadStudioId();
  }, []);

  const cf = useMemo(() => normalizeCF(form.codice_fiscale), [form.codice_fiscale]);
  const cfOk = useMemo(() => (cf.length === 16 ? isValidCF(cf) : false), [cf]);

  const canSave = useMemo(() => {
    return !!studioId && form.nome_cognom.trim().length > 0 && cfOk;
  }, [studioId, form.nome_cognom, cfOk]);

  /* =========================================================
     STORAGE HELPERS
     ========================================================= */

  // 1) Verifica esistenza bucket (così l'errore è chiarissimo)
  async function assertBucketExists() {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    const ok = (data || []).some((b) => b.name === BUCKET_NAME);
    if (!ok) {
      throw new Error(
        `Bucket "${BUCKET_NAME}" non trovato. Apri Supabase > Storage e usa il nome esatto del bucket (case-sensitive).`
      );
    }
  }

  // 2) Decide URL: se bucket pubblico -> publicUrl, se privato -> signedUrl
  async function getOpenableUrl(path: string) {
    const { data: pub } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    const publicUrl = pub?.publicUrl;

    // Prova se è apribile subito (bucket pubblico) con un check leggero
    // Se fallisce (CORS o 401/403), fallback su signed URL.
    if (publicUrl) {
      try {
        // HEAD può fallire per CORS: in quel caso andiamo su signedUrl comunque
        await fetch(publicUrl, { method: "HEAD" });
        return publicUrl;
      } catch {
        // ignore -> fallback signed
      }
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 60 * 10); // 10 minuti
    if (error) throw error;
    return data.signedUrl;
  }

  /* =========================================================
     UPLOAD DOCUMENTO
     ========================================================= */
async function handleUploadDoc(file: File) {
  if (!studioId) {
    setErrMsg("studio_id non disponibile: impossibile caricare il documento.");
    return;
  }

  setUploading(true);
  setErrMsg(null);
  setOkMsg(null);

  try {
    const safeName = file.name.replace(/\s+/g, "_");
    const path = `rapp_legali/${studioId}/${Date.now()}_${safeName}`;

    const { data: upData, error: upErr } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, { upsert: true });

    if (upErr) {
      // errore completo in UI (così capiamo subito)
      throw new Error(`Upload fallito su bucket "${BUCKET_NAME}": ${upErr.message}`);
    }

    // PROVA URL pubblico
    const { data: pub } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    const publicUrl = pub?.publicUrl;

    // se bucket privato, il publicUrl potrebbe non essere accessibile: usiamo signed url
    let urlToSave = publicUrl || "";
    if (!urlToSave) {
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(path, 60 * 10);
      if (signErr) throw signErr;
      urlToSave = signed.signedUrl;
    }

    setForm((p) => ({ ...p, allegato_doc: urlToSave }));
    setOkMsg("✅ Documento allegato.");
  } catch (e: any) {
    setErrMsg(e?.message ?? "Errore upload documento");
  } finally {
    setUploading(false);
  }
}

  function handleRemoveDoc() {
    setForm((p) => ({ ...p, allegato_doc: "" }));
  }

  /* =========================================================
     SUBMIT
     ========================================================= */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    setErrMsg(null);

    if (!studioId) {
      setErrMsg("studio_id non disponibile: impossibile salvare.");
      return;
    }

    if (!canSave) {
      setErrMsg("Compila almeno Nome e Cognome e un Codice Fiscale valido (16 caratteri).");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        studio_id: studioId,
        nome_cognom: form.nome_cognom.trim(),
        codice_fiscale: cf,
        luogo_nascita: form.luogo_nascita.trim() || null,
        data_nascita: form.data_nascita || null,
        citta_residenz: form.citta_residenz.trim() || null,
        indirizzo_resid: form.indirizzo_resid.trim() || null,
        nazionalita: form.nazionalita.trim() || null,
        tipo_doc: form.tipo_doc || null,
        scadenza_doc: form.scadenza_doc || null,
        allegato_doc: form.allegato_doc || null,
      };

      const { error } = await (supabase as any).from("rapp_legali").insert(payload);
      if (error) throw error;

      setOkMsg("✅ Rappresentante salvato correttamente.");
      setForm({
        nome_cognom: "",
        codice_fiscale: "",
        luogo_nascita: "",
        data_nascita: "",
        citta_residenz: "",
        indirizzo_resid: "",
        nazionalita: "",
        tipo_doc: "",
        scadenza_doc: "",
        allegato_doc: "",
      });
    } catch (e: any) {
      setErrMsg(e?.message ?? "Errore inserimento rappresentante legale");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Anticiclaggio • Rappresentanti</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => router.push("/antiriciclaggio/elencorapp")}
            >
              Vai a elenco
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push("/antiriciclaggio")}
            >
              Torna al menù
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="nome_cognom">Nome e Cognome *</Label>
                <Input
                  id="nome_cognom"
                  value={form.nome_cognom}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nome_cognom: e.target.value }))
                  }
                  placeholder="Mario Rossi"
                />
              </div>

              <div>
                <Label htmlFor="codice_fiscale">Codice Fiscale *</Label>
                <Input
                  id="codice_fiscale"
                  value={form.codice_fiscale}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, codice_fiscale: e.target.value }))
                  }
                  placeholder="RSSMRA80A01H501U"
                  maxLength={16}
                />
                {normalizeCF(form.codice_fiscale).length === 16 && !cfOk && (
                  <p className="text-sm text-red-500 mt-1">
                    Codice fiscale non valido
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="nazionalita">Nazionalità</Label>
                <Input
                  id="nazionalita"
                  value={form.nazionalita}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nazionalita: e.target.value }))
                  }
                  placeholder="Italiana"
                />
              </div>

              <div>
                <Label htmlFor="luogo_nascita">Luogo nascita</Label>
                <Input
                  id="luogo_nascita"
                  value={form.luogo_nascita}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, luogo_nascita: e.target.value }))
                  }
                  placeholder="Roma"
                />
              </div>

              <div>
                <Label htmlFor="data_nascita">Data nascita</Label>
                <Input
                  id="data_nascita"
                  type="date"
                  value={form.data_nascita}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, data_nascita: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="citta_residenz">Città residenza</Label>
                <Input
                  id="citta_residenz"
                  value={form.citta_residenz}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, citta_residenz: e.target.value }))
                  }
                  placeholder="Milano"
                />
              </div>

              <div>
                <Label htmlFor="indirizzo_resid">Indirizzo residenza</Label>
                <Input
                  id="indirizzo_resid"
                  value={form.indirizzo_resid}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, indirizzo_resid: e.target.value }))
                  }
                  placeholder="Via Roma 10"
                />
              </div>

              <div>
                <Label htmlFor="tipo_doc">Tipo documento</Label>
                <Select
                  value={form.tipo_doc || undefined}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, tipo_doc: v as any }))
                  }
                >
                  <SelectTrigger id="tipo_doc">
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Carta di identità">
                      Carta di identità
                    </SelectItem>
                    <SelectItem value="Passaporto">Passaporto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="scadenza_doc">Scadenza documento</Label>
                <Input
                  id="scadenza_doc"
                  type="date"
                  value={form.scadenza_doc}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, scadenza_doc: e.target.value }))
                  }
                />
              </div>

              {/* Allegato */}
              <div className="md:col-span-2">
                <Label htmlFor="allegato_doc">Allegato documento</Label>

                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadDoc(f);
                    e.currentTarget.value = "";
                  }}
                />

                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                  <Input
                    id="allegato_doc"
                    type="text"
                    value={form.allegato_doc ? "Documento allegato" : ""}
                    readOnly
                    placeholder="Nessun documento allegato"
                    className="cursor-default"
                  />

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploading ? "Caricamento..." : "Allega documento"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={!form.allegato_doc}
                      onClick={() => window.open(form.allegato_doc, "_blank")}
                    >
                      Apri
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      disabled={!form.allegato_doc || uploading}
                      onClick={handleRemoveDoc}
                    >
                      Rimuovi
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {!!okMsg && <p className="text-sm text-green-600">{okMsg}</p>}
            {!!errMsg && <p className="text-sm text-red-600">{errMsg}</p>}

            {/* Debug (rimuovi quando ok) */}
            <p className="text-xs text-muted-foreground">
              Debug studio_id: {studioId || "-"} | Bucket: {BUCKET_NAME}
            </p>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading || !canSave}>
                {loading ? "Salvataggio..." : "Salva dati"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setForm({
                    nome_cognom: "",
                    codice_fiscale: "",
                    luogo_nascita: "",
                    data_nascita: "",
                    citta_residenz: "",
                    indirizzo_resid: "",
                    nazionalita: "",
                    tipo_doc: "",
                    scadenza_doc: "",
                    allegato_doc: "",
                  })
                }
              >
                Pulisci
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

