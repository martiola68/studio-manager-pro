import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { clienteService } from "@/services/clienteService";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Cliente = Database["public"]["Tables"]["tbclienti"]["Row"];
type ClienteInsert = Database["public"]["Tables"]["tbclienti"]["Insert"];

interface ClienteFormProps {
  clienteToEdit?: Cliente | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ClienteForm({ clienteToEdit, onSuccess, onCancel }: ClienteFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<ClienteInsert>>({
    ragione_sociale: "",
    codice_fiscale: "",
    partita_iva: "",
    email: "",
    indirizzo: "",
    citta: "",
    cap: "",
    provincia: "",
    attivo: true
  });

  useEffect(() => {
    if (clienteToEdit) {
      setFormData({
        ragione_sociale: clienteToEdit.ragione_sociale || "",
        codice_fiscale: clienteToEdit.codice_fiscale || "",
        partita_iva: clienteToEdit.partita_iva || "",
        email: clienteToEdit.email || "",
        indirizzo: clienteToEdit.indirizzo || "",
        citta: clienteToEdit.citta || "",
        cap: clienteToEdit.cap || "",
        provincia: clienteToEdit.provincia || "",
        attivo: clienteToEdit.attivo
      });
    }
  }, [clienteToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, attivo: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.ragione_sociale) {
        throw new Error("La ragione sociale è obbligatoria");
      }

      if (clienteToEdit) {
        await clienteService.updateCliente(clienteToEdit.id, formData);
        toast({
          title: "Cliente aggiornato",
          description: "I dati del cliente sono stati salvati correttamente.",
        });
      } else {
        await clienteService.createCliente(formData as ClienteInsert);
        toast({
          title: "Cliente creato",
          description: "Il nuovo cliente è stato aggiunto al database.",
        });
      }
      onSuccess();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: error instanceof Error ? error.message : "Si è verificato un errore durante il salvataggio.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ragione_sociale">Ragione Sociale *</Label>
          <Input
            id="ragione_sociale"
            name="ragione_sociale"
            value={formData.ragione_sociale || ""}
            onChange={handleChange}
            required
            placeholder="Es. Rossi Mario SRL"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email || ""}
            onChange={handleChange}
            placeholder="email@esempio.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="partita_iva">Partita IVA</Label>
          <Input
            id="partita_iva"
            name="partita_iva"
            value={formData.partita_iva || ""}
            onChange={handleChange}
            placeholder="12345678901"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="codice_fiscale">Codice Fiscale</Label>
          <Input
            id="codice_fiscale"
            name="codice_fiscale"
            value={formData.codice_fiscale || ""}
            onChange={handleChange}
            placeholder="RSSMRA80A01H501Z"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="indirizzo">Indirizzo</Label>
          <Input
            id="indirizzo"
            name="indirizzo"
            value={formData.indirizzo || ""}
            onChange={handleChange}
            placeholder="Via Roma 1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="citta">Città</Label>
          <Input
            id="citta"
            name="citta"
            value={formData.citta || ""}
            onChange={handleChange}
            placeholder="Roma"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cap">CAP</Label>
            <Input
              id="cap"
              name="cap"
              value={formData.cap || ""}
              onChange={handleChange}
              placeholder="00100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="provincia">Provincia</Label>
            <Input
              id="provincia"
              name="provincia"
              value={formData.provincia || ""}
              onChange={handleChange}
              placeholder="RM"
              maxLength={2}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2 py-2">
        <Switch
          id="attivo"
          checked={formData.attivo}
          onCheckedChange={handleSwitchChange}
        />
        <Label htmlFor="attivo">Cliente Attivo</Label>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Annulla
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Salvataggio..." : (clienteToEdit ? "Aggiorna Cliente" : "Crea Cliente")}
        </Button>
      </div>
    </form>
  );
}