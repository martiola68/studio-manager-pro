import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { studioService } from "@/services/studioService";
import Header from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Upload, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Studio = Database["public"]["Tables"]["tbstudio"]["Row"];

export default function DatiStudioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    ragione_sociale: "",
    denominazione_breve: "",
    partita_iva: "",
    codice_fiscale: "",
    indirizzo: "",
    cap: "",
    citta: "",
    provincia: "",
    telefono: "",
    email: "",
    pec: "",
    sito_web: "",
    note: ""
  });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: utente } = await supabase
        .from("tbutenti")
        .select("tipo_utente")
        .eq("email", session.user.email)
        .single();

      if (utente?.tipo_utente !== "Admin") {
        router.push("/dashboard");
        return;
      }

      await loadStudio();
    } catch (error) {
      console.error("Errore:", error);
      router.push("/login");
    }
  };

  const loadStudio = async () => {
    try {
      setLoading(true);
      const studioData = await studioService.getStudio();
      
      if (studioData) {
        setStudio(studioData);
        setFormData({
          ragione_sociale: studioData.ragione_sociale || "",
          denominazione_breve: studioData.denominazione_breve || "",
          partita_iva: studioData.partita_iva || "",
          codice_fiscale: studioData.codice_fiscale || "",
          indirizzo: studioData.indirizzo || "",
          cap: studioData.cap || "",
          citta: studioData.citta || "",
          provincia: studioData.provincia || "",
          telefono: studioData.telefono || "",
          email: studioData.email || "",
          pec: studioData.pec || "",
          sito_web: studioData.sito_web || "",
          note: studioData.note || ""
        });
        if (studioData.logo_url) {
          setLogoPreview(studioData.logo_url);
        }
      }
    } catch (error) {
      console.error("Errore caricamento studio:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati dello studio",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Errore",
          description: "Il file è troppo grande. Massimo 2MB",
          variant: "destructive"
        });
        return;
      }
      
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Errore",
          description: "Il file deve essere un'immagine",
          variant: "destructive"
        });
        return;
      }

      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !studio) return null;

    try {
      const fileExt = logoFile.name.split(".").pop();
      const fileName = `${studio.id}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("studio-assets")
        .upload(filePath, logoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("studio-assets")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Errore upload logo:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare il logo",
        variant: "destructive"
      });
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studio) {
      toast({
        title: "Errore",
        description: "Dati studio non disponibili",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);

      let logoUrl = studio.logo_url;
      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
      }

      await studioService.updateStudio(studio.id, {
        ...formData,
        logo_url: logoUrl
      });

      toast({
        title: "Successo",
        description: "Dati studio salvati con successo"
      });

      await loadStudio();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare i dati dello studio",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Dati Studio</h1>
              <p className="text-gray-500 mt-1">Gestisci anagrafica e logo dello studio</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Logo Studio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo Studio"
                          className="w-32 h-32 object-contain border-2 border-gray-200 rounded-lg"
                        />
                      ) : (
                        <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Building2 className="h-12 w-12 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Label htmlFor="logo" className="cursor-pointer">
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors">
                            <div className="text-center">
                              <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-sm text-gray-600">
                                Clicca per caricare il logo
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                PNG, JPG fino a 2MB
                              </p>
                            </div>
                          </div>
                        </Label>
                        <Input
                          id="logo"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Dati Anagrafici</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="ragione_sociale">Ragione Sociale *</Label>
                        <Input
                          id="ragione_sociale"
                          value={formData.ragione_sociale}
                          onChange={(e) => setFormData({ ...formData, ragione_sociale: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="denominazione_breve">Denominazione Breve *</Label>
                        <Input
                          id="denominazione_breve"
                          value={formData.denominazione_breve}
                          onChange={(e) => setFormData({ ...formData, denominazione_breve: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="partita_iva">Partita IVA *</Label>
                        <Input
                          id="partita_iva"
                          value={formData.partita_iva}
                          onChange={(e) => setFormData({ ...formData, partita_iva: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="codice_fiscale">Codice Fiscale *</Label>
                        <Input
                          id="codice_fiscale"
                          value={formData.codice_fiscale}
                          onChange={(e) => setFormData({ ...formData, codice_fiscale: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="indirizzo">Indirizzo *</Label>
                      <Input
                        id="indirizzo"
                        value={formData.indirizzo}
                        onChange={(e) => setFormData({ ...formData, indirizzo: e.target.value })}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cap">CAP *</Label>
                        <Input
                          id="cap"
                          value={formData.cap}
                          onChange={(e) => setFormData({ ...formData, cap: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="citta">Città *</Label>
                        <Input
                          id="citta"
                          value={formData.citta}
                          onChange={(e) => setFormData({ ...formData, citta: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="provincia">Provincia *</Label>
                        <Input
                          id="provincia"
                          value={formData.provincia}
                          onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                          maxLength={2}
                          required
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Contatti</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="telefono">Telefono *</Label>
                        <Input
                          id="telefono"
                          type="tel"
                          value={formData.telefono}
                          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="pec">PEC *</Label>
                        <Input
                          id="pec"
                          type="email"
                          value={formData.pec}
                          onChange={(e) => setFormData({ ...formData, pec: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sito_web">Sito Web</Label>
                        <Input
                          id="sito_web"
                          type="url"
                          value={formData.sito_web}
                          onChange={(e) => setFormData({ ...formData, sito_web: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="note">Note</Label>
                      <Textarea
                        id="note"
                        value={formData.note}
                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                        rows={4}
                        placeholder="Note aggiuntive..."
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? (
                      <>
                        <div className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Salvataggio...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salva Modifiche
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}