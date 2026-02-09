import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, AlertTriangle, Info, X, CheckCircle, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface ScadenzaAlert {
  id: string;
  tipo: string;
  descrizione: string;
  data_scadenza: string;
  cliente_nome: string;
  urgenza: "critica" | "urgente" | "prossima";
  utente_assegnato?: string;
}

interface AlertScadenzeProps {
  scadenze: ScadenzaAlert[];
  isPartner: boolean;
  onDismiss: (id: string) => void;
  onViewDetails: (id: string, tipo: string) => void;
  onNotifyTeams?: (scadenza: ScadenzaAlert) => void;
}

export function AlertScadenze({ scadenze, isPartner, onDismiss, onViewDetails, onNotifyTeams }: AlertScadenzeProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  const scadenzeCritiche = scadenze.filter(s => s.urgenza === "critica");
  const scadenzeUrgenti = scadenze.filter(s => s.urgenza === "urgente");
  const scadenzeProssime = scadenze.filter(s => s.urgenza === "prossima");

  const getUrgencyIcon = (urgenza: string) => {
    switch (urgenza) {
      case "critica":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "urgente":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getUrgencyBadge = (urgenza: string) => {
    switch (urgenza) {
      case "critica":
        return <Badge variant="destructive" className="text-xs">OGGI</Badge>;
      case "urgente":
        return <Badge className="bg-yellow-500 text-white text-xs">7 GIORNI</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">30 GIORNI</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy", { locale: it });
    } catch {
      return dateString;
    }
  };

  if (scadenze.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <p className="text-sm font-medium">Nessuna scadenza urgente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Scadenze in Arrivo
            {isPartner && (
              <Badge variant="outline" className="text-xs ml-2">
                Vista Totale Studio
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? "Mostra" : "Nascondi"}
          </Button>
        </div>
        
        {!isMinimized && (
          <div className="flex gap-2 mt-2">
            {scadenzeCritiche.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                🔴 {scadenzeCritiche.length} Oggi
              </Badge>
            )}
            {scadenzeUrgenti.length > 0 && (
              <Badge className="bg-yellow-500 text-white text-xs">
                🟡 {scadenzeUrgenti.length} Questa settimana
              </Badge>
            )}
            {scadenzeProssime.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                🔵 {scadenzeProssime.length} Questo mese
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      {!isMinimized && (
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {/* Scadenze Critiche */}
              {scadenzeCritiche.map((scadenza) => (
                <div
                  key={scadenza.id}
                  className="p-3 border border-red-200 bg-red-50 rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {getUrgencyIcon(scadenza.urgenza)}
                        <span className="font-semibold text-sm text-red-900">
                          {scadenza.tipo}
                        </span>
                        {getUrgencyBadge(scadenza.urgenza)}
                      </div>
                      <p className="text-xs text-red-700">
                        {scadenza.descrizione}
                      </p>
                      <p className="text-xs text-red-600 font-medium">
                        Cliente: {scadenza.cliente_nome}
                      </p>
                      <p className="text-xs text-red-500">
                        Scadenza: {formatDate(scadenza.data_scadenza)}
                      </p>
                      {isPartner && scadenza.utente_assegnato && (
                        <p className="text-xs text-red-500">
                          Assegnato a: {scadenza.utente_assegnato}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDismiss(scadenza.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 text-xs"
                      onClick={() => onViewDetails(scadenza.id, scadenza.tipo)}
                    >
                      Visualizza Dettagli
                    </Button>
                    {onNotifyTeams && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-8 px-0 border-red-200 hover:bg-red-100 text-red-700"
                        onClick={() => onNotifyTeams(scadenza)}
                        title="Invia notifica su Teams"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Scadenze Urgenti */}
              {scadenzeUrgenti.map((scadenza) => (
                <div
                  key={scadenza.id}
                  className="p-3 border border-yellow-200 bg-yellow-50 rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {getUrgencyIcon(scadenza.urgenza)}
                        <span className="font-semibold text-sm text-yellow-900">
                          {scadenza.tipo}
                        </span>
                        {getUrgencyBadge(scadenza.urgenza)}
                      </div>
                      <p className="text-xs text-yellow-700">
                        {scadenza.descrizione}
                      </p>
                      <p className="text-xs text-yellow-600 font-medium">
                        Cliente: {scadenza.cliente_nome}
                      </p>
                      <p className="text-xs text-yellow-600">
                        Scadenza: {formatDate(scadenza.data_scadenza)}
                      </p>
                      {isPartner && scadenza.utente_assegnato && (
                        <p className="text-xs text-yellow-600">
                          Assegnato a: {scadenza.utente_assegnato}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDismiss(scadenza.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => onViewDetails(scadenza.id, scadenza.tipo)}
                    >
                      Visualizza Dettagli
                    </Button>
                    {onNotifyTeams && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-8 px-0 border-yellow-200 hover:bg-yellow-100 text-yellow-700"
                        onClick={() => onNotifyTeams(scadenza)}
                        title="Invia notifica su Teams"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Scadenze Prossime */}
              {scadenzeProssime.map((scadenza) => (
                <div
                  key={scadenza.id}
                  className="p-3 border border-blue-200 bg-blue-50 rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {getUrgencyIcon(scadenza.urgenza)}
                        <span className="font-semibold text-sm text-blue-900">
                          {scadenza.tipo}
                        </span>
                        {getUrgencyBadge(scadenza.urgenza)}
                      </div>
                      <p className="text-xs text-blue-700">
                        {scadenza.descrizione}
                      </p>
                      <p className="text-xs text-blue-600 font-medium">
                        Cliente: {scadenza.cliente_nome}
                      </p>
                      <p className="text-xs text-blue-600">
                        Scadenza: {formatDate(scadenza.data_scadenza)}
                      </p>
                      {isPartner && scadenza.utente_assegnato && (
                        <p className="text-xs text-blue-600">
                          Assegnato a: {scadenza.utente_assegnato}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDismiss(scadenza.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => onViewDetails(scadenza.id, scadenza.tipo)}
                  >
                    Visualizza Dettagli
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}