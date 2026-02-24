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

import { useStudio } from "@/contexts/StudioContext";

/* =========================
   CODICE FISCALE VALIDATOR
   ========================= */
const CF_RE =
  /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

const OMO_MAP: Record<string, string> = {
  L: "0", M: "1", N: "2", P: "3", Q: "4",
  R: "5", S: "6", T: "7", U: "8", V: "9",
};

function normalizeCF(cf: string) {
  return (cf || "").trim().toUpperCase();
}

function cfToDigitsForChecksum(cf: string) {
  const chars = cf.split("");
  [6, 7, 9, 10, 12, 13, 14].forEach((i) => {
    if (OMO_MAP[chars[i]]) chars[i] = OMO_MAP[chars[i]];
  });
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
    sum += (i + 1) % 2 ? ODD_MAP[cf15[i]] : EVEN_MAP[cf15[i]];
  }
  return String.fromCharCode("A".charCodeAt(0) + (sum % 26));
}

function isValidCF(cfRaw: string) {
  const cf = normalizeCF(cfRaw);
  if (!CF_RE.test(cf)) return false;
  const norm = cfToDigitsForChecksum(cf);
  return computeCFCheckChar(norm.slice(0, 15)) === norm[15];
}

/* =========================
   TYPES
   ========================= */
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
  allegato_doc: string;
};

export default function RappresentantiPage() {
  const router = useRouter();
  const { studioId } = useStudio() as any;

  const [studioIdLS, setStudioIdLS] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  /* =========================
     STUDIO ID – ROBUSTO
     ========================= */

  // 1) localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setStudioIdLS(localStorage.getItem("studio_id") || "");
    }
  }, []);

  // 2) fallback da utente loggato
  useEffect(() => {
    const loadFromUser = async () => {
      if (studioId || studioIdLS) return;

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) return;

      // ⚠️ CAMBIA QUI SE LA TUA TABELLA È DIVERSA
      const { data } = await supabase
        .from("profiles")
        .select("studio_id")
        .eq("id", userId)
        .single();

      if (data?.studio_id) {
        setStudioIdLS(String(data.studio_id));
        localStorage.setItem("studio_id", String(data.studio_id));
      }
    };

    loadFromUser();
  }, [studioId, studioIdLS]);

  const studioIdEffettivo = (studioId as string) || studioIdLS;

  /* =========================
     FORM
     ========================= */
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

  const cf = useMemo(() => normalizeCF(form.codice_fiscale), [form.codice_fiscale]);
  const cfOk = useMemo(() => (cf.length === 16 ? isValidCF(cf) : false), [cf]);

  const canSave = !!studioIdEffettivo && form.nome_cognom && cfOk;

  /* =========================
     UPLOAD DOCUMENTO
     ========================= */
  async function handleUploadDoc(file: File) {
    if (!studioIdEffettivo) {
      setErrMsg("studio_id non disponibile");
      return;
    }

    setUploading(true);
    setErrMsg(null);

    try {
      const safe = file.name.replace(/\s+/g, "_");
      const path = `rapp_legali/${studioIdEffettivo}/${Date.now()}_${safe}`;

      const { error } = await supabase.storage
        .from("documenti")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage.from("documenti").getPublicUrl(path);
      setForm((p) => ({ ...p, allegato_doc: data.publicUrl }));
      setOkMsg("Documento allegato");
    } catch (e: any) {
      setErrMsg(e.message);
    } finally {
      setUploading(false);
    }
  }

  /* =========================
     SUBMIT
     ========================= */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    setLoading(true);
    setErrMsg(null);

    try {
      await supabase.from("rapp_legali").insert({
        studio_id: studioIdEffettivo,
        nome_cognom: form.nome_cognom,
        codice_fiscale: cf,
        luogo_nascita: form.luogo_nascita || null,
        data_nascita: form.data_nascita || null,
        citta_residenz: form.citta_residenz || null,
        indirizzo_resid: form.indirizzo_resid || null,
        nazionalita: form.nazionalita || null,
        tipo_doc: form.tipo_doc || null,
        scadenza_doc: form.scadenza_doc || null,
        allegato_doc: form.allegato_doc || null,
      });

      setOkMsg("Rappresentante salvato");
    } catch (e: any) {
      setErrMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     JSX
     ========================= */
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anticiclaggio • Rappresentanti</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* campi anagrafici omessi per brevità */}

          {/* ALLEGATO */}
          <Label>Allegato documento</Label>

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

          <div className="flex gap-2">
            <Button
              type="button"
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
          </div>

          {errMsg && <p className="text-red-600">{errMsg}</p>}
          {okMsg && <p className="text-green-600">{okMsg}</p>}

          <Button type="submit" disabled={!canSave || loading}>
            Salva dati
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
