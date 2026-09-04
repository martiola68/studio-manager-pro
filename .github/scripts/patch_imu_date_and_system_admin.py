from pathlib import Path

# --- 1) IMU: auto-populate declaration deadline from Tipi Scadenze ---
imu_path = Path('src/pages/scadenze/imu.tsx')
imu = imu_path.read_text(encoding='utf-8')
imu_original = imu

handler_marker = '  const handleNoteChange = (scadenzaId: string, value: string) => {\n'
if handler_marker not in imu:
    raise SystemExit('IMU handler marker not found')

if 'const handleDichiarazioneImuChange' not in imu:
    handler = '''  const handleDichiarazioneImuChange = async (\n    scadenza: ScadenzaImu,\n    value: boolean\n  ) => {\n    try {\n      if (!value) {\n        const payload = {\n          dichiarazione_imu: false,\n          data_scad_dichiarazione: null,\n          conferma_dichiarazione_imu: false,\n        };\n        const { error } = await supabase\n          .from("tbscadimu")\n          .update(payload)\n          .eq("id", scadenza.id);\n        if (error) throw error;\n        setScadenze((prev) =>\n          prev.map((row) => (row.id === scadenza.id ? { ...row, ...payload } : row))\n        );\n        return;\n      }\n\n      const annoBase = scadenza.anno_riferimento ?? Number(filterAnno);\n      const annoScadenza = annoBase + 1;\n\n      const { data: tipoScadenza, error: tipoError } = await supabase\n        .from("tbtipi_scadenze")\n        .select("data_scadenza, nome")\n        .eq("tipo_scadenza", "imu")\n        .eq("attivo", true)\n        .ilike("nome", "%dichiarazione%")\n        .gte("data_scadenza", `${annoScadenza}-01-01`)\n        .lte("data_scadenza", `${annoScadenza}-12-31`)\n        .order("data_scadenza", { ascending: true })\n        .limit(1)\n        .maybeSingle();\n\n      if (tipoError) throw tipoError;\n      if (!tipoScadenza?.data_scadenza) {\n        toast({\n          title: "Scadenza Dichiarazione IMU non configurata",\n          description: `Configura in Tipi Scadenze la Dichiarazione IMU per il ${annoScadenza}.`,\n          variant: "destructive",\n        });\n        return;\n      }\n\n      const payload = {\n        dichiarazione_imu: true,\n        data_scad_dichiarazione: tipoScadenza.data_scadenza,\n      };\n      const { error } = await supabase\n        .from("tbscadimu")\n        .update(payload)\n        .eq("id", scadenza.id);\n      if (error) throw error;\n\n      setScadenze((prev) =>\n        prev.map((row) => (row.id === scadenza.id ? { ...row, ...payload } : row))\n      );\n    } catch (error: any) {\n      toast({\n        title: "Errore aggiornamento",\n        description: error.message,\n        variant: "destructive",\n      });\n    }\n  };\n\n'''
    imu = imu.replace(handler_marker, handler + handler_marker, 1)

old_select = 'onChange={(e) => { const nextValue = e.target.value === "SI"; if (nextValue !== Boolean(scadenza.dichiarazione_imu)) handleToggleField(scadenza.id, "dichiarazione_imu", scadenza.dichiarazione_imu); }}'
new_select = 'onChange={(e) => void handleDichiarazioneImuChange(scadenza, e.target.value === "SI")}'
if old_select not in imu:
    raise SystemExit('IMU declaration select marker not found')
imu = imu.replace(old_select, new_select, 1)

old_date = '<Input type="date" disabled={!scadenza.acconto_imu || !scadenza.dichiarazione_imu} value={scadenza.data_scad_dichiarazione || ""} onChange={(e) => handleUpdateField(scadenza.id, "data_scad_dichiarazione", e.target.value)} className="h-8 w-full border-slate-300 bg-white text-xs disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" />'
new_date = '<Input type="date" disabled value={scadenza.data_scad_dichiarazione || ""} className="h-8 w-full border-slate-300 bg-white text-xs disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" />'
if old_date not in imu:
    raise SystemExit('IMU declaration date input marker not found')
imu = imu.replace(old_date, new_date, 1)

if imu == imu_original:
    raise SystemExit('No IMU changes')
imu_path.write_text(imu, encoding='utf-8')

# --- 2) Tipi Scadenze: robust system-admin detection so Modifica reappears for general system admin ---
tipi_path = Path('src/pages/impostazioni/tipi-scadenze.tsx')
tipi = tipi_path.read_text(encoding='utf-8')
tipi_original = tipi

old_admin = '''      const { data: systemAdmin, error: systemAdminError } = await (supabase as any).rpc(\n        "is_system_catalog_admin",\n      );\n      if (systemAdminError) {\n        console.warn("Verifica amministratore catalogo non disponibile:", systemAdminError);\n      }\n      setCanManageSystem(systemAdmin === true);\n'''
new_admin = '''      const { data: systemAdmin, error: systemAdminError } = await (supabase as any).rpc(\n        "is_system_catalog_admin",\n      );\n      if (systemAdminError) {\n        console.warn("Verifica amministratore catalogo non disponibile:", systemAdminError);\n      }\n\n      let canManageCatalog = systemAdmin === true;\n\n      // Fallback UI per l'amministratore generale: la RLS resta comunque l'autorità finale.\n      if (!canManageCatalog && user.email) {\n        const { data: adminProfile } = await supabase\n          .from("tbutenti")\n          .select("nome, cognome, tipo_utente, attivo")\n          .eq("email", user.email)\n          .maybeSingle();\n\n        const role = String(adminProfile?.tipo_utente || "").trim().toUpperCase();\n        const nome = String(adminProfile?.nome || "").trim().toUpperCase();\n        const cognome = String(adminProfile?.cognome || "").trim().toUpperCase();\n        canManageCatalog =\n          adminProfile?.attivo !== false &&\n          (role === "ADMIN" || role === "AMMINISTRATORE") &&\n          nome === "MARIO" &&\n          cognome === "ARTIOLA";\n      }\n\n      setCanManageSystem(canManageCatalog);\n'''
if old_admin not in tipi:
    raise SystemExit('Tipi Scadenze admin marker not found')
tipi = tipi.replace(old_admin, new_admin, 1)

# Verify that existing UI already renders actions for editable items.
if '{editable && (' not in tipi or 'handleOpenDialog(tipo)' not in tipi:
    raise SystemExit('Tipi Scadenze edit actions not found')

if tipi == tipi_original:
    raise SystemExit('No Tipi Scadenze changes')
tipi_path.write_text(tipi, encoding='utf-8')

print('Patched IMU declaration date and system-admin edit access')
