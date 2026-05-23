"use client";

export default function FormDistribuzioneUtili({ pratica }: any) {
  return (
    <main style={{ padding: 28, background: "#f8fafc", minHeight: "100vh" }}>
      <h1>{pratica.numero_pratica}</h1>
      <p>{pratica.titolo}</p>

      <div style={{ background: "#fff", padding: 24, borderRadius: 10 }}>
        <h2>Distribuzione utili</h2>
        <p>Qui ora spostiamo soci, percentuali, lordo/netto e documenti.</p>
      </div>
    </main>
  );
}
