-- Ora riabilito RLS su entrambe le tabelle
ALTER TABLE tbconversazioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbconversazioni_utenti ENABLE ROW LEVEL SECURITY;

-- Verifica
SELECT 
  '✅ RLS RIABILITATO' as test,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('tbconversazioni', 'tbconversazioni_utenti')
ORDER BY tablename;