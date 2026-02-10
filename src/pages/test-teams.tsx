import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, PlayCircle } from "lucide-react";

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

interface TestResponse {
  success: boolean;
  summary: {
    total: number;
    passed: number;
    failed: number;
    percentage: number;
  };
  results: TestResult[];
  message: string;
}

export default function TestTeamsPage() {
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResponse | null>(null);

  const runTests = async () => {
    setTesting(true);
    setTestResults(null);

    try {
      const response = await fetch("/api/test-teams");
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      console.error("Errore test:", error);
      setTestResults({
        success: false,
        summary: { total: 0, passed: 0, failed: 0, percentage: 0 },
        results: [],
        message: "Errore durante l'esecuzione dei test",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">🧪 Test Microsoft Teams</h1>
          <p className="text-muted-foreground mt-2">
            Verifica la configurazione e testa l'invio di notifiche su Microsoft Teams
          </p>
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informazioni Test</CardTitle>
            <CardDescription>
              Questo test verificherà la corretta configurazione di Microsoft Teams e invierà alcuni messaggi di prova sul tuo canale Teams configurato.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Cosa verrà testato:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Verifica sessione utente e configurazione studio</li>
                <li>Controllo configurazione Microsoft 365</li>
                <li>Validazione token Microsoft Graph</li>
                <li>Verifica configurazione Team ID e Channel ID</li>
                <li>Invio messaggi di test (vari tipi di notifiche)</li>
              </ul>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Nota</AlertTitle>
              <AlertDescription>
                Assicurati di essere autenticato e di aver configurato Microsoft 365 nelle impostazioni dello studio prima di eseguire il test.
              </AlertDescription>
            </Alert>

            <Button
              onClick={runTests}
              disabled={testing}
              size="lg"
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Test in corso...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Avvia Test Teams
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {testResults && (
          <div className="space-y-4">
            {/* Summary Card */}
            <Card className={testResults.success ? "border-green-500" : "border-yellow-500"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {testResults.success ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-yellow-500" />
                  )}
                  Riepilogo Test
                </CardTitle>
                <CardDescription>{testResults.message}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{testResults.summary.total}</div>
                    <div className="text-sm text-muted-foreground">Totali</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">
                      {testResults.summary.passed}
                    </div>
                    <div className="text-sm text-muted-foreground">Passati</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">
                      {testResults.summary.failed}
                    </div>
                    <div className="text-sm text-muted-foreground">Falliti</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{testResults.summary.percentage}%</div>
                    <div className="text-sm text-muted-foreground">Successo</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Results */}
            <Card>
              <CardHeader>
                <CardTitle>Dettaglio Test</CardTitle>
                <CardDescription>
                  Risultati dettagliati di ogni step del test
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {testResults.results.map((result, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-start gap-3">
                        {result.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        )}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{result.step}</h4>
                            <Badge variant={result.success ? "default" : "destructive"}>
                              {result.success ? "OK" : "FAIL"}
                            </Badge>
                          </div>
                          <p className="text-sm">{result.message}</p>
                          {result.error && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertTitle>Errore</AlertTitle>
                              <AlertDescription>{result.error}</AlertDescription>
                            </Alert>
                          )}
                          {result.data && (
                            <details className="mt-2">
                              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                                Mostra dettagli
                              </summary>
                              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                                {JSON.stringify(result.data, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            {testResults.success && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Test Completati con Successo! 🎉</AlertTitle>
                <AlertDescription>
                  Controlla il tuo canale Microsoft Teams per vedere le notifiche di test inviate.
                  L'integrazione Teams è operativa e funzionante!
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={runTests}
              disabled={testing}
              variant="outline"
              className="w-full"
            >
              Ripeti Test
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}