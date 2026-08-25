import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, ExternalLink, RefreshCw, ShieldCheck, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SubscriptionData = {
  studio: {
    software_attivo: boolean | null;
    stato_abbonamento: string | null;
    data_scadenza_abbonamento: string | null;
    licenze_bypass: boolean | null;
  };
  licenza: {
    piano: string | null;
    stato: string | null;
    canone_mensile: number;
    importo_annuale: number;
    rinnovo_automatico: boolean;
    giorni_preavviso_disdetta: number;
    data_attivazione: string | null;
    data_scadenza: string | null;
    data_ultimo_pagamento: string | null;
    data_prossimo_pagamento: string | null;
    stripe_status: string | null;
    stripe_cancel_at_period_end: boolean;
    ha_customer_stripe: boolean;
    ha_subscription_stripe: boolean;
  } | null;
  metodo_pagamento: {
    brand: string;
    last4: string;
    exp_month: number | null;
    exp_year: number | null;
  } | null;
};

const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}`.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("it-IT");
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    active: "Attivo",
    trialing: "Attivo",
    attivo: "Attivo",
    past_due: "Pagamento insoluto",
    unpaid: "Non pagato",
    incomplete: "Pagamento incompleto",
    incomplete_expired: "Pagamento scaduto",
    canceled: "Annullato",
    paused: "Sospeso",
    sospeso: "Sospeso",
    scaduto: "Scaduto",
    in_scadenza: "In scadenza",
  };
  return status ? labels[status] || status : "Non disponibile";
}

export default function AbbonamentoPagamentiCard() {
  const { toast } = useToast();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const authHeaders = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Sessione non disponibile");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await authHeaders();
      const response = await fetch("/api/studio/abbonamento", { headers });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Impossibile caricare l'abbonamento");
      setData(json);
    } catch (error: any) {
      console.error("Errore caricamento abbonamento:", error);
      toast({ title: "Errore", description: error?.message || "Impossibile caricare l'abbonamento", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [authHeaders, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPortal = async () => {
    try {
      setOpeningPortal(true);
      const headers = await authHeaders();
      const response = await fetch("/api/studio/gestione-pagamenti", { method: "POST", headers });
      const json = await response.json();
      if (!response.ok || !json.url) throw new Error(json.error || "Impossibile aprire la gestione pagamenti");
      window.location.assign(json.url);
    } catch (error: any) {
      toast({ title: "Errore", description: error?.message || "Impossibile aprire la gestione pagamenti", variant: "destructive" });
      setOpeningPortal(false);
    }
  };

  const reactivateSubscription = async () => {
    try {
      setReactivating(true);
      const headers = await authHeaders();
      const response = await fetch("/api/studio/riattiva-abbonamento", { method: "POST", headers });
      const json = await response.json();
      if (!response.ok || !json.url) throw new Error(json.error || "Impossibile avviare la riattivazione");
      window.location.assign(json.url);
    } catch (error: any) {
      toast({ title: "Errore", description: error?.message || "Impossibile riattivare l'abbonamento", variant: "destructive" });
      setReactivating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Abbonamento e pagamenti</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Caricamento dati abbonamento...</CardContent>
      </Card>
    );
  }

  if (!data?.licenza) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Abbonamento e pagamenti</CardTitle></CardHeader>
        <CardContent><Alert><AlertDescription>Nessun abbonamento associato a questo studio.</AlertDescription></Alert></CardContent>
      </Card>
    );
  }

  const { licenza, metodo_pagamento: paymentMethod } = data;
  const stripeStatus = String(licenza.stripe_status || data.studio.stato_abbonamento || "").toLowerCase();
  const recoverablePaymentStatuses = ["past_due", "incomplete"];
  const terminatedStatuses = ["canceled", "unpaid", "incomplete_expired", "paused", "sospeso", "scaduto"];
  const isPaymentProblem = recoverablePaymentStatuses.includes(stripeStatus);
  const isTerminated = terminatedStatuses.includes(stripeStatus) || licenza.stato === "sospeso";
  const isProblem = isPaymentProblem || isTerminated;
  const isCancelScheduled = licenza.stripe_cancel_at_period_end || !licenza.rinnovo_automatico;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Abbonamento e pagamenti</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Gestione del piano Studio Manager Pro e della modalità di pagamento.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Aggiorna</Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {isPaymentProblem && (
          <Alert variant="destructive">
            <AlertDescription>
              Il pagamento dell'abbonamento non è andato a buon fine. Aggiorna la modalità di pagamento in Stripe; dopo il pagamento riuscito Studio Manager Pro verrà riallineato automaticamente.
            </AlertDescription>
          </Alert>
        )}

        {isTerminated && (
          <Alert variant="destructive">
            <AlertDescription>
              L'abbonamento Stripe è terminato o sospeso. Per riattivare il servizio è necessario creare una nuova sottoscrizione sullo stesso studio.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <div><p className="text-xs font-medium uppercase text-muted-foreground">Piano</p><p className="mt-1 font-semibold">{licenza.piano || "—"}</p></div>
          <div><p className="text-xs font-medium uppercase text-muted-foreground">Stato</p><div className="mt-1"><Badge variant={isProblem ? "destructive" : "default"}>{statusLabel(stripeStatus)}</Badge></div></div>
          <div><p className="text-xs font-medium uppercase text-muted-foreground">Canone mensile</p><p className="mt-1 font-semibold">{money.format(licenza.canone_mensile || 0)}</p></div>
          <div><p className="text-xs font-medium uppercase text-muted-foreground">Prossimo addebito</p><p className="mt-1 font-semibold">{formatDate(licenza.data_prossimo_pagamento)}</p></div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="font-medium">Modalità di pagamento</p>
              {paymentMethod ? (
                <p className="mt-1 text-sm text-muted-foreground">{paymentMethod.brand.toUpperCase()} •••• {paymentMethod.last4}{paymentMethod.exp_month && paymentMethod.exp_year ? ` · scadenza ${String(paymentMethod.exp_month).padStart(2, "0")}/${paymentMethod.exp_year}` : ""}</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Nessun dettaglio carta disponibile. I dati completi della carta non vengono memorizzati in Studio Manager Pro.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {licenza.ha_customer_stripe && !isTerminated && (
                <Button onClick={openPortal} disabled={openingPortal || reactivating}>
                  {openingPortal ? "Apertura..." : isPaymentProblem ? "Aggiorna carta e recupera pagamento" : "Gestisci metodo di pagamento"}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              )}

              {isTerminated && licenza.ha_customer_stripe && licenza.ha_subscription_stripe && (
                <Button onClick={reactivateSubscription} disabled={reactivating || openingPortal}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {reactivating ? "Apertura Stripe..." : "Riattiva abbonamento"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-4 text-sm">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Rinnovo dell'abbonamento</p>
              <p className="text-muted-foreground">
                {isTerminated
                  ? "L'abbonamento non è attualmente attivo. La riattivazione genera una nuova sottoscrizione Stripe collegata allo stesso studio."
                  : isCancelScheduled
                    ? `Il rinnovo automatico risulta disattivato. L'abbonamento resta utilizzabile fino alla scadenza prevista (${formatDate(data.studio.data_scadenza_abbonamento || licenza.data_scadenza)}).`
                    : `Il rinnovo è automatico. La richiesta di recesso deve pervenire almeno ${licenza.giorni_preavviso_disdetta || 30} giorni prima della scadenza/rata successiva prevista.`}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
