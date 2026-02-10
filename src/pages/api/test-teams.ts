import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase/client";
import { teamsNotificationService } from "@/services/teamsNotificationService";
import { microsoftGraphService } from "@/services/microsoftGraphService";

/**
 * API Route per testare le notifiche Microsoft Teams
 * 
 * Uso: GET /api/test-teams
 * 
 * Verifica:
 * 1. Configurazione Microsoft 365
 * 2. Connessione Teams
 * 3. Invio messaggi di test
 * 4. Tutte le tipologie di notifiche
 */

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const results: TestResult[] = [];
  let allPassed = true;

  try {
    // STEP 1: Verifica sessione utente
    results.push({
      step: "1. Verifica Sessione Utente",
      success: false,
      message: "Controllo sessione utente corrente...",
    });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.email) {
      results[0].success = false;
      results[0].message = "❌ Nessuna sessione utente attiva";
      results[0].error = "Devi essere autenticato per testare Teams";
      allPassed = false;
      return res.status(401).json({ success: false, results });
    }

    results[0].success = true;
    results[0].message = `✅ Utente autenticato: ${session.user.email}`;
    results[0].data = { email: session.user.email };

    // STEP 2: Ottieni dati utente e studio
    results.push({
      step: "2. Recupero Dati Utente",
      success: false,
      message: "Recupero informazioni utente e studio...",
    });

    const { data: userData, error: userError } = await supabase
      .from("tbutenti")
      .select("id, nome, cognome, studio_id")
      .eq("email", session.user.email)
      .single();

    if (userError || !userData) {
      results[1].success = false;
      results[1].message = "❌ Utente non trovato nel database";
      results[1].error = userError?.message || "Dati utente mancanti";
      allPassed = false;
      return res.status(404).json({ success: false, results });
    }

    results[1].success = true;
    results[1].message = `✅ Utente trovato: ${userData.nome} ${userData.cognome}`;
    results[1].data = {
      userId: userData.id,
      studioId: userData.studio_id,
    };

    // STEP 3: Verifica configurazione Microsoft 365
    results.push({
      step: "3. Verifica Configurazione Microsoft 365",
      success: false,
      message: "Controllo configurazione Microsoft 365 dello studio...",
    });

    const { data: studioConfig, error: configError } = await supabase
      .from("microsoft365_config")
      .select("*")
      .eq("studio_id", userData.studio_id)
      .maybeSingle();

    if (configError || !studioConfig || !studioConfig.enabled) {
      results[2].success = false;
      results[2].message = "❌ Microsoft 365 non configurato o non abilitato";
      results[2].error =
        configError?.message || "Abilitare Microsoft 365 nelle impostazioni";
      allPassed = false;
      return res.status(400).json({ success: false, results });
    }

    results[2].success = true;
    results[2].message = "✅ Microsoft 365 configurato e abilitato";
    results[2].data = {
      tenantId: studioConfig.tenant_id,
      hasTeamsConfig: !!(studioConfig as any).teams_default_team_id,
    };

    // STEP 4: Verifica token Microsoft 365
    results.push({
      step: "4. Verifica Token Microsoft Graph",
      success: false,
      message: "Controllo token di accesso Microsoft Graph...",
    });

    const isConnected = await microsoftGraphService.isConnected(userData.id);

    if (!isConnected) {
      results[3].success = false;
      results[3].message =
        "❌ Token Microsoft 365 non validi o scaduti";
      results[3].error =
        "Riconnetti il tuo account Microsoft 365 dalle impostazioni";
      allPassed = false;
      return res.status(401).json({ success: false, results });
    }

    results[3].success = true;
    results[3].message = "✅ Token Microsoft Graph validi";

    // STEP 5: Verifica configurazione Teams
    results.push({
      step: "5. Verifica Configurazione Teams",
      success: false,
      message: "Controllo configurazione canali Teams...",
    });

    const teamId = (studioConfig as any).teams_default_team_id;
    const channelId = (studioConfig as any).teams_default_channel_id;

    if (!teamId || !channelId) {
      results[4].success = false;
      results[4].message =
        "❌ Team ID o Channel ID non configurati";
      results[4].error =
        "Configura Team ID e Channel ID nella tabella microsoft365_config";
      results[4].data = {
        help: "Apri Teams web, vai in un canale e copia groupId e threadId dall'URL",
      };
      allPassed = false;
      return res.status(400).json({ success: false, results });
    }

    results[4].success = true;
    results[4].message = "✅ Configurazione Teams presente";
    results[4].data = {
      teamId: teamId.substring(0, 8) + "...",
      channelId: channelId.substring(0, 8) + "...",
    };

    // STEP 6: Test invio messaggio semplice
    results.push({
      step: "6. Test Invio Messaggio Semplice",
      success: false,
      message: "Invio messaggio di test su Teams...",
    });

    const simpleTestResult = await teamsNotificationService.sendTeamsNotification(
      "🧪 Test Sistema Teams",
      "Questo è un messaggio di test inviato da Studio Manager Pro. Se lo vedi, l'integrazione Teams funziona correttamente! ✅",
      {
        type: "success",
      }
    );

    if (!simpleTestResult.success) {
      results[5].success = false;
      results[5].message = "❌ Errore invio messaggio semplice";
      results[5].error = simpleTestResult.error || "Errore sconosciuto";
      allPassed = false;
    } else {
      results[5].success = true;
      results[5].message =
        "✅ Messaggio semplice inviato con successo! Controlla Teams!";
    }

    // STEP 7: Test notifica scadenza
    results.push({
      step: "7. Test Notifica Scadenza",
      success: false,
      message: "Test notifica scadenza imminente...",
    });

    const scadenzaTestResult = await teamsNotificationService.sendScadenzaAlert({
      id: "test-123",
      tipo: "IVA Trimestrale",
      cliente: "Cliente Test S.r.l.",
      dataScadenza: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      responsabile: `${userData.nome} ${userData.cognome}`,
    });

    if (!scadenzaTestResult.success) {
      results[6].success = false;
      results[6].message = "❌ Errore invio notifica scadenza";
      allPassed = false;
    } else {
      results[6].success = true;
      results[6].message =
        "✅ Notifica scadenza inviata! Controlla Teams!";
    }

    // STEP 8: Test notifica promemoria
    results.push({
      step: "8. Test Notifica Promemoria",
      success: false,
      message: "Test notifica nuovo promemoria...",
    });

    const promemoriaTestResult = await teamsNotificationService.sendPromemoriaNotification({
      id: "test-456",
      titolo: "Test Promemoria - Verifica Sistema",
      mittente: `${userData.nome} ${userData.cognome}`,
      destinatario: "Team Studio",
    });

    if (!promemoriaTestResult.success) {
      results[7].success = false;
      results[7].message = "❌ Errore invio notifica promemoria";
      allPassed = false;
    } else {
      results[7].success = true;
      results[7].message =
        "✅ Notifica promemoria inviata! Controlla Teams!";
    }

    // STEP 9: Test notifica evento
    results.push({
      step: "9. Test Notifica Evento",
      success: false,
      message: "Test notifica nuovo evento...",
    });

    const eventoTestResult = await teamsNotificationService.sendEventoNotification({
      id: "test-789",
      titolo: "Test Appuntamento",
      dataInizio: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      cliente: "Cliente Test",
      utente: `${userData.nome} ${userData.cognome}`,
    });

    if (!eventoTestResult.success) {
      results[8].success = false;
      results[8].message = "❌ Errore invio notifica evento";
      allPassed = false;
    } else {
      results[8].success = true;
      results[8].message =
        "✅ Notifica evento inviata! Controlla Teams!";
    }

    // STEP 10: Test notifica nuovo cliente
    results.push({
      step: "10. Test Notifica Nuovo Cliente",
      success: false,
      message: "Test notifica nuovo cliente...",
    });

    const clienteTestResult = await teamsNotificationService.sendNuovoClienteNotification({
      id: "test-abc",
      ragioneSociale: "Test Cliente S.r.l.",
      partitaIva: "12345678901",
      responsabile: `${userData.nome} ${userData.cognome}`,
    });

    if (!clienteTestResult.success) {
      results[9].success = false;
      results[9].message = "❌ Errore invio notifica cliente";
      allPassed = false;
    } else {
      results[9].success = true;
      results[9].message =
        "✅ Notifica cliente inviata! Controlla Teams!";
    }

    // STEP 11: Test messaggio benvenuto
    results.push({
      step: "11. Test Messaggio Benvenuto",
      success: false,
      message: "Test messaggio di benvenuto...",
    });

    const welcomeTestResult = await teamsNotificationService.sendWelcomeMessage(
      `${userData.nome} ${userData.cognome}`
    );

    if (!welcomeTestResult.success) {
      results[10].success = false;
      results[10].message = "❌ Errore invio messaggio benvenuto";
      allPassed = false;
    } else {
      results[10].success = true;
      results[10].message =
        "✅ Messaggio benvenuto inviato! Controlla Teams!";
    }

    // RIEPILOGO FINALE
    const passedTests = results.filter((r) => r.success).length;
    const totalTests = results.length;

    return res.status(allPassed ? 200 : 207).json({
      success: allPassed,
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: totalTests - passedTests,
        percentage: Math.round((passedTests / totalTests) * 100),
      },
      results,
      message: allPassed
        ? "🎉 Tutti i test completati con successo! Controlla Microsoft Teams per vedere le notifiche!"
        : "⚠️ Alcuni test sono falliti. Controlla i dettagli sopra.",
    });
  } catch (error) {
    console.error("Errore test Teams:", error);

    return res.status(500).json({
      success: false,
      error: "Errore durante l'esecuzione dei test",
      details: error instanceof Error ? error.message : "Errore sconosciuto",
      results,
    });
  }
}