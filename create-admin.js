// Script per creare utente admin
// Esegui con: node create-admin.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngeltlygytupgdjiagve.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZWx0bHlneXR1cGdkamlhZ3ZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk3OTIyNiwiZXhwIjoyMDgxNTU1MjI2fQ.3JC9kdtQdLihJEHTQAfTx-k8NxmkWPiUYY59qiCPMOg';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  console.log('🔧 Creazione utente admin...');
  
  const email = 'admin@studiomanagerpro.it';
  const password = 'Admin2024!Secure';
  
  try {
    // 1. Elimina eventuali utenti esistenti con questa email da Auth
    console.log('🗑️ Pulizia utenti esistenti...');
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users?.users?.find(u => u.email === email);
    
    if (existingUser) {
      console.log(`Trovato utente esistente (${existingUser.id}), elimino...`);
      await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
      console.log('✅ Utente Auth eliminato');
    }
    
    // 2. Elimina dal database
    await supabaseAdmin
      .from('tbutenti')
      .delete()
      .eq('email', email);
    console.log('✅ Record database pulito');
    
    // 3. Crea nuovo utente in Auth
    console.log('👤 Creazione account Auth...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        nome: 'Amministratore',
        cognome: 'Sistema'
      }
    });
    
    if (authError) {
      console.error('❌ Errore Auth:', authError);
      return;
    }
    
    console.log('✅ Account Auth creato:', authData.user.id);
    
    // 4. Crea record nel database
    console.log('💾 Creazione record database...');
    const { error: dbError } = await supabaseAdmin
      .from('tbutenti')
      .insert({
        id: authData.user.id,
        nome: 'Amministratore',
        cognome: 'Sistema',
        email: email,
        tipo_utente: 'Admin',
        attivo: true
      });
    
    if (dbError) {
      console.error('❌ Errore DB:', dbError);
      return;
    }
    
    console.log('✅ Record database creato');
    console.log('\n🎉 UTENTE ADMIN CREATO CON SUCCESSO!\n');
    console.log('🔑 CREDENZIALI DI ACCESSO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Vai su Studio Manager Pro e fai il login!');
    
  } catch (error) {
    console.error('❌ ERRORE:', error);
  }
}

createAdmin();