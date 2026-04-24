import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getStudioId } from "@/services/getStudioId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormDataType = {
  Denominazione: string;
  codice_fiscale: string;
};

function validateCodiceFiscaleGiuridico(value: string): boolean {
  const cf = (value || "").replace(/\s+/g, "");

  if (!/^\d{11}$/.test(cf)) return false;

  let sum = 0;

  for (let i = 0; i < 11; i++) {
    let n = parseInt(cf.charAt(i), 10);

    if (Number.isNaN(n)) return false;

    if (i % 2 === 0) {
      n = n;
    } else {
      n = n * 2;
      if (n > 9) n -= 9;
    }

    sum += n;
  }

  return sum % 10 === 0;
}

export default function NuovaSocietaRespAVPage() {
  const router = useRouter();
  const { id } = router.query;

  const isEdit = typeof id === "string" && id.length > 0;

  const [formData, setFormData] = useState<FormDataType>({
    Denominazione: "",
    codice_fiscale: "",
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [antiriciclaggioEnabled, setAntiriciclaggioEnabled] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordConfigured, setPasswordConfigured] = useState(false);

  const passwordLockedForNormalEdit =
    isEdit && antiriciclaggioEnabled && passwordConfigured;

  const updateField = <K extends keyof FormDataType>(
    field: K,
    value: FormDataType[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const loadRecord = async (recordId: string) => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient() as any;

      const { data, error } = await supabase
        .from("tbRespAVSocieta")
        .select(
          "id, Denominazione, codice_fiscale, antiriciclaggio_enabled, antiriciclaggio_password_hash"
        )
        .eq("id", recordId)
        .single();

      if (error) throw new Error(error.message);
      if (!data) return;

      setFormData({
        Denominazione: data.Denominazione || "",
        codice_fiscale: data.codice_fiscale || "",
      });

      setAntiriciclaggioEnabled(!!data.antiriciclaggio_enabled);
      setPasswordConfigured(!!data.antiriciclaggio_password_hash);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err?.message || "Errore caricamento società.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!router.isReady) return;
    if (!isEdit) return;

    void loadRecord(id as string);
  }, [router.isReady, isEdit, id]);

  const checkDuplicate = async (
    studioId: string,
    codiceFiscale: string,
    currentId?: string
  ) => {
    const supabase = getSupabaseClient() as any;

    let query = supabase
      .from("tbRespAVSocieta")
      .select("id")
      .eq("studio_id", studioId)
      .eq("codice_fiscale", codiceFiscale);

    if (currentId) {
      query = query.neq("id", currentId);
    }

    const { data, error } = await query.limit(1);

    if (error) throw new Error(error.message);

    return Array.isArray(data) && data.length > 0;
  };

    const checkTenantSocietaLimit = async (studioId: string) => {
  const supabase = getSupabaseClient() as any;

  const { data: studioRow, error: studioError } = await supabase
    .from("tbstudio")
    .select("ragione_sociale_tenant2")
    .eq("id", studioId)
    .single();

  if (studioError) throw new Error(studioError.message);

  const tenant2Attivo =
    typeof studioRow?.ragione_sociale_tenant2 === "string" &&
    studioRow.ragione_sociale_tenant2.trim() !== "";

  const maxSocieta = tenant2Attivo ? 2 : 1;

  const { count, error: countError } = await supabase
    .from("tbRespAVSocieta")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId);

  if (countError) throw new Error(countError.message);

  return {
    maxSocieta,
    societaEsistenti: count || 0,
    limiteRaggiunto: (count || 0) >= maxSocieta,
  };
};

  const savePasswordSettings = async (societaId: string) => {
    const trimmedPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (antiriciclaggioEnabled) {
      if (!isEdit && !trimmedPassword) {
        throw new Error(
          "Per abilitare la protezione antiriciclaggio devi inserire una password."
        );
      }

      if (!isEdit && !trimmedConfirmPassword) {
        throw new Error("Conferma la password antiriciclaggio.");
      }

      if (!passwordLockedForNormalEdit && (trimmedPassword || trimmedConfirmPassword)) {
        if (!trimmedPassword || !trimmedConfirmPassword) {
          throw new Error("Compila sia la password sia la conferma password.");
        }

        if (trimmedPassword.length < 6) {
          throw new Error(
            "La password antiriciclaggio deve contenere almeno 6 caratteri."
          );
        }

        if (trimmedPassword !== trimmedConfirmPassword) {
          throw new Error("Le password non coincidono.");
        }
      }

      if (isEdit && !passwordConfigured && !trimmedPassword) {
        throw new Error(
          "La protezione è attiva ma non risulta ancora impostata una password. Inserisci una nuova password."
        );
      }

      if (passwordLockedForNormalEdit && (trimmedPassword || trimmedConfirmPassword)) {
        throw new Error(
          "La password già configurata non può essere modificata da questa schermata. Solo l’amministratore di sistema può eseguire il reset."
        );
      }
    }

    const response = await fetch("/api/antiriciclaggio/set-societa-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        societaId,
        enabled: antiriciclaggioEnabled,
        password:
          passwordLockedForNormalEdit ? undefined : trimmedPassword || undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error || "Errore durante il salvataggio della password."
      );
    }
  };

  const handleSave = async () => {
    setError(null);

    try {
      const studioId = await getStudioId();

      if (!studioId) {
        alert("Studio non disponibile.");
        return;
      }

      const denominazione = formData.Denominazione.trim();
      const codiceFiscale = formData.codice_fiscale.replace(/\s+/g, "");

      if (!denominazione) {
        alert("Inserisci la denominazione.");
        return;
      }

      if (!codiceFiscale) {
        alert("Inserisci il codice fiscale.");
        return;
      }

      if (!validateCodiceFiscaleGiuridico(codiceFiscale)) {
        alert("Il codice fiscale della società non è valido.");
        return;
      }

    setSaving(true);

if (!isEdit) {
  const tenantLimit = await checkTenantSocietaLimit(studioId);

  if (tenantLimit.limiteRaggiunto) {
    alert(
      `Limite società responsabili raggiunto: puoi creare massimo ${tenantLimit.maxSocieta} società per i tenant attivi.`
    );
    return;
  }
}

const duplicate = await checkDuplicate(
  studioId,
  codiceFiscale,
  isEdit ? (id as string) : undefined
);

      if (duplicate) {
        alert("Esiste già una società con questo codice fiscale.");
        return;
      }

      const supabase = getSupabaseClient() as any;

      const payload = {
        studio_id: studioId,
        Denominazione: denominazione,
        codice_fiscale: codiceFiscale,
      };

      let societaId = "";

      if (isEdit) {
        const { error } = await supabase
          .from("tbRespAVSocieta")
          .update(payload)
          .eq("id", id);

        if (error) throw new Error(error.message);

        societaId = id as string;
      } else {
        const { data, error } = await supabase
          .from("tbRespAVSocieta")
          .insert([payload])
          .select("id")
          .single();

        if (error) throw new Error(error.message);
        if (!data?.id) throw new Error("ID società non restituito.");

        societaId = data.id;
      }

      await savePasswordSettings(societaId);

      await router.push("/antiriciclaggio/responsabili-av-societa");
    } catch (err: any) {
      setError(err?.message || "Errore salvataggio società.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>
              {isEdit ? "Modifica società" : "Nuova società"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Inserimento della società collegata ai responsabili
              dell’adeguata verifica.
            </p>
          </div>

          <Button asChild variant="outline">
            <Link href="/antiriciclaggio/responsabili-av-societa">
              Torna all’elenco
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="space-y-5">
          {loading ? (
            <p>Caricamento...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">
                    Denominazione
                  </label>
                  <Input
                    type="text"
                    value={formData.Denominazione}
                    onChange={(e) =>
                      updateField("Denominazione", e.target.value)
                    }
                    placeholder="Es. Studio Rossi SRL"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Codice fiscale
                  </label>
                  <Input
                    type="text"
                    maxLength={11}
                    value={formData.codice_fiscale}
                    onChange={(e) =>
                      updateField(
                        "codice_fiscale",
                        e.target.value.replace(/\D/g, "")
                      )
                    }
                    placeholder="Codice fiscale società"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <input
                    id="antiriciclaggio_enabled"
                    type="checkbox"
                    checked={antiriciclaggioEnabled}
                    onChange={(e) =>
                      setAntiriciclaggioEnabled(e.target.checked)
                    }
                    className="mt-1 h-4 w-4"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="antiriciclaggio_enabled"
                      className="block text-sm font-medium"
                    >
                      Proteggi accesso antiriciclaggio con password
                    </label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Se attivato, per accedere alle pratiche della società
                      selezionata sarà richiesta una password.
                    </p>
                  </div>
                </div>

                {antiriciclaggioEnabled && (
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        {isEdit ? "Nuova password" : "Password"}
                      </label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={
                          isEdit
                            ? passwordLockedForNormalEdit
                              ? "Password gestita solo da amministratore"
                              : "Lascia vuoto per non cambiarla"
                            : "Inserisci password"
                        }
                        disabled={passwordLockedForNormalEdit}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Minimo 6 caratteri.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        {isEdit ? "Conferma nuova password" : "Conferma password"}
                      </label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={
                          isEdit
                            ? passwordLockedForNormalEdit
                              ? "Reset disponibile solo ad amministratore"
                              : "Ripeti la nuova password"
                            : "Conferma password"
                        }
                        disabled={passwordLockedForNormalEdit}
                      />
                    </div>

                    {isEdit && (
                      <div className="md:col-span-2">
                        <p className="text-xs text-muted-foreground">
                          {passwordConfigured
                            ? "Password già configurata."
                            : "Nessuna password ancora configurata. Inseriscine una per attivare la protezione."}
                        </p>

                        {passwordLockedForNormalEdit && (
                          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            La password già configurata non è modificabile dagli utenti normali da questa schermata. Il cambio password deve avvenire solo tramite reset eseguito dall’amministratore di sistema.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

             {passwordLockedForNormalEdit && (
  <div className="mt-3 flex justify-end">
    <Button
      type="button"
      variant="destructive"
      onClick={async () => {
        const nuova = prompt("Inserisci nuova password:");

        if (!nuova || nuova.length < 6) {
          alert("Password non valida (minimo 6 caratteri)");
          return;
        }

        try {
          const res = await fetch("/api/antiriciclaggio/set-societa-password", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              societaId: id,
              enabled: true,
              password: nuova,
            }),
          });

          const data = await res.json();

          if (!res.ok || !data?.ok) {
            throw new Error(data?.error || "Errore reset password");
          }

          alert("Password aggiornata correttamente");
        } catch (err: any) {
          alert(err.message);
        }
      }}
    >
      Reset password (admin)
    </Button>
  </div>
)} 

              {error && (
                <p className="text-sm text-red-600">
                  Errore: {error}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button asChild type="button" variant="outline">
                  <Link href="/antiriciclaggio/responsabili-av-societa">
                    Annulla
                  </Link>
                </Button>

                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Salvataggio..." : "Salva"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
