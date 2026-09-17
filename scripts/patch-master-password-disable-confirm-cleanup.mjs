import fs from "node:fs";

function patchMasterPasswordPage() {
  const path = "src/pages/impostazioni/master-password.tsx";
  let source = fs.readFileSync(path, "utf8");

  if (!source.includes("showDisableProtectionDialog")) {
    const stateAnchor = `  const [showPasswordDialog, setShowPasswordDialog] = useState(false);\n  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);`;
    if (!source.includes(stateAnchor)) {
      throw new Error("[master-password cleanup] stato dialog principale non trovato");
    }
    source = source.replace(
      stateAnchor,
      `${stateAnchor}\n  const [showDisableProtectionDialog, setShowDisableProtectionDialog] = useState(false);\n  const [disablePassword, setDisablePassword] = useState(\"\");`
    );
  }

  const toggleStart = source.indexOf(`  const handleToggleProtection = async (enabled: boolean) => {`);
  const toggleEnd = source.indexOf(`\n\n  const handleSaveMasterPassword = async () => {`, toggleStart);
  if (toggleStart < 0 || toggleEnd < 0) {
    throw new Error("[master-password cleanup] blocco handleToggleProtection non trovato");
  }

  const toggleBlock = `  const handleToggleProtection = async (enabled: boolean) => {
    if (!studio) return;

    if (!enabled) {
      if (!studio.master_password_hash) {
        toast({
          title: "Errore",
          description: "Master Password non configurata: impossibile verificare la disattivazione.",
          variant: "destructive",
        });
        return;
      }
      setDisablePassword("");
      setShowDisableProtectionDialog(true);
      return;
    }

    if (!studio.master_password_hash) {
      setShowPasswordDialog(true);
      return;
    }

    try {
      setSaving(true);
      await studioService.updateStudio(studio.id, { protezione_attiva: true });
      setIsPasswordProtected(true);
      toast({
        title: "Protezione attivata",
        description: "La Master Password protegge le aree sensibili configurate.",
      });
      await loadStudio();
    } catch (error) {
      console.error("Errore attivazione protezione:", error);
      toast({
        title: "Errore",
        description: "Impossibile attivare la protezione dati sensibili",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDisableProtection = async () => {
    if (!studio?.master_password_hash) return;

    try {
      setSaving(true);
      const valid = await bcrypt.compare(disablePassword, studio.master_password_hash);
      if (!valid) {
        toast({
          title: "Master Password non corretta",
          description: "La protezione resta attiva.",
          variant: "destructive",
        });
        return;
      }

      await studioService.updateStudio(studio.id, { protezione_attiva: false });
      setIsPasswordProtected(false);
      setShowDisableProtectionDialog(false);
      setDisablePassword("");
      toast({
        title: "Protezione disattivata",
        description: "La Master Password è stata disattivata dopo la verifica della password attuale.",
      });
      await loadStudio();
    } catch (error) {
      console.error("Errore disattivazione protezione:", error);
      toast({
        title: "Errore",
        description: "Impossibile disattivare la protezione dati sensibili",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };`;

  source = source.slice(0, toggleStart) + toggleBlock + source.slice(toggleEnd);

  if (!source.includes(`<Dialog open={showDisableProtectionDialog}`)) {
    const dialogAnchor = `      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>`;
    if (!source.includes(dialogAnchor)) {
      throw new Error("[master-password cleanup] anchor dialog configurazione non trovato");
    }

    const disableDialog = `      <Dialog
        open={showDisableProtectionDialog}
        onOpenChange={(open) => {
          setShowDisableProtectionDialog(open);
          if (!open) setDisablePassword("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disattiva Master Password</DialogTitle>
            <DialogDescription>
              Per disattivare la protezione inserisci la Master Password attuale. Senza verifica la protezione rimane attiva.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="disable-master-password">Master Password attuale</Label>
            <Input
              id="disable-master-password"
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter" && disablePassword && !saving) {
                  e.preventDefault();
                  void handleConfirmDisableProtection();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDisableProtectionDialog(false);
                setDisablePassword("");
              }}
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDisableProtection}
              disabled={!disablePassword || saving}
            >
              Conferma disattivazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

`;

    source = source.replace(dialogAnchor, disableDialog + dialogAnchor);
  }

  const alertOld = `              La Master Password non viene mostrata in chiaro. Questa pagina resta raggiungibile dagli amministratori autenticati anche per consentire il recupero sicuro in caso di smarrimento.`;
  const alertNew = `              La Master Password non viene mostrata in chiaro. La disattivazione richiede sempre la Master Password attuale. Questa pagina resta raggiungibile dagli amministratori autenticati anche per consentire il recupero sicuro in caso di smarrimento.`;
  if (source.includes(alertOld)) source = source.replace(alertOld, alertNew);

  fs.writeFileSync(path, source, "utf8");
  console.log("✓ Gestione Master Password: disattivazione protetta da verifica password");
}

function patchDatiStudioPage() {
  const path = "src/pages/impostazioni/studio.tsx";
  let source = fs.readFileSync(path, "utf8");

  source = source.replace(`import { passwordResetService } from "@/services/passwordResetService";\n`, "");
  source = source.replace(`import { Switch } from "@/components/ui/switch";\n`, "");
  source = source.replace(`import { Badge } from "@/components/ui/badge";\n`, "");
  source = source.replace(`import { Alert, AlertDescription } from "@/components/ui/alert";\n`, "");
  source = source.replace(
    `import { Save, Shield, Lock, Eye, EyeOff, Mail, KeyRound } from "lucide-react";`,
    `import { Save } from "lucide-react";`
  );
  source = source.replace(`import bcrypt from "bcryptjs";\n`, "");

  const statesStart = source.indexOf(`  // Master Password states`);
  const formStateStart = source.indexOf(`const [formData, setFormData] = useState({`, statesStart);
  if (statesStart >= 0 && formStateStart > statesStart) {
    source = source.slice(0, statesStart) + source.slice(formStateStart);
  }

  source = source.replace(/\n\s*setIsPasswordProtected\(studioData\.protezione_attiva \|\| false\);/, "");

  const logicStart = source.indexOf(`  const getPasswordStrength = (password: string)`);
  const loadingStart = source.indexOf(`  if (loading) {`, logicStart);
  if (logicStart >= 0 && loadingStart > logicStart) {
    source = source.slice(0, logicStart) + source.slice(loadingStart);
  }

  source = source.replace(/\n\s*const passwordStrength = getPasswordStrength\(masterPassword\);\n\s*const newPasswordStrength = getPasswordStrength\(newPassword\);\n/, "\n");

  const protectionTitleIndex = source.indexOf(`Protezione Dati Sensibili`);
  if (protectionTitleIndex >= 0) {
    const protectionCardStart = source.lastIndexOf(`<Card className=`, protectionTitleIndex);
    const saveButtonStart = source.indexOf(`<div className="flex justify-end">`, protectionTitleIndex);
    if (protectionCardStart < 0 || saveButtonStart < 0 || saveButtonStart <= protectionCardStart) {
      throw new Error("[master-password cleanup] card Protezione Dati Sensibili non delimitabile");
    }
    source = source.slice(0, protectionCardStart) + source.slice(saveButtonStart);
  }

  const dialogsStart = source.indexOf(`      {/* Dialog Configurazione Master Password */}`);
  if (dialogsStart >= 0) {
    const rootClose = source.lastIndexOf(`\n    </div>\n  );\n}`);
    if (rootClose < dialogsStart) {
      throw new Error("[master-password cleanup] chiusura pagina Dati Studio non trovata");
    }
    source = source.slice(0, dialogsStart) + source.slice(rootClose);
  }

  if (source.includes("Protezione Dati Sensibili") || source.includes("Configura Master Password") || source.includes("Cambia Master Password")) {
    throw new Error("[master-password cleanup] gestione Master Password ancora presente in Dati Studio");
  }

  fs.writeFileSync(path, source, "utf8");
  console.log("✓ Dati Studio: rimossa gestione Master Password duplicata; la route resta protetta dal gate centrale");
}

patchMasterPasswordPage();
patchDatiStudioPage();
