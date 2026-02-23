import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import { supabase } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

import { useStudio } from "@/contexts/StudioContext"; // <-- esiste nel tuo progetto (lo avevi già nei Clienti)

// -----------------------
// Codice Fiscale validator (formale + controllo)
// Supporta omocodia (parzialmente) e verifica checksum.
// -----------------------
const CF_RE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

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

function isValidCFFormat(cf: string) {
  return CF_RE.test(cf);
}

function cfToDigitsForChecksum(cf: string) {
  // per checksum, converti i caratteri omocodia nelle posizioni numeriche (7-8, 10-11, 13-15)
  const chars = cf.split("");
  const idxs = [6, 7, 9, 10, 12, 13, 14]; // 0-based
  for (const i of idxs) {
    const c = chars[i];
    if (OMO_MAP[c]) chars[i] = OMO_MAP[c];
  }
  return chars.join("");
}

const ODD_MAP: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const EVEN_MAP: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
  U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

function computeCFCheckChar(cf15: string) {
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const c = cf15[i];
    const isOddPosition = (i + 1) % 2 === 1; // posizioni 1..15
    sum += isOddPosition ? ODD_MAP[c] : EVEN_MAP[c];
  }
  const r = sum % 26;
  return String.fromCharCode("A".charCodeAt(0) + r);
}

function isValidCF(cfRaw: string) {
  const cf = normalizeCF(cfRaw);
  if (!isValidCFFormat(cf)) return false;
  const cfNorm = cfToDigitsForChecksum(cf);
  const expected = computeCFCheckChar(cfNorm.substring(0, 15));
  return expected === cfNorm[15];
}

// -----------------------
// Page
// -----------------------
type FormState = {
  nome_cognome: string;
  codice_fiscale: string;
  luogo_nascita: string;
  data_nascita: string; // yyyy-mm-dd
  citta_residenza: string;
  indirizzo_residenza: string;
  nazionalita: string;
  carica: string;
  tipo_doc: "" | "Carta di identità" | "Passaporto";
  scadenza_doc: string; // yyyy-mm-dd
  allegato_doc: string; // path in storage
};

export default function NuovoRappLegalePage() {
  const router = useRouter();
  const { studioId } = useStudio() as any; // nel tuo progetto dovrebbe esserci (adatta se il nome è diverso)

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState<FormState>({
    nome_cognome: "",
    codice_fiscale: "",
    luogo_nascita: "",
    data_nascita: "",
    citta_residenza: "",
    indirizzo_residenza: "",
    nazionalita: "",
    carica: "",
    tipo_doc: "",
    scadenza_doc: "",
    allegato_doc: "",
  });

  const cf = useMemo(() => normalizeCF(form.codice_fiscale), [form.codice_fiscale]);
  const cfOk = useMemo(() => (cf.length === 16 ? isValidCF(cf) : true), [cf]);

  useEffect(() => {
    // Se studioId manca, il form può comunque renderizzare, ma l’insert fallirà.
    // (Così non blocchiamo il rendering)
  }, [studioId]);

  async function handleUploadDoc(file: File) {
    setUploading(true);
    try {
      // Bucket consigliato: "documenti"
      // Path consigliata: rapp_legali/<studio_id>/<timestamp>_<filename>
      const safeName = file.name.replace(/\s+/g, "_");
      const path = `rapp_legali/${studioId || "no_studio"}/${Date.now()}_${safeName}`;

      const { error } = await supabase.storage
        .from("documenti")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      setForm((p) => ({ ...p, allegato_doc: path }));
      toast({ title: "Documento caricato", description: "Allegato associato correttamente." });
    } catch (e: any) {
      toast({ title: "Errore upload", description: e?.message ?? "Upload non riuscito", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleOpenDoc() {
    if (!form.allegato_doc) return;

    // Se bucket privato: Signed URL (consigliato).
    // Se bucket pubblico: getPublicUrl.
    const { data, error } = await supabase.storage
      .from("documenti")
      .createSignedUrl(form.allegato_doc, 60 * 10); // 10 minuti

    if (error) {
      toast({ title: "Errore apertura", description: error.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nomeOk = form.nome_cognome.trim().length > 0;
    const studioOk = !!studioId;
    const cfIsValid = isValidCF(normalizeCF(form.codice_fiscale));

    if (!studioOk) {
      toast({
        title: "Studio non disponibile",
        description: "Non riesco a leggere studio_id dall’utente loggato.",
        variant: "destructive",
      });
      return;
    }

    if (!nomeOk) {
      toast({ title: "Campo obbligatorio", description: "Inserisci Nome e Cognome.", variant: "destructive" });
      return;
    }

    if (!cfIsValid) {
      toast({
        title: "Codice Fiscale non valido",
        description: "Controlla il formato o il carattere di controllo.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        studio_id: studioId,
        nome_cognome: form.nome_cognome.trim(),
        codice_fiscale: normalizeCF(form.codice_fiscale),
        luogo_nascita: form.luogo_nascita.trim() || null,
        data_nascita: form.data_nascita || null,
        citta_residenza: form.citta_residenza.trim() || null,
        indirizzo_residenza: form.indirizzo_residenza.trim() || null,
        nazionalita: form.nazionalita.trim() || null,
        carica: form.carica.trim() || null,
        tipo_doc: form.tipo_doc || null,
        scadenza_doc: form.scadenza_doc || null,
        allegato_doc: form.allegato_doc || null,
      };

      const { error } = await supabase.from("rapp_legali").insert(payload);
      if (error) throw error;

      toast({ title: "Salvato", description: "Rappresentante legale inserito correttamente." });
      router.push("/rapp-legali"); // creeremo (o collegherai) la pagina elenco
    } catch (e: any) {
      // caso tipico: CF univoco già presente -> error code 23505
      const msg = e?.message ?? "Errore inserimento";
      toast({ title: "Errore", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nuovo Rappresentante Legale</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="nome_cognome">Nome e Cognome *</Label>
                <Input
                  id="nome_cognome"
                  value={form.nome_cognome}
                  onChange={(e) => setForm((p) => ({ ...p, nome_cognome: e.target.value }))}
                  placeholder="Mario Rossi"
                />
              </div>

              <div>
                <Label htmlFor="codice_fiscale">Codice Fiscale *</Label>
                <Input
                  id="codice_fiscale"
                  value={form.codice_fiscale}
                  onChange={(e) => setForm((p) => ({ ...p, codice_fiscale: e.target.value }))}
                  placeholder="RSSMRA80A01H501U"
                  maxLength={16}
                />
                {normalizeCF(form.codice_fiscale).length === 16 && !cfOk && (
                  <p className="text-sm text-red-500 mt-1">Codice fiscale non valido</p>
                )}
              </div>

              <div>
                <Label htmlFor="nazionalita">Nazionalità</Label>
                <Input
                  id="nazionalita"
                  value={form.nazionalita}
                  onChange={(e) => setForm((p) => ({ ...p, nazionalita: e.target.value }))}
                  placeholder="Italiana"
                />
              </div>

              <div>
                <Label htmlFor="luogo_nascita">Luogo nascita</Label>
                <Input
                  id="luogo_nascita"
                  value={form.luogo_nascita}
                  onChange={(e) => setForm((p) => ({ ...p, luogo_nascita: e.target.value }))}
                  placeholder="Roma"
                />
              </div>

              <div>
                <Label htmlFor="data_nascita">Data nascita</Label>
                <Input
                  id="data_nascita"
                  type="date"
                  value={form.data_nascita}
                  onChange={(e) => setForm((p) => ({ ...p, data_nascita: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="citta_residenza">Città residenza</Label>
                <Input
                  id="citta_residenza"
                  value={form.citta_residenza}
                  onChange={(e) => setForm((p) => ({ ...p, citta_residenza: e.target.value }))}
                  placeholder="Milano"
                />
              </div>

              <div>
                <Label htmlFor="indirizzo_residenza">Indirizzo residenza</Label>
                <Input
                  id="indirizzo_residenza"
                  value={form.indirizzo_residenza}
                  onChange={(e) => setForm((p) => ({ ...p, indirizzo_residenza: e.target.value }))}
                  placeholder="Via Roma 10"
                />
              </div>

              <div>
                <Label htmlFor="carica">Carica</Label>
                <Input
                  id="carica"
                  value={form.carica}
                  onChange={(e) => setForm((p) => ({ ...p, carica: e.target.value }))}
                  placeholder="Amministratore Unico"
                />
              </div>

              <div>
                <Label htmlFor="tipo_doc">Tipo documento</Label>
                <Select
                  value={form.tipo_doc || undefined}
                  onValueChange={(v) => setForm((p) => ({ ...p, tipo_doc: v as any }))}
                >
                  <SelectTrigger id="tipo_doc">
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Carta di identità">Carta di identità</SelectItem>
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
                  onChange={(e) => setForm((p) => ({ ...p, scadenza_doc: e.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <Label>Allegato documento</Label>
                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={uploading || !studioId}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadDoc(f);
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!form.allegato_doc}
                      onClick={handleOpenDoc}
                    >
                      Apri documento
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!form.allegato_doc}
                      onClick={() => setForm((p) => ({ ...p, allegato_doc: "" }))}
                    >
                      Rimuovi
                    </Button>
                  </div>
                </div>
                {form.allegato_doc && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Path salvata: <span className="font-mono">{form.allegato_doc}</span>
                  </p>
                )}
                {!studioId && (
                  <p className="text-sm text-red-500 mt-1">
                    studio_id non disponibile: non posso caricare file né salvare il record.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading || uploading}>
                {loading ? "Salvataggio..." : "Salva"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push("/rapp-legali")}>
                Annulla
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
