import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2 } from "lucide-react";

type EmailTemplate = {
  id: string;
  codice: string;
  titolo: string;
  categoria: string;
  oggetto: string;
  corpo: string;
  attivo: boolean;
};

const emptyTemplate: Partial<EmailTemplate> = {
  codice: "",
  titolo: "",
  categoria: "",
  oggetto: "",
  corpo: "",
  attivo: true,
};

export default function TemplateEmailPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selected, setSelected] = useState<Partial<EmailTemplate>>(emptyTemplate);

  useEffect(() => {
    void loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);

 const { data, error } = await (supabase as any)
  .from("tbemail_template")
  .select("id, codice, titolo, categoria, oggetto, corpo, attivo")
  .order("categoria", { ascending: true })
  .order("titolo", { ascending: true });

console.log("TEMPLATE EMAIL", data, error);

      if (error) throw error;

      setTemplates((data || []) as EmailTemplate[]);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore caricamento template",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelected(emptyTemplate);
  };

  const saveTemplate = async () => {
    try {
      if (
        !selected.codice ||
        !selected.titolo ||
        !selected.categoria ||
        !selected.oggetto ||
        !selected.corpo
      ) {
        toast({
          title: "Campi obbligatori",
          description: "Compila codice, titolo, categoria, oggetto e corpo.",
          variant: "destructive",
        });
        return;
      }

      setSaving(true);

      const payload = {
        codice: selected.codice.trim(),
        titolo: selected.titolo.trim(),
        categoria: selected.categoria.trim(),
        oggetto: selected.oggetto,
        corpo: selected.corpo,
        attivo: selected.attivo ?? true,
        updated_at: new Date().toISOString(),
      };

      if (selected.id) {
      const { error } = await (supabase as any)
  .from("tbemail_template")
  .update(payload)
  .eq("id", selected.id);

        if (error) throw error;
      } else {
       const { error } = await (supabase as any)
  .from("tbemail_template")
  .insert(payload);

        if (error) throw error;
      }

      toast({ title: "Template salvato" });

      resetForm();
      await loadTemplates();
    } catch (error: any) {
      toast({
        title: "Errore salvataggio",
        description: error.message || "Impossibile salvare il template",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Eliminare definitivamente questo template email?")) return;

    try {
      const { error } = await (supabase as any)
  .from("tbemail_template")
  .delete()
  .eq("id", id);

      if (error) throw error;

      toast({ title: "Template eliminato" });

      resetForm();
      await loadTemplates();
    } catch (error: any) {
      toast({
        title: "Errore eliminazione",
        description: error.message || "Impossibile eliminare il template",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-6">Caricamento...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Template Email</h1>
        <p className="text-gray-500 mt-1">
          Gestione testi email riutilizzabili per scadenze e comunicazioni clienti.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Elenco template</CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={resetForm}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuovo template
            </Button>

            <div className="max-h-[600px] overflow-y-auto rounded border">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`w-full border-b px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    selected.id === template.id ? "bg-blue-50" : ""
                  }`}
                  onClick={() => setSelected(template)}
                >
                  <div className="font-semibold">{template.titolo}</div>
                  <div className="text-xs text-gray-500">{template.codice}</div>
                  <div className="text-xs text-gray-400">{template.categoria}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selected.id ? "Modifica template" : "Nuovo template"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Codice</label>
                <Input
                  value={selected.codice || ""}
                  onChange={(e) =>
                    setSelected((prev) => ({ ...prev, codice: e.target.value }))
                  }
                  placeholder="IMU_ACCONTO"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Titolo</label>
                <Input
                  value={selected.titolo || ""}
                  onChange={(e) =>
                    setSelected((prev) => ({ ...prev, titolo: e.target.value }))
                  }
                  placeholder="IMU - Acconto"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Input
                  value={selected.categoria || ""}
                  onChange={(e) =>
                    setSelected((prev) => ({
                      ...prev,
                      categoria: e.target.value,
                    }))
                  }
                  placeholder="scadenze_imu"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Oggetto</label>
              <Input
                value={selected.oggetto || ""}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, oggetto: e.target.value }))
                }
                placeholder="Invio modello F24 IMU - Acconto [ANNO]"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Corpo email</label>
              <Textarea
                rows={12}
                value={selected.corpo || ""}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, corpo: e.target.value }))
                }
              />
            </div>

            <div className="rounded border bg-gray-50 p-3 text-sm">
              <div className="font-semibold mb-1">Variabili disponibili</div>
              <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                <span>[CLIENTE]</span>
                <span>[ANNO]</span>
                <span>[DATA_SCADENZA]</span>
                <span>[TIPO_IMU]</span>
                <span>[OPERATORE_NOME]</span>
                <span>[OPERATORE_EMAIL]</span>
                <span>[STUDIO]</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.attivo ?? true}
                onCheckedChange={(checked) =>
                  setSelected((prev) => ({ ...prev, attivo: checked === true }))
                }
              />
              <span className="text-sm">Template attivo</span>
            </div>

            <div className="flex justify-between">
              {selected.id ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => deleteTemplate(selected.id!)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Elimina
                </Button>
              ) : (
                <div />
              )}

              <Button
                type="button"
                onClick={saveTemplate}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvataggio..." : "Salva template"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
