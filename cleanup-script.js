// Script temporaneo per pulizia utenti
// Esegui con: node cleanup-script.js

async function cleanup() {
  console.log("🧹 PULIZIA UTENTI IN CORSO...");
  
  try {
    const response = await fetch("http://localhost:3000/api/admin/cleanup-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminEmail: "admin@studiomanagerpro.it"
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log("✅ PULIZIA COMPLETATA!");
      console.log(`- Utenti eliminati da Auth: ${result.deleted}`);
      console.log(`- Errori: ${result.errors}`);
      
      if (result.deletedEmails.length > 0) {
        console.log("\n📧 Email eliminate:");
        result.deletedEmails.forEach(email => console.log(`  - ${email}`));
      }
      
      if (result.errorDetails.length > 0) {
        console.log("\n⚠️ Errori:");
        result.errorDetails.forEach(err => console.log(`  - ${err.email}: ${err.error}`));
      }
    } else {
      console.error("❌ ERRORE:", result.error);
    }
  } catch (error) {
    console.error("❌ ERRORE CRITICO:", error);
  }
}

cleanup();